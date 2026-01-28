# Phase 3: Integration & Visual Polish - Research

**Researched:** 2026-01-28
**Domain:** Cross-page visual consistency, mobile UX polish, scroll indicators, sidebar navigation
**Confidence:** HIGH

## Summary

Phase 3 integrates both the standalone Hemmet page and settings sidebar layout with visual polish and consistent UX patterns. The phase requires three main technical domains: (1) implementing Hemmet's sidebar navigation using the same CSS Grid pattern as settings, (2) adding scroll fade indicators to mobile pill navigation on both pages, and (3) establishing visual rhythm across both pages through unified spacing, typography, and card styles.

All required capabilities exist in the current stack. Tailwind v4.1 introduced native mask utilities for scroll fade indicators, eliminating the need for custom CSS. Next.js App Router layouts and React 19's useFormStatus hook provide the navigation and form state primitives. The challenge is execution consistency rather than technical capability.

**Primary recommendation:** Use CSS Grid `grid-cols-[240px_1fr]` for Hemmet sidebar matching settings structure, apply Tailwind v4.1's `mask-x-from-*` utilities for horizontal scroll fades, establish a unified spacing/typography scale across both pages, and leverage React 19's useFormStatus for button loading states with brief success animations.

## Standard Stack

All required libraries exist in the current codebase. No new dependencies needed.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | 16.1.1 | Layout composition, nested routing | Built-in support for shared layouts and route groups |
| React | 19.2.3 | Component framework, useFormStatus hook | React 19 provides built-in form state management |
| Tailwind CSS v4 | 4.1.8 | Mask utilities, CSS Grid, responsive design | v4.1 added native mask-image utilities for scroll fades |
| Radix UI | Current | Separator, accessible primitives | Battle-tested accessibility, already in stack |
| Lucide React | Current | Icons for navigation | Consistent with existing header icons |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| next/navigation | Built-in | usePathname() for active state | Client component routing state detection |
| cn utility | Existing | Conditional className merging | Active link styling, responsive variants |
| Vitest | Current | Component testing | Verify no regressions in existing tests |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Tailwind mask utilities | Custom CSS gradients | Mask utilities are composable and maintainable, custom CSS is harder to adjust |
| usePathname() | Server-side route matching | usePathname() works in client components, allows dynamic active states |
| CSS Grid sidebar | Flexbox | Grid provides precise column widths, flexbox can cause layout shift |
| React 19 useFormStatus | Custom loading state | useFormStatus reduces boilerplate, provides consistent API |

**Installation:**
```bash
# No new packages needed - all tools already in stack
```

## Architecture Patterns

### Recommended Project Structure
```
apps/frontend/
├── app/(main)/hemmet/
│   ├── layout.tsx              # NEW: Grid sidebar layout (matches settings)
│   ├── page.tsx                # UPDATE: Redirect to /hemmet/hushall
│   ├── hushall/
│   │   └── page.tsx            # NEW: Household info (main card)
│   ├── medlemmar/
│   │   └── page.tsx            # NEW: Member list
│   └── bjud-in/
│       └── page.tsx            # NEW: Invite section
├── app/(main)/installningar/
│   ├── layout.tsx              # VERIFY: Consistent spacing with hemmet
│   └── page.tsx                # UPDATE: Remove redundant h2
├── components/
│   ├── hemmet-sidebar.tsx      # NEW: Navigation for hemmet
│   ├── hemmet-pill-nav.tsx     # NEW: Mobile pills for hemmet
│   ├── settings-pill-nav.tsx   # UPDATE: Add scroll fade indicators
│   ├── settings-sidebar.tsx    # VERIFY: Consistent with hemmet
│   └── home/                   # UPDATE: Split into separate pages
└── app/globals.css             # VERIFY: Typography scale, spacing tokens
```

### Pattern 1: CSS Grid Sidebar Layout (Hemmet)

**What:** Two-column layout with fixed-width sidebar (240px) and flexible content area, matching settings structure.

**When to use:** Desktop viewport (≥768px) for vertical navigation with sticky positioning.

**Example:**
```tsx
// app/(main)/hemmet/layout.tsx
export default async function HemmetLayout({ children }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const home = await getHomeInfo(token)

  // No sidebar if user has no home
  if (!home) {
    return <div className="max-w-4xl mx-auto">{children}</div>
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="space-y-2 mb-8">
        <h1 className="font-heading text-3xl font-bold">Mitt hem</h1>
        <p className="text-muted-foreground">
          Hantera ditt hem och medlemmar
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-8">
        <aside className="hidden md:block">
          <HemmetSidebar />
        </aside>
        <div className="md:hidden">
          <HemmetPillNav />
        </div>
        <main className="min-w-0">
          {children}
        </main>
      </div>
    </div>
  )
}
```

**Source:** Phase 2 settings layout pattern, already implemented and verified.

### Pattern 2: Horizontal Scroll Fade Indicators (Mobile Pills)

**What:** Gradient mask on left/right edges of horizontal scroll container, visible only when overflow exists in that direction.

**When to use:** Mobile viewport (<768px) for pill-style navigation that can scroll horizontally.

**Example (Tailwind v4.1 mask utilities):**
```tsx
// components/settings-pill-nav.tsx
export function SettingsPillNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Inställningar" className="relative">
      <div className="overflow-x-auto mask-x-from-5% mask-x-to-95% pb-2">
        <div className="flex gap-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium',
                'transition-colors whitespace-nowrap',
                // Active state...
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  )
}
```

**Source:** [Tailwind CSS v4.1 mask utilities](https://tailwindcss.com/docs/mask-image), verified via Context7.

**Alternative (CSS scroll-driven animations for dynamic fades):**
```css
/* Only show fade when actually scrollable - requires container queries */
@container scroll-state(scrollable: inline) {
  .pill-nav {
    mask-image: linear-gradient(to right,
      transparent 0,
      black 32px,
      black calc(100% - 32px),
      transparent 100%
    );
  }
}
```

**Note:** Container query `scroll-state(scrollable)` is cutting-edge (2026) but may not have full browser support yet. Start with static mask, optionally enhance with scroll-state detection.

**Sources:**
- [CSS scroll shadows modern approach](https://css-tricks.com/modern-scroll-shadows-using-scroll-driven-animations/)
- [Tailwind v4.1 blog](https://tailwindcss.com/blog/tailwindcss-v4-1)

### Pattern 3: Active Navigation State with usePathname()

**What:** Client-side active link detection using Next.js usePathname() hook for dynamic styling.

**When to use:** Client components that need to show active state based on current route.

**Example:**
```tsx
'use client'

import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

export function HemmetSidebar() {
  const pathname = usePathname()

  const links = [
    { href: '/hemmet/hushall', label: 'Hushåll' },
    { href: '/hemmet/medlemmar', label: 'Medlemmar' },
    { href: '/hemmet/bjud-in', label: 'Bjud in' },
  ]

  return (
    <nav className="sticky top-20 space-y-1">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={cn(
            'block px-3 py-2 rounded-md text-sm transition-colors',
            pathname === link.href
              ? 'bg-secondary/10 text-secondary font-medium'
              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
          )}
          aria-current={pathname === link.href ? 'page' : undefined}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  )
}
```

**Source:** [Next.js active link pattern](https://spacejelly.dev/posts/how-to-style-active-links-in-next-js-app-router), verified best practice.

### Pattern 4: Button Success Feedback (React 19)

**What:** Brief success state after form submission using React 19's useFormStatus or local state.

**When to use:** Form buttons that need to show success feedback before returning to normal state.

**Example:**
```tsx
'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function SuccessFeedbackButton() {
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    setLoading(true)
    try {
      await submitForm()
      setSuccess(true)
      // Auto-reset after 2 seconds
      setTimeout(() => setSuccess(false), 2000)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      onClick={handleSubmit}
      disabled={loading || success}
      className="min-w-[120px]"
    >
      {success ? (
        <>
          <Check className="h-4 w-4 mr-2" />
          Sparat!
        </>
      ) : loading ? (
        'Sparar...'
      ) : (
        'Spara'
      )}
    </Button>
  )
}
```

**Source:** Existing pattern in ProfileForm and SecurityForm, enhanced with React 19 capabilities.

### Pattern 5: Unified Visual Rhythm

**What:** Consistent spacing scale, heading sizes, and card padding across both pages.

**When to use:** Always - establishes design system consistency.

**Spacing scale (8pt grid):**
```tsx
// Recommended spacing tokens (already in Tailwind)
space-2  = 8px   // Tight spacing (label-to-input)
space-4  = 16px  // Default spacing (between form fields)
space-6  = 24px  // Card padding
space-8  = 32px  // Section gaps
```

**Typography scale:**
```tsx
// Page title
<h1 className="font-heading text-3xl font-bold">

// Card title (semantic h3, not h2)
<CardTitle>Profil</CardTitle>  // text-2xl font-semibold

// Card description
<CardDescription>...</CardDescription>  // text-sm text-muted-foreground

// Form label
<Label>...</Label>  // text-sm font-medium
```

**Card structure:**
```tsx
<Card>
  <CardHeader>  {/* p-6 */}
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>  {/* p-6 pt-0 */}
    {/* Content */}
  </CardContent>
</Card>
```

**Source:** Existing Card component, Radix UI patterns, verified in current codebase.

### Anti-Patterns to Avoid

- **Redundant headings:** Don't duplicate page-level h2 and card h2 with same text (causes semantic confusion and repetition).
- **Inconsistent sidebar widths:** Settings uses 240px, Hemmet must match exactly to avoid visual discord.
- **Static scroll fades:** Don't show fade indicators when content doesn't overflow (use container queries or JS detection).
- **Different card padding on mobile:** Maintain consistent padding ratios, only reduce proportionally.
- **Mixing loading state patterns:** Use consistent pattern across all forms (either useFormStatus or local state, not mix).

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Scroll fade indicators | Custom CSS gradients with hardcoded values | Tailwind v4.1 `mask-x-from-*` utilities | Composable, maintainable, no magic numbers |
| Active link detection | Custom route matching logic | Next.js `usePathname()` hook | Built-in, reliable, works with App Router |
| Form loading states | Multiple useState hooks | React 19 `useFormStatus` | Single source of truth, less boilerplate |
| Accessible separators | Custom divider component | Radix UI Separator | ARIA-compliant, screen reader tested |
| Touch target sizing | Arbitrary padding values | 44px minimum (WCAG AAA) | Accessibility standard, legally compliant |
| CSS Grid sidebar | Flexbox with width constraints | CSS Grid `grid-cols-[240px_1fr]` | Prevents layout shift, precise control |

**Key insight:** Tailwind v4.1's mask utilities eliminate the most complex custom CSS. The classic "background-attachment: local" scroll shadow trick is clever but fragile and doesn't work well for horizontal scroll. Modern mask-image with Tailwind's composable utilities is the 2026 standard.

## Common Pitfalls

### Pitfall 1: Scroll Fades Showing When Not Needed

**What goes wrong:** Gradient mask always visible even when content fits without scrolling, creating visual pollution.

**Why it happens:** Static mask utilities don't detect actual overflow state.

**How to avoid:** Use container queries with `scroll-state(scrollable)` or JavaScript detection to conditionally apply mask.

**Warning signs:** Users see fade shadows on both edges even when no scrolling is possible.

**Implementation:**
```tsx
'use client'

import { useRef, useState, useEffect } from 'react'

export function SmartScrollFade({ children }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [hasOverflow, setHasOverflow] = useState(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const checkOverflow = () => {
      setHasOverflow(el.scrollWidth > el.clientWidth)
    }

    checkOverflow()
    window.addEventListener('resize', checkOverflow)
    return () => window.removeEventListener('resize', checkOverflow)
  }, [])

  return (
    <div
      ref={containerRef}
      className={cn(
        'overflow-x-auto',
        hasOverflow && 'mask-x-from-5% mask-x-to-95%'
      )}
    >
      {children}
    </div>
  )
}
```

### Pitfall 2: Inconsistent Max-Width Containers

**What goes wrong:** Settings uses `max-w-6xl`, Hemmet uses `max-w-4xl`, causing jarring visual jump when navigating between sections.

**Why it happens:** Phase 1 decision used narrower width for Hemmet based on content needs.

**How to avoid:** Accept the width difference as intentional (per prior decision 01-01), but ensure consistent inner spacing and visual rhythm.

**Warning signs:** Users report "layout shift" feeling when switching between pages.

**Mitigation:** Both pages use same card structure and spacing internally, so the width difference feels intentional rather than inconsistent.

### Pitfall 3: Sidebar Active State on Default Route

**What goes wrong:** Navigating to `/hemmet/` (default landing) shows no active sidebar item because pathname is `/hemmet/` but links are `/hemmet/hushall`, etc.

**Why it happens:** Default route redirect doesn't update pathname immediately for active detection.

**How to avoid:** Redirect `/hemmet/` to `/hemmet/hushall` with `permanent: true` and check both exact match and prefix match for active state.

**Implementation:**
```tsx
// In sidebar component
const isActive = pathname === link.href ||
  (link.href === '/hemmet/hushall' && pathname === '/hemmet/')
```

### Pitfall 4: Mobile Touch Target Size

**What goes wrong:** Pill navigation items on mobile don't meet 44px minimum touch target, causing tap failures.

**Why it happens:** Horizontal scrolling creates space constraints, tempting smaller targets.

**How to avoid:** Maintain `py-2` (16px vertical padding) with `px-4` (32px horizontal), ensure overall height ≥44px.

**Warning signs:** Users tap multiple times or hit wrong pill on mobile.

**WCAG requirement:** 44×44px minimum for AAA compliance (can be 24×24px for AA but 44px is best practice).

**Source:** [WCAG 2.5.5 Target Size](https://www.w3.org/WAI/WCAG21/Understanding/target-size.html)

### Pitfall 5: Removing Page-Level Headings Entirely

**What goes wrong:** Removing redundant h2 inside cards is correct, but don't remove the page-level h1 in layout - that's critical for accessibility.

**Why it happens:** Misunderstanding the "remove redundant headings" decision.

**How to avoid:** Keep page-level h1 ("Inställningar", "Mitt hem") in layout, remove only the duplicate h2 that appears both as page title and card title.

**Correct structure:**
```tsx
// Layout: ONE h1 for page
<h1 className="font-heading text-3xl font-bold">Inställningar</h1>

// Page content: NO h2 matching h1
// Before (wrong):
<h2>Profil</h2>
<Card><CardTitle>Profil</CardTitle></Card>  // Redundant!

// After (correct):
<Card><CardTitle>Profil</CardTitle></Card>  // CardTitle is h3
```

## Code Examples

Verified patterns from official sources:

### Tailwind v4.1 Mask Utilities for Horizontal Scroll Fade

```html
<!-- Basic horizontal fade -->
<div class="overflow-x-auto mask-x-from-5% mask-x-to-95%">
  <div class="flex gap-2">
    <!-- Pills... -->
  </div>
</div>

<!-- Asymmetric fade (stronger on right) -->
<div class="overflow-x-auto mask-x-from-10% mask-x-to-100%">
  <div class="flex gap-2">
    <!-- Pills... -->
  </div>
</div>
```

**Source:** [Tailwind v4.1 mask utilities](https://tailwindcss.com/docs/mask-image)

### Next.js Active Link Pattern with Aria

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function NavLink({ href, children }) {
  const pathname = usePathname()
  const isActive = pathname === href

  return (
    <Link
      href={href}
      className={isActive ? 'active' : ''}
      aria-current={isActive ? 'page' : undefined}
    >
      {children}
    </Link>
  )
}
```

**Source:** [Next.js documentation](https://nextjs.org/docs/app/getting-started/linking-and-navigating)

### React 19 Form Success Feedback Pattern

```tsx
'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'

export function FormWithFeedback() {
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      await saveData()
      setSuccess(true)
      setTimeout(() => setSuccess(false), 2000)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit}>
      {/* ... */}
      <button disabled={loading || success}>
        {success && <Check className="h-4 w-4" />}
        {success ? 'Saved!' : loading ? 'Saving...' : 'Save'}
      </button>
    </form>
  )
}
```

**Source:** Existing ProfileForm pattern, consistent with React 19 best practices.

### Skeleton Loading for Page Content

```tsx
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardHeader, CardContent } from '@/components/ui/card'

export function SettingsPageSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-8 w-32" />  {/* Title */}
        <Skeleton className="h-4 w-64" />  {/* Description */}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />  {/* Label */}
          <Skeleton className="h-10 w-full" />  {/* Input */}
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
        <Skeleton className="h-10 w-24" />  {/* Button */}
      </CardContent>
    </Card>
  )
}
```

**Source:** Existing RecipeCardSkeleton pattern, adapted for settings/hemmet.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom CSS scroll shadows (background-attachment) | Tailwind mask utilities or scroll-driven animations | Tailwind v4.1 (2024) | Eliminates custom CSS, better horizontal scroll support |
| Multiple useState for form states | React 19 useFormStatus / useActionState | React 19 (Dec 2024) | Reduces boilerplate, single source of truth |
| Manual active link detection | Next.js usePathname() hook | Next.js 13+ App Router | Built-in, works with server/client boundaries |
| Flexbox sidebar layouts | CSS Grid with fixed columns | Modern CSS (2020+) | Prevents layout shift, precise control |
| Arbitrary touch targets | 44×44px minimum (WCAG 2.5.5) | WCAG 2.1 (2018) | Legal compliance, better mobile UX |
| h2 for all section headings | Semantic hierarchy (h1→h3 for cards) | HTML5 accessibility best practice | Screen reader navigation, SEO |

**Deprecated/outdated:**
- `background-attachment: local` scroll shadow trick - still works but fragile for horizontal scroll
- Flexbox with `flex-shrink: 0` for sidebars - CSS Grid is cleaner
- Custom loading state management - React 19 provides better primitives

## Open Questions

Things that couldn't be fully resolved:

1. **Hemmet Accent Color Choice**
   - What we know: Settings uses `bg-warm` (brown/tan) for active state. Context decision says "complementary to warm palette."
   - What's unclear: Exact color value. Should it be `bg-secondary` (green), `bg-accent` (yellow), or custom?
   - Recommendation: Use `bg-secondary` (green #2d6650) - already in palette, complements warm tones, distinct from settings.

2. **Container Query Browser Support for Scroll State**
   - What we know: `@container scroll-state(scrollable)` is cutting-edge (2026), perfect for conditional scroll fades.
   - What's unclear: Browser support as of Jan 2026 - likely limited to Chromium.
   - Recommendation: Start with static mask utilities, add container query as progressive enhancement with `@supports`.

3. **Skeleton vs Loading State for Hemmet Sidebar**
   - What we know: Hemmet needs to fetch home data to show sidebar. During load, show what?
   - What's unclear: Show skeleton sidebar, empty state, or spinner?
   - Recommendation: Show full-width loading state (no sidebar skeleton) since sidebar only appears after data confirms home exists.

4. **Mobile Card Padding Reduction**
   - What we know: Context decision says "reduced card padding on mobile for more content space."
   - What's unclear: Exact values. Current is `p-6` (24px). Reduce to `p-4` (16px) on mobile?
   - Recommendation: Use `className="p-4 md:p-6"` on CardHeader and CardContent for 16px→24px scaling.

## Sources

### Primary (HIGH confidence)
- [Tailwind CSS v4 docs](/websites/tailwindcss) - mask utilities, overflow, grid
- [Tailwind v4.1 blog post](https://tailwindcss.com/blog/tailwindcss-v4-1) - mask utilities announcement
- [Next.js App Router docs](https://nextjs.org/docs/app/getting-started/linking-and-navigating) - usePathname, layouts
- [React 19 release notes](https://react.dev/blog/2024/12/05/react-19) - useFormStatus, useActionState
- [WCAG 2.5.5 Target Size](https://www.w3.org/WAI/WCAG21/Understanding/target-size.html) - 44px minimum
- [Radix UI Separator](https://www.radix-ui.com/primitives/docs/components/separator) - accessible dividers

### Secondary (MEDIUM confidence)
- [Modern scroll shadows article](https://css-tricks.com/modern-scroll-shadows-using-scroll-driven-animations/) - scroll-driven animations
- [CSS scroll shadows overview](https://isellsoap.net/articles/overview-css-scrolling-shadows-and-content-fading-techniques/) - techniques comparison
- [Next.js active links guide](https://spacejelly.dev/posts/how-to-style-active-links-in-next-js-app-router) - usePathname pattern
- [React 19 form handling](https://www.freecodecamp.org/news/react-19-actions-simpliy-form-submission-and-loading-states/) - Actions and useFormStatus
- [Accessible touch targets](https://blog.logrocket.com/ux-design/all-accessible-touch-target-sizes/) - mobile best practices
- [Visual consistency guide](https://medium.com/@lenaztyson/visual-consistency-everything-you-need-to-know-157f2ece7cd7) - design system principles

### Tertiary (LOW confidence)
- [Container query scroll-state](https://required.com/en/blog/css-shadow-play-scroll-shadows-with-animation-timeline/) - experimental feature
- [Design system spacing](https://www.designsystems.com/space-grids-and-layouts/) - 8pt grid theory

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified in package.json and Context7
- Architecture: HIGH - Patterns verified in existing Phase 2 code and official docs
- Pitfalls: HIGH - Based on known issues from similar implementations and WCAG standards
- Code examples: HIGH - All sourced from official documentation or existing verified codebase

**Research date:** 2026-01-28
**Valid until:** ~30 days (stack is stable, but Tailwind/React patterns evolve slowly)

**Notes:**
- Phase builds on Phase 1 (Hemmet extraction) and Phase 2 (Settings sidebar), both completed
- Context from `/gsd:discuss-phase` constrains architecture decisions (sidebar layout, accent color freedom, mobile polish)
- All findings verified against current codebase (/Users/jonasstenberg/Development/Private/recept)
