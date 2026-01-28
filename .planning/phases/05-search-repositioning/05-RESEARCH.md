# Phase 5: Search Repositioning - Research

**Researched:** 2026-01-28
**Domain:** CSS positioning, React scroll behavior, localStorage
**Confidence:** HIGH

## Summary

This phase moves the search bar from the header row into a dedicated full-width row below the header, implementing differential sticky behavior (both rows sticky on desktop, only header sticky on mobile) and adding scroll-triggered shadow effects. The research focused on three core domains: CSS sticky positioning with multiple stacked elements, React scroll detection patterns for shadow effects, and localStorage-based recent searches.

The standard approach uses native CSS `position: sticky` for both rows with proper parent container setup, a React `useEffect` hook with scroll event listeners for shadow state management, and localStorage for persisting recent searches. No external libraries are required - all functionality can be achieved with native browser APIs and React primitives.

**Primary recommendation:** Use native CSS sticky positioning with separate top values for stacked rows, implement scroll detection with a debounced useEffect hook, and store recent searches in localStorage with a 5-10 item limit using Array methods for deduplication.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.3 | UI framework | Already in project, hooks for scroll detection |
| Next.js | 16.1.1 | App framework | Already in project, SSR-safe patterns needed |
| Tailwind CSS | 4.1.8 | Styling | Already in project, sticky utilities built-in |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Radix UI Popover | Latest in project | Recent searches dropdown | Already used for dropdowns, accessible |
| localStorage API | Native | Persist recent searches | Browser-native, no installation needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native scroll listener | Intersection Observer | IO better for element visibility but scroll listener simpler for scroll position |
| localStorage | sessionStorage | sessionStorage clears on tab close, not suitable for "recent" searches |
| Custom hook | react-use useScroll | External dependency not needed for simple scroll Y tracking |

**Installation:**
```bash
# No new dependencies required - all APIs are native or already in project
```

## Architecture Patterns

### Recommended Component Structure
```
components/
├── header.tsx                    # Main header (updated to wrap both rows)
├── search-row.tsx               # New component - dedicated search row
├── search-bar.tsx               # Existing - updated for larger size, recent searches
└── recent-searches-dropdown.tsx # New component - popover with recent searches
```

### Pattern 1: Stacked Sticky Elements
**What:** Multiple sibling elements with `position: sticky` and different `top` values to stack them vertically when scrolling.
**When to use:** When you need multiple rows to stick at different vertical positions (header at top: 0, search row at top: 64px after header height).
**Example:**
```tsx
// Source: https://css-tricks.com/stacked-cards-with-sticky-positioning-and-a-dash-of-sass/
// MDN: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/position

// Parent container - must not have overflow: hidden/scroll/auto
<div className="relative">
  {/* Header row - sticks at top: 0 */}
  <div className="sticky top-0 z-50 h-16 bg-background border-b">
    {/* Header content */}
  </div>

  {/* Search row - sticks at top: 64px (after header) on desktop, not sticky on mobile */}
  <div className="md:sticky md:top-16 z-40 h-14 bg-background border-b">
    {/* Search bar */}
  </div>
</div>
```

**Critical rules:**
- Parent container must NOT have `overflow: hidden`, `overflow: scroll`, or `overflow: auto` (kills sticky behavior)
- Each sticky element needs explicit `top` value (not `auto`)
- Second sticky element's `top` should equal first element's height to stack properly
- z-index manages layering (header z-50, search z-40)

### Pattern 2: Scroll-Triggered Shadow
**What:** Detect scroll position and apply shadow class when scrolled past threshold.
**When to use:** Visual feedback that content has scrolled behind sticky elements.
**Example:**
```tsx
// Source: https://medium.com/@bagiyanliana2/scroll-shadows-in-react-a-step-by-step-guide-95ac5aafb4d6
// Source: https://www.qovery.com/blog/adding-elegant-shadows-with-react-to-invite-users-to-scroll

function SearchRow() {
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      // Threshold determines when shadow appears (10-20px typical)
      setIsScrolled(window.scrollY > 10)
    }

    // Attach listener
    window.addEventListener('scroll', handleScroll, { passive: true })

    // CRITICAL: Cleanup to prevent memory leaks
    return () => window.removeEventListener('scroll', handleScroll)
  }, []) // Empty array = mount/unmount only

  return (
    <div className={cn(
      "sticky top-16 transition-shadow duration-200",
      isScrolled && "shadow-md"
    )}>
      {/* Search content */}
    </div>
  )
}
```

**Critical rules:**
- Always return cleanup function from useEffect
- Use empty dependency array `[]` for mount/unmount only
- Add `{ passive: true }` option to scroll listener for performance
- Use CSS transition for smooth shadow fade-in (not binary toggle)

### Pattern 3: Mobile Scroll-Away with Threshold
**What:** On mobile, header stays sticky but search row scrolls away after a small threshold delay.
**When to use:** Preserve vertical space on mobile while keeping primary nav accessible.
**Example:**
```tsx
// Source: https://www.codemzy.com/blog/react-sticky-header-disappear-scroll
// Source: https://dev.to/dalalrohit/sticky-navbar-from-scratch-using-react-37d5

function SearchRow() {
  const [hideOnMobile, setHideOnMobile] = useState(false)
  const lastScrollY = useRef(0)

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      const THRESHOLD = 50 // pixels to scroll before hiding

      if (currentScrollY > THRESHOLD && currentScrollY > lastScrollY.current) {
        // Scrolling down past threshold
        setHideOnMobile(true)
      } else if (currentScrollY < lastScrollY.current) {
        // Scrolling up - show immediately
        setHideOnMobile(false)
      }

      lastScrollY.current = currentScrollY
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className={cn(
      "transition-transform duration-300 md:translate-y-0",
      // On mobile, hide by translating up
      hideOnMobile && "-translate-y-full"
    )}>
      {/* Search content */}
    </div>
  )
}
```

### Pattern 4: Recent Searches with localStorage
**What:** Store recent search terms in localStorage, display in dropdown on focus, allow individual/bulk clearing.
**When to use:** Improve search UX by surfacing previous queries.
**Example:**
```tsx
// Source: https://medium.com/@tantowi17/how-to-implement-recent-search-with-localstorage-in-a-website-8efdd861d5b4
// Source: https://blog.logrocket.com/localstorage-javascript-complete-guide/

const MAX_RECENT_SEARCHES = 5
const STORAGE_KEY = 'recent-searches'

function addRecentSearch(term: string) {
  try {
    // Get existing searches
    const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')

    // Remove duplicates (case-insensitive)
    const filtered = existing.filter(
      (s: string) => s.toLowerCase() !== term.toLowerCase()
    )

    // Add new term at beginning, limit to MAX
    const updated = [term, ...filtered].slice(0, MAX_RECENT_SEARCHES)

    // Save back to localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch (error) {
    // Silent fail - localStorage may be disabled or full
    console.error('Failed to save recent search:', error)
  }
}

function getRecentSearches(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

function clearRecentSearch(term: string) {
  try {
    const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    const filtered = existing.filter((s: string) => s !== term)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
  } catch (error) {
    console.error('Failed to clear recent search:', error)
  }
}

function clearAllRecentSearches() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    console.error('Failed to clear all recent searches:', error)
  }
}
```

**Critical rules:**
- Always wrap localStorage calls in try-catch (can throw if disabled or quota exceeded)
- Use JSON.parse/stringify for arrays/objects
- Check for duplicates before adding (case-insensitive comparison)
- Limit array size to prevent unbounded growth (5-10 items typical)
- Never store sensitive data in localStorage (plaintext, accessible to all scripts)

### Pattern 5: Recent Searches Dropdown with Radix Popover
**What:** Use Radix UI Popover to display recent searches when input is focused and empty.
**When to use:** Need accessible, well-positioned dropdown that follows focus management best practices.
**Example:**
```tsx
// Source: https://www.radix-ui.com/primitives/docs/components/popover
// Source: https://www.dhiwise.com/post/a-developer's-handbook-to-radix-popover-components

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

function SearchBarWithRecent() {
  const [isFocused, setIsFocused] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [recentSearches, setRecentSearches] = useState<string[]>([])

  // Load recent searches on mount
  useEffect(() => {
    setRecentSearches(getRecentSearches())
  }, [])

  const showRecent = isFocused && inputValue === '' && recentSearches.length > 0

  return (
    <Popover open={showRecent}>
      <PopoverTrigger asChild>
        <input
          type="search"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className="..."
        />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()} // Don't steal focus from input
        className="w-[--radix-popover-trigger-width]" // Match input width
      >
        {recentSearches.map((term) => (
          <div key={term} className="flex items-center justify-between">
            <button onClick={() => setInputValue(term)}>
              {term}
            </button>
            <button onClick={() => {
              clearRecentSearch(term)
              setRecentSearches(getRecentSearches())
            }}>
              ×
            </button>
          </div>
        ))}
        <button onClick={() => {
          clearAllRecentSearches()
          setRecentSearches([])
        }}>
          Clear all
        </button>
      </PopoverContent>
    </Popover>
  )
}
```

**Critical rules:**
- Use `onOpenAutoFocus={(e) => e.preventDefault()}` to keep focus on input
- Use `--radix-popover-trigger-width` CSS var to match popover width to input
- Control `open` prop manually based on focus + empty input + has items
- Update state after clearing searches to re-render

### Anti-Patterns to Avoid
- **Overflow on parent container:** Never put `overflow: hidden/scroll/auto` on parent of sticky elements - it breaks sticky behavior completely
- **Missing cleanup on scroll listeners:** Always return cleanup function from useEffect to prevent memory leaks
- **Unbounded localStorage arrays:** Always limit recent searches to prevent unbounded growth (5-10 items max)
- **localStorage without try-catch:** localStorage can throw if disabled or quota exceeded - always wrap in try-catch
- **High-frequency scroll handlers without throttling:** Scroll events fire continuously - use `{ passive: true }` option and consider debouncing state updates
- **z-index battles:** Use systematic z-index scale (header z-50, search z-40, content z-0) to avoid layering issues

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dropdown positioning | Custom absolute positioning logic | Radix UI Popover | Already in project, handles collision detection, focus management, accessibility |
| Search bar state management | Custom context or global state | URL searchParams + local state | Already used in existing search-bar.tsx, single source of truth |
| Focus management in popovers | Manual focus tracking | Radix `onOpenAutoFocus` prop | Handles edge cases, accessibility, portal focus traps |
| Responsive sticky behavior | JavaScript-based show/hide | CSS sticky + Tailwind breakpoint modifiers | More performant, no JS needed for desktop case |

**Key insight:** CSS position: sticky is well-supported (97%+ browsers) and more performant than JavaScript scroll-based positioning. Radix UI handles accessibility and focus management edge cases that are easy to miss in custom implementations.

## Common Pitfalls

### Pitfall 1: Sticky Element in Overflow Container
**What goes wrong:** Element with `position: sticky` doesn't stick, behaves like `position: relative` instead.
**Why it happens:** Sticky positioning requires the parent container to have visible overflow. If any ancestor has `overflow: hidden`, `overflow: scroll`, or `overflow: auto`, sticky behavior is disabled.
**How to avoid:**
- Audit all parent elements - none can have overflow other than `visible`
- In Tailwind, avoid `overflow-hidden`, `overflow-scroll`, `overflow-auto` on ancestors
- If you need overflow control, apply it to a child element inside the sticky container, not the parent
**Warning signs:**
- Element appears in DOM but doesn't stick when scrolling
- Browser DevTools shows `position: sticky` but element moves with scroll

### Pitfall 2: Missing Scroll Listener Cleanup
**What goes wrong:** Memory leaks, performance degradation, "Maximum update depth exceeded" errors, listeners persisting across route changes.
**Why it happens:** Event listeners registered with `addEventListener` persist until explicitly removed. In React, if component unmounts without cleanup, listener continues firing and trying to update unmounted component state.
**How to avoid:**
- Always return cleanup function from useEffect: `return () => removeEventListener(...)`
- Use empty dependency array `[]` if listener doesn't depend on props/state
- Pass same function reference to both addEventListener and removeEventListener
**Warning signs:**
- Console errors about updating unmounted component
- Slow performance on pages you've navigated away from
- Multiple scroll handlers firing (visible in performance profiler)

### Pitfall 3: localStorage Quota Exceeded
**What goes wrong:** `localStorage.setItem()` throws "QuotaExceededError", breaking the feature.
**Why it happens:** localStorage has a 5-10MB limit per origin (browser-dependent). Unbounded arrays or storing large objects can exceed quota.
**How to avoid:**
- Always wrap localStorage calls in try-catch
- Limit array sizes (slice to max length before saving)
- Store minimal data (search terms only, not full result objects)
- Provide silent fallback if localStorage fails
**Warning signs:**
- Error: "QuotaExceededError: The quota has been exceeded"
- localStorage works initially but breaks after time
- localStorage disabled in private/incognito mode

### Pitfall 4: Sticky Stacking Order Wrong
**What goes wrong:** Search row appears above header row when both are sticky, or shadow appears on wrong element.
**Why it happens:** z-index values not set correctly, or both elements have same z-index causing paint-order-based stacking.
**How to avoid:**
- Assign explicit z-index to all sticky elements in descending order: header (z-50) > search (z-40) > content (z-0)
- Use consistent z-index scale across project (Tailwind provides z-0, z-10, z-20, z-30, z-40, z-50)
- Apply shadow to bottom of search row (last sticky element) not header
**Warning signs:**
- Header disappears behind search row when sticky
- Shadow appears between sticky elements instead of below both

### Pitfall 5: Mobile Scroll Detection Jank
**What goes wrong:** Search row flickers or jumps during scroll, causing visual jank and poor UX.
**Why it happens:** State updates on every scroll event (fires 60+ times per second), causing excessive re-renders. Using synchronous state updates can also block the main thread.
**How to avoid:**
- Use CSS transitions for smooth hide/show: `transition-transform duration-300`
- Add scroll threshold before state change (e.g., 50px) to prevent micro-scroll triggers
- Use `{ passive: true }` option on addEventListener for better scroll performance
- Consider using `transform: translateY()` instead of display/visibility for GPU acceleration
**Warning signs:**
- Visible stuttering during scroll on mobile
- Search bar "pops" in/out instead of smooth transition
- Performance profiler shows excessive component renders during scroll

### Pitfall 6: Hydration Mismatch with localStorage
**What goes wrong:** Next.js throws "Text content did not match" hydration error, or recent searches don't appear on initial render.
**Why it happens:** localStorage is only available in browser (not during SSR). Reading localStorage during render causes server HTML to differ from client HTML.
**How to avoid:**
- Only read localStorage in useEffect (client-side only)
- Initialize state with empty array, load from storage in effect
- Never read localStorage during component render (outside useEffect)
**Warning signs:**
- Console error: "Text content did not match"
- Recent searches don't appear until second render/interaction
- Different content flashes on page load

## Code Examples

Verified patterns from official sources:

### Stacked Sticky Header + Search Row
```tsx
// Source: https://tailwindcss.com/docs/position
// Source: https://css-tricks.com/stacked-cards-with-sticky-positioning-and-a-dash-of-sass/

export function StickyHeaderWithSearch() {
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div>
      {/* Header row - always sticky on desktop, always sticky on mobile */}
      <header className="sticky top-0 z-50 h-16 bg-background border-b">
        <div className="container mx-auto max-w-7xl px-4">
          <div className="flex h-16 items-center gap-6">
            {/* Logo, nav, user menu */}
          </div>
        </div>
      </header>

      {/* Search row - sticky on desktop, scrolls on mobile */}
      <div
        className={cn(
          // Base: full width container with background
          "bg-background border-b",
          // Desktop: sticky below header, with shadow when scrolled
          "md:sticky md:top-16 md:z-40",
          "md:transition-shadow md:duration-200",
          isScrolled && "md:shadow-md",
          // Mobile: not sticky, can use scroll-away behavior
          "sticky top-16 z-40" // or remove sticky on mobile entirely
        )}
      >
        <div className="container mx-auto max-w-7xl px-4 py-3">
          <SearchBar />
        </div>
      </div>

      {/* Page content */}
      <main className="container mx-auto max-w-7xl px-4">
        {/* Content */}
      </main>
    </div>
  )
}
```

### Recent Searches with localStorage
```tsx
// Source: https://medium.com/@tantowi17/how-to-implement-recent-search-with-localstorage-in-a-website-8efdd861d5b4
// Source: https://blog.logrocket.com/localstorage-javascript-complete-guide/

const STORAGE_KEY = 'matrummet-recent-searches'
const MAX_SEARCHES = 5

export function useRecentSearches() {
  const [searches, setSearches] = useState<string[]>([])

  // Load on mount (client-side only)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        setSearches(JSON.parse(stored))
      }
    } catch (error) {
      console.error('Failed to load recent searches:', error)
    }
  }, [])

  const addSearch = useCallback((term: string) => {
    if (!term.trim()) return

    try {
      setSearches((prev) => {
        // Remove duplicates (case-insensitive)
        const filtered = prev.filter(
          (s) => s.toLowerCase() !== term.trim().toLowerCase()
        )

        // Add to beginning, limit to MAX_SEARCHES
        const updated = [term.trim(), ...filtered].slice(0, MAX_SEARCHES)

        // Save to localStorage
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))

        return updated
      })
    } catch (error) {
      console.error('Failed to save recent search:', error)
    }
  }, [])

  const removeSearch = useCallback((term: string) => {
    try {
      setSearches((prev) => {
        const filtered = prev.filter((s) => s !== term)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
        return filtered
      })
    } catch (error) {
      console.error('Failed to remove recent search:', error)
    }
  }, [])

  const clearAll = useCallback(() => {
    try {
      setSearches([])
      localStorage.removeItem(STORAGE_KEY)
    } catch (error) {
      console.error('Failed to clear recent searches:', error)
    }
  }, [])

  return { searches, addSearch, removeSearch, clearAll }
}
```

### Recent Searches Dropdown with Radix Popover
```tsx
// Source: https://www.radix-ui.com/primitives/docs/components/popover
// Source: https://www.dhiwise.com/post/a-developer's-handbook-to-radix-popover-components

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Search, X } from 'lucide-react'

export function SearchBarWithRecent() {
  const [inputValue, setInputValue] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const { searches, addSearch, removeSearch, clearAll } = useRecentSearches()

  // Show recent searches when focused, empty, and has searches
  const showRecent = isFocused && inputValue === '' && searches.length > 0

  const handleSearch = (term: string) => {
    if (term.trim()) {
      addSearch(term)
      // Navigate to search results...
    }
  }

  return (
    <Popover open={showRecent}>
      <PopoverTrigger asChild>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <input
            type="search"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSearch(inputValue)
              }
            }}
            placeholder="Sök recept..."
            className="h-12 w-full pl-10 pr-4 text-base rounded-lg border border-border focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[--radix-popover-trigger-width] p-2"
        onOpenAutoFocus={(e) => e.preventDefault()} // Keep focus on input
      >
        <div className="space-y-1">
          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
            Senaste sökningar
          </div>

          {searches.map((term) => (
            <div
              key={term}
              className="flex items-center justify-between gap-2 px-2 py-1.5 rounded hover:bg-muted"
            >
              <button
                onClick={() => {
                  setInputValue(term)
                  handleSearch(term)
                }}
                className="flex-1 text-left text-sm"
              >
                {term}
              </button>
              <button
                onClick={() => removeSearch(term)}
                className="p-1 rounded hover:bg-background"
                aria-label={`Ta bort "${term}"`}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}

          <button
            onClick={clearAll}
            className="w-full px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded hover:bg-muted"
          >
            Rensa alla
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
```

### Mobile Scroll-Away Behavior
```tsx
// Source: https://www.codemzy.com/blog/react-sticky-header-disappear-scroll
// Source: https://dev.to/dalalrohit/sticky-navbar-from-scratch-using-react-37d5

export function SearchRowWithScrollAway() {
  const [isHidden, setIsHidden] = useState(false)
  const lastScrollY = useRef(0)

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      const THRESHOLD = 50 // pixels before hiding

      // Only apply on mobile (let CSS handle desktop)
      if (window.innerWidth < 768) {
        if (currentScrollY > THRESHOLD && currentScrollY > lastScrollY.current) {
          // Scrolling down past threshold - hide
          setIsHidden(true)
        } else if (currentScrollY < lastScrollY.current) {
          // Scrolling up - show immediately
          setIsHidden(false)
        }
      }

      lastScrollY.current = currentScrollY
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div
      className={cn(
        // Base styles
        "sticky top-16 z-40 bg-background border-b",
        // Smooth transition
        "transition-transform duration-300",
        // Mobile: hide by translating up
        isHidden && "-translate-y-full md:translate-y-0"
      )}
    >
      <div className="container mx-auto max-w-7xl px-4 py-3">
        <SearchBar />
      </div>
    </div>
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| position: fixed with JS scroll position | position: sticky with native CSS | ~2017-2018 (when Safari added support) | Better performance, simpler code, no JS needed for basic sticky |
| Class components with this.setState | Function components with hooks | React 16.8 (2019) | Cleaner scroll listener code with useEffect |
| Throttle/debounce every scroll handler | { passive: true } event option + CSS transitions | ~2019 (Chrome 51+) | Better scroll performance without throttling |
| Manual dropdown positioning | Floating UI / Radix Popover | ~2021-2022 | Handles collision detection, accessibility automatically |
| Storing full search objects | Storing search terms only | Ongoing best practice | Reduces localStorage quota usage |

**Deprecated/outdated:**
- **JS-based sticky polyfills:** position: sticky is now supported in all modern browsers (97%+), no polyfill needed
- **jQuery scroll plugins:** React hooks provide cleaner, more performant scroll detection
- **Component-scoped localStorage helpers:** React hooks (useEffect) make localStorage integration straightforward

## Open Questions

Things that couldn't be fully resolved:

1. **Optimal scroll threshold for mobile search hide**
   - What we know: Common values are 50-100px, prevents micro-scroll triggers
   - What's unclear: User testing needed to find sweet spot for this specific app
   - Recommendation: Start with 50px, iterate based on user feedback; make it a constant for easy tuning

2. **Recent searches limit**
   - What we know: 5-10 items is standard practice
   - What's unclear: Whether users need more history for recipe searches specifically
   - Recommendation: Start with 5 (fits well in dropdown without scroll), can increase to 10 if users request

3. **Search bar max-width in dedicated row**
   - What we know: Current search bar in header is `w-72` (288px / 18rem)
   - What's unclear: How much wider should it be in dedicated row (decision marked as "Claude's discretion")
   - Recommendation: Start with ~600px (max-w-xl or w-[600px]) - provides noticeable increase without looking empty on large screens

4. **Shadow timing and intensity**
   - What we know: opacity transition typical, appears when scrolled past threshold
   - What's unclear: Exact timing (200ms vs 300ms) and shadow intensity (sm vs md vs lg)
   - Recommendation: Use `shadow-md` with `transition-shadow duration-200` - matches Tailwind defaults, subtle enough to not distract

## Sources

### Primary (HIGH confidence)
- MDN Web Docs - position: sticky - https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/position
- Radix UI Primitives - Popover - https://www.radix-ui.com/primitives/docs/components/popover
- MDN Web Docs - localStorage - https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage
- Tailwind CSS - Position utilities - https://tailwindcss.com/docs/position

### Secondary (MEDIUM confidence)
- CSS-Tricks - Stacked Cards with Sticky Positioning - https://css-tricks.com/stacked-cards-with-sticky-positioning-and-a-dash-of-sass/
- Medium - Scroll Shadows in React: A Step-by-Step Guide - https://medium.com/@bagiyanliana2/scroll-shadows-in-react-a-step-by-step-guide-95ac5aafb4d6
- LogRocket - localStorage in JavaScript: A complete guide - https://blog.logrocket.com/localstorage-javascript-complete-guide/
- Medium - How to Implement Recent Search with localStorage - https://medium.com/@tantowi17/how-to-implement-recent-search-with-localstorage-in-a-website-8efdd861d5b4
- Codemzy - React sticky header disappear on scroll - https://www.codemzy.com/blog/react-sticky-header-disappear-scroll
- Pluralsight - How to Cleanup Event Listeners in React - https://www.pluralsight.com/guides/how-to-cleanup-event-listeners-react
- DhiWise - Radix Popover Components Guide - https://www.dhiwise.com/post/a-developer's-handbook-to-radix-popover-components

### Tertiary (LOW confidence)
- Mark's Maker Space - Sticky Headers that scroll with React - https://marksmakerspace.com/code/react-sticky-headers-that-scroll/
- dev.to - Sticky navbar from scratch using react - https://dev.to/dalalrohit/sticky-navbar-from-scratch-using-react-37d5

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in project, native APIs well-documented
- Architecture: HIGH - Sticky positioning and scroll listeners are mature patterns with extensive documentation
- Pitfalls: HIGH - Common issues well-documented across multiple sources
- localStorage patterns: HIGH - Standard best practices from official MDN docs and multiple tutorials

**Research date:** 2026-01-28
**Valid until:** 2026-03-28 (60 days - stable technologies, unlikely to change)
