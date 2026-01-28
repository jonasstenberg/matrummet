# Phase 4: Desktop Header Restructure - Research

**Researched:** 2026-01-28
**Domain:** React 19 / Next.js 16 horizontal navigation with Radix UI and Tailwind v4
**Confidence:** HIGH

## Summary

This phase restructures the desktop header to move five key features (Mitt skafferi, Inköpslista, Mitt hem, AI-krediter, Admin) from a user dropdown to top-level navigation items in the header row. The codebase already uses Next.js 16, React 19, Radix UI primitives, and Tailwind v4, with established patterns for active route detection (`usePathname`), admin role checking (`isAdmin`), and auth state management.

The standard approach is to render horizontal nav items between the logo and user dropdown, use `usePathname` to detect active routes, apply `aria-current="page"` for accessibility, and style active states with CSS (bottom border or background). The codebase already demonstrates this pattern in `settings-pill-nav.tsx` and `hemmet-pill-nav.tsx` for sub-navigation, which can be adapted for the main header.

For specialized UI needs: AI-krediter requires a Badge component positioned absolutely on the Sparkles icon; user representation should use initials extracted from name/email displayed in a circular container; tooltips use Radix UI's Tooltip primitive with 700ms delay; and active state indicators use a bottom border with CSS transitions.

**Primary recommendation:** Extend existing navigation patterns (usePathname for active detection, aria-current, Radix UI primitives) to the main header. Build custom Badge and Avatar components using established styling conventions (Tailwind v4 custom properties, warm color palette). Maintain the header's existing height and sticky behavior.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.1.1 | App Router navigation | Already in use; provides usePathname hook for active route detection |
| React | 19.2.3 | UI framework | Latest stable; supports modern patterns |
| Radix UI | ~1.x (various) | Headless UI primitives | Already in use for dropdowns, tooltips; accessible by default |
| Tailwind CSS | 4.1.8 | Utility-first styling | Already configured with v4 custom properties in @theme |
| lucide-react | 0.513.0 | Icon library | Already in use throughout codebase; includes Sparkles icon |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| class-variance-authority | 0.7.1 | Variant styling | Creating reusable component variants (Badge, Avatar) |
| clsx / tailwind-merge | 2.1.1 / 3.3.0 | Conditional classes | Combining dynamic class names (active states, conditional visibility) |
| next/navigation | (built-in) | Route utilities | `usePathname` for active route detection |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Radix UI Dropdown | Custom dropdown | Radix provides accessibility, keyboard nav, and focus management automatically |
| Radix UI Tooltip | title attribute | Radix provides positioning, delay control, and better accessibility |
| usePathname | useRouter | usePathname is simpler for route matching; useRouter needed only for programmatic navigation |

**Installation:**
No new packages needed - all required libraries already installed.

## Architecture Patterns

### Recommended Component Structure
```
apps/frontend/components/
├── header.tsx              # Main header (existing, will be modified)
├── mobile-menu.tsx         # Mobile drawer (existing, unchanged)
├── ui/
│   ├── badge.tsx          # Existing badge component
│   └── avatar.tsx         # NEW: User initials circle component
└── navigation-items.tsx   # OPTIONAL: Extract nav items to separate component
```

### Pattern 1: Active Route Detection
**What:** Use `usePathname` hook to compare current route against nav item hrefs
**When to use:** Every navigation component that needs active state indicators
**Example:**
```typescript
// Source: Existing pattern in settings-pill-nav.tsx and hemmet-pill-nav.tsx
'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'

export function DesktopNav() {
  const pathname = usePathname()

  const navItems = [
    { href: '/mitt-skafferi', label: 'Mitt skafferi' },
    { href: '/inkopslista', label: 'Inköpslista' },
    { href: '/hemmet', label: 'Mitt hem' },
    { href: '/krediter', label: null, icon: Sparkles }, // Icon only
    { href: '/admin/kategorier', label: 'Admin', adminOnly: true },
  ]

  return (
    <nav aria-label="Huvudnavigering">
      {navItems.map((item) => {
        const isActive = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={/* active styles */}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
```

### Pattern 2: Conditional Rendering with Admin Check
**What:** Use `isAdmin(user)` helper to conditionally render Admin nav item
**When to use:** Any UI element that should only be visible to admin users
**Example:**
```typescript
// Source: Existing pattern in header.tsx and mobile-menu.tsx
import { useAuth } from '@/components/auth-provider'
import { isAdmin } from '@/lib/is-admin'

export function DesktopNav() {
  const { user } = useAuth()

  return (
    <>
      {/* Regular nav items */}
      {isAdmin(user) && (
        <Link href="/admin/kategorier">Admin</Link>
      )}
    </>
  )
}
```

### Pattern 3: Badge on Icon with Radix UI Tooltip
**What:** Absolute positioned Badge on Sparkles icon with tooltip for discoverability
**When to use:** AI-krediter nav item showing credit count
**Example:**
```typescript
// Source: Pattern combines W3Schools notification badge + Radix UI Tooltip
import { Sparkles } from 'lucide-react'
import * as Tooltip from '@radix-ui/react-tooltip'
import { Badge } from '@/components/ui/badge'

<Tooltip.Provider delayDuration={700}>
  <Tooltip.Root>
    <Tooltip.Trigger asChild>
      <Link href="/krediter" className="relative">
        <Sparkles className="h-5 w-5" />
        <Badge className="absolute -top-1 -right-1 min-w-[1.25rem] h-5 px-1 flex items-center justify-center">
          {creditCount}
        </Badge>
      </Link>
    </Tooltip.Trigger>
    <Tooltip.Content side="bottom" sideOffset={5}>
      AI-krediter
    </Tooltip.Content>
  </Tooltip.Root>
</Tooltip.Provider>
```

### Pattern 4: Avatar with Initials
**What:** Circular container displaying user's initials extracted from name or email
**When to use:** User representation in header (replaces generic User icon)
**Example:**
```typescript
// Source: Pattern from React avatar best practices (dev.to, npm react-avatar)
function Avatar({ user }: { user: User }) {
  const getInitials = (name: string, email: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    }
    return email.slice(0, 2).toUpperCase()
  }

  const initials = getInitials(user.name || '', user.email)

  return (
    <div className="h-9 w-9 rounded-full bg-warm text-warm-foreground flex items-center justify-center text-sm font-medium">
      {initials}
    </div>
  )
}
```

### Pattern 5: Bottom Border Active Indicator with Transition
**What:** CSS bottom border that animates in using transform/transition on active nav item
**When to use:** Active state indication for horizontal navigation
**Example:**
```css
/* Source: CSS-Tricks underline animation patterns */
.nav-item {
  position: relative;
  padding-bottom: 0.5rem; /* Space for indicator */
}

.nav-item::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  background-color: var(--color-accent);
  transform: scaleX(0);
  transition: transform 0.25s ease-out;
}

.nav-item[aria-current="page"]::after {
  transform: scaleX(1);
}
```

### Anti-Patterns to Avoid
- **Using fixed positioning instead of sticky:** Breaks with scrolling, causes layout shift (CLS) issues. Use `sticky top-0` instead.
- **Hand-rolling dropdown menu without Radix:** Loses keyboard navigation, focus management, and ARIA attributes. Always use Radix DropdownMenu.
- **Comparing pathname with startsWith for active detection:** Can match multiple routes unintentionally. Use exact equality (`pathname === href`) or explicit route matching logic.
- **Rendering navigators inside client components:** Can cause navigation state isolation. The header should use auth/route hooks, not nest navigators.
- **Missing aria-current="page":** Screen readers can't identify the current page. Always add `aria-current={isActive ? 'page' : undefined}`.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dropdown menu with keyboard nav | Custom dropdown with useState and click handlers | Radix UI DropdownMenu | Handles keyboard nav (arrows, Esc), focus trapping, portal rendering, collision detection, ARIA attributes automatically |
| Tooltip on hover | title attribute or custom div with visibility | Radix UI Tooltip | Proper delay timing, keyboard focus support, positioning logic, ARIA labeling, portal rendering to avoid z-index issues |
| User initials with consistent colors | Random color per render or hardcoded color | Hash-based color generation from name | Ensures same user always gets same color; accessible contrast ratios |
| Badge positioning on icon | Manual absolute positioning with magic numbers | CSS custom properties and container patterns | Responsive across icon sizes; follows established notification badge patterns |
| Active route detection | Comparing window.location or router.asPath | usePathname() from next/navigation | Server-safe, works with App Router, updates on navigation without full page reload |

**Key insight:** Radix UI primitives handle accessibility edge cases (keyboard navigation, screen reader announcements, focus management) that are easy to miss when building custom solutions. Next.js provides navigation hooks that integrate with the App Router's prefetching and transition system.

## Common Pitfalls

### Pitfall 1: Sticky Header Layout Shift
**What goes wrong:** Using `position: fixed` or improper `overflow` on parent causes layout shifts (CLS) or breaks sticky behavior
**Why it happens:** `overflow: hidden` on ancestor creates new scroll container, making sticky relative to that container instead of viewport. Fixed positioning removes element from flow, causing content jump.
**How to avoid:** Use `position: sticky` instead of fixed. If overflow needed, use `overflow-x: clip` instead of `overflow: hidden` to avoid breaking sticky context.
**Warning signs:** Header "jumps" on scroll, or content appears underneath header unexpectedly. Check if parent elements have overflow properties.

### Pitfall 2: Missing aria-current for Active State
**What goes wrong:** Visual active indicator exists but screen readers can't detect which page is current
**Why it happens:** Developers rely only on CSS classes or data attributes without adding proper ARIA attributes
**How to avoid:** Always add `aria-current="page"` to the active nav link. This is separate from visual styling.
**Warning signs:** Accessibility audit tools flag "current page not identified" or screen reader testing doesn't announce current location.

### Pitfall 3: Badge Not Positioned Correctly Across Sizes
**What goes wrong:** Badge overlaps icon incorrectly, gets cut off, or doesn't scale responsively
**Why it happens:** Using fixed pixel values for positioning instead of relative units or transform properties
**How to avoid:** Use negative positioning values (`-top-1 -right-1` in Tailwind) and flexbox centering for badge content. Ensure parent has `position: relative`.
**Warning signs:** Badge alignment breaks on different screen sizes or with different icon sizes. Test with single-digit and double-digit numbers.

### Pitfall 4: Tooltip Doesn't Show on Keyboard Focus
**What goes wrong:** Tooltip appears on hover but not when user tabs to the element
**Why it happens:** Using custom hover-only solutions or improper trigger element setup
**How to avoid:** Use Radix UI Tooltip with `asChild` on Trigger, ensuring the trigger is a focusable element (button or link). Radix handles focus automatically.
**Warning signs:** Keyboard users can't see tooltip content. Test by tabbing through navigation without using mouse.

### Pitfall 5: Admin Nav Item Visible Before Auth State Loaded
**What goes wrong:** Admin link briefly appears for all users, then disappears once auth loads (visual flash)
**Why it happens:** Conditional rendering based on user state that loads asynchronously
**How to avoid:** The auth provider already handles this via context. Ensure the header is client component and wraps in Suspense if needed. Consider showing skeleton state during initial load.
**Warning signs:** Brief flash of admin link for non-admin users on page load. Check Network tab for delayed auth requests.

### Pitfall 6: Underline Indicator Causes Layout Shift
**What goes wrong:** Adding bottom border on active state increases element height, shifting layout
**Why it happens:** Border added without reserving space, or using border instead of pseudo-element
**How to avoid:** Use `::after` pseudo-element positioned absolutely within the nav item, or reserve space with consistent padding-bottom. Animate transform, not height.
**Warning signs:** Content below navigation "jumps" when navigating between pages. Check CLS metrics in Lighthouse.

## Code Examples

Verified patterns from official sources and existing codebase:

### Active Navigation Link with Underline
```typescript
// Source: Combination of existing pill-nav pattern + CSS-Tricks underline animation
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

interface NavItem {
  href: string
  label: string
}

const navItems: NavItem[] = [
  { href: '/mitt-skafferi', label: 'Mitt skafferi' },
  { href: '/inkopslista', label: 'Inköpslista' },
  { href: '/hemmet', label: 'Mitt hem' },
]

export function DesktopNavItems() {
  const pathname = usePathname()

  return (
    <>
      {navItems.map((item) => {
        const isActive = pathname === item.href

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'relative px-3 py-2 text-sm font-medium transition-colors',
              'hover:bg-muted/50 rounded-md',
              'after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[3px] after:bg-accent',
              'after:transition-transform after:duration-200 after:ease-out',
              isActive ? 'text-foreground after:scale-x-100' : 'text-muted-foreground after:scale-x-0'
            )}
            aria-current={isActive ? 'page' : undefined}
          >
            {item.label}
          </Link>
        )
      })}
    </>
  )
}
```

### AI-krediter Icon with Badge and Tooltip
```typescript
// Source: Radix UI Tooltip docs + W3Schools notification badge pattern
import { Sparkles } from 'lucide-react'
import Link from 'next/link'
import * as Tooltip from '@radix-ui/react-tooltip'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface AICreditsNavProps {
  credits: number
  isActive: boolean
}

export function AICreditsNav({ credits, isActive }: AICreditsNavProps) {
  return (
    <Tooltip.Provider delayDuration={700}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <Link
            href="/krediter"
            className={cn(
              'relative px-3 py-2 rounded-md transition-colors',
              'hover:bg-muted/50',
              'after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[3px] after:bg-accent',
              'after:transition-transform after:duration-200 after:ease-out',
              isActive ? 'after:scale-x-100' : 'after:scale-x-0'
            )}
            aria-current={isActive ? 'page' : undefined}
            aria-label={`AI-krediter (${credits} krediter kvar)`}
          >
            <Sparkles className="h-5 w-5 text-muted-foreground" />
            <Badge
              className="absolute -top-1 -right-1 min-w-[1.25rem] h-5 px-1.5 text-xs"
              variant="default"
            >
              {credits}
            </Badge>
          </Link>
        </Tooltip.Trigger>
        <Tooltip.Content
          side="bottom"
          sideOffset={8}
          className="bg-popover text-popover-foreground px-3 py-2 text-sm rounded-md shadow-md border border-border"
        >
          AI-krediter
        </Tooltip.Content>
      </Tooltip.Root>
    </Tooltip.Provider>
  )
}
```

### User Avatar with Initials
```typescript
// Source: React avatar best practices (dev.to, npm react-avatar)
import { User } from '@/lib/types'

interface UserAvatarProps {
  user: User
  className?: string
}

export function UserAvatar({ user, className }: UserAvatarProps) {
  // Extract initials from name or email
  const getInitials = () => {
    if (user.name && user.name.trim()) {
      const parts = user.name.trim().split(/\s+/)
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      }
      return parts[0].slice(0, 2).toUpperCase()
    }
    return user.email.slice(0, 2).toUpperCase()
  }

  const initials = getInitials()

  return (
    <div
      className={cn(
        'h-9 w-9 rounded-full bg-warm text-warm-foreground',
        'flex items-center justify-center text-sm font-medium',
        'select-none',
        className
      )}
      aria-label={user.name || user.email}
    >
      {initials}
    </div>
  )
}
```

### Complete Desktop Header Structure
```typescript
// Source: Synthesis of patterns above + existing header.tsx structure
'use client'

import { useAuth } from '@/components/auth-provider'
import { isAdmin } from '@/lib/is-admin'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { ChefHat } from 'lucide-react'
import { UserAvatar } from './user-avatar'
import { AICreditsNav } from './ai-credits-nav'
import { DesktopNavItems } from './desktop-nav-items'

export function Header() {
  const { user, logout } = useAuth()
  const pathname = usePathname()

  if (!user) {
    return /* logged out header */
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto max-w-7xl px-4">
        <div className="flex h-16 items-center justify-between gap-6">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 flex-shrink-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warm">
              <ChefHat className="h-5 w-5 text-warm-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="font-heading text-xl font-semibold text-foreground">
                Matrummet&apos;s
              </span>
              <span className="text-xs font-medium tracking-[0.2em] text-warm">
                RECEPT
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Items */}
          <nav aria-label="Huvudnavigering" className="hidden md:flex items-center gap-2">
            <DesktopNavItems />
            <AICreditsNav
              credits={user.credits || 0}
              isActive={pathname === '/krediter'}
            />
            {isAdmin(user) && (
              <Link
                href="/admin/kategorier"
                className={/* active styles */}
                aria-current={pathname.startsWith('/admin') ? 'page' : undefined}
              >
                Admin
              </Link>
            )}
          </nav>

          {/* User Dropdown */}
          <div className="hidden md:flex items-center">
            {/* Dropdown trigger with UserAvatar */}
          </div>
        </div>
      </div>
    </header>
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| useRouter().pathname | usePathname() | Next.js 13+ (App Router) | Simpler API, works in Server Components (when not using hooks), better TypeScript support |
| Custom dropdowns with useState | Radix UI primitives | Radix stable ~2021-2022 | Accessibility built-in, less code to maintain, better keyboard navigation |
| Inline active styles | CVA (class-variance-authority) | CVA 0.7+ (2023+) | Type-safe variants, better component API, easier to maintain |
| text-decoration: underline | transform: scaleX() on ::after | Modern CSS (2020+) | Smoother animations, more control over underline appearance and position |
| Tailwind v3 config.js | Tailwind v4 @theme in CSS | Tailwind v4 (2024) | Faster builds, CSS variables accessible in calc(), no JS configuration |

**Deprecated/outdated:**
- **useRouter() for pathname only**: In App Router, use `usePathname()` instead. `useRouter()` should only be used when you need programmatic navigation (push, replace).
- **Fixed positioning for headers**: Modern approach uses `position: sticky` to avoid layout shifts and maintain document flow.
- **title attribute for tooltips**: Use Radix UI Tooltip for better positioning, delay control, and accessibility (keyboard focus support).

## Open Questions

Things that couldn't be fully resolved:

1. **Credit count data fetching strategy**
   - What we know: User object likely contains credit count; need to verify exact field name and type
   - What's unclear: Whether credits are part of the user context or need separate fetch; how often to refetch
   - Recommendation: Check `lib/types.ts` for User type definition. If credits not in user context, add to AuthProvider or fetch separately in header.

2. **Admin route prefix consistency**
   - What we know: Admin link points to `/admin/kategorier`; need to detect active state for all admin routes
   - What's unclear: Whether `pathname.startsWith('/admin')` is sufficient or if there are edge cases
   - Recommendation: Use `pathname.startsWith('/admin')` for admin nav item active state, since all admin routes share this prefix.

3. **Hover state vs active state interaction**
   - What we know: Design calls for subtle background on hover (pill/chip effect) and bottom border for active
   - What's unclear: Should hover effect appear on active item, or should active item have no hover effect?
   - Recommendation: Show hover effect on all items including active (compound visual feedback is conventional).

4. **Mobile breakpoint for nav visibility**
   - What we know: Existing code uses `md:flex` (768px) for desktop nav visibility
   - What's unclear: Whether all 5 nav items + icons + user fit within header at 768px width
   - Recommendation: Test at 768px with longest Swedish text labels. If overflow, consider moving breakpoint to `lg:flex` (1024px).

## Sources

### Primary (HIGH confidence)
- Next.js App Router documentation - [usePathname API](https://nextjs.org/docs/app/api-reference/functions/use-pathname)
- Radix UI Primitives - [Dropdown Menu](https://www.radix-ui.com/primitives/docs/components/dropdown-menu)
- Radix UI Primitives - [Tooltip](https://www.radix-ui.com/primitives/docs/components/tooltip)
- Existing codebase patterns:
  - `apps/frontend/components/settings-pill-nav.tsx` - Active route detection with usePathname
  - `apps/frontend/components/hemmet-pill-nav.tsx` - Navigation item styling and aria-current usage
  - `apps/frontend/components/header.tsx` - Current header structure and auth integration
  - `apps/frontend/lib/is-admin.ts` - Admin role checking
  - `apps/frontend/app/globals.css` - Tailwind v4 theme configuration with color palette

### Secondary (MEDIUM confidence)
- [W3C ARIA navigation role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/navigation_role) - Accessible navigation patterns
- [CSS-Tricks Animating Underlines](https://css-irl.info/animating-underlines/) - Underline animation techniques
- [Tobias Ahlin Link Underlines](https://tobiasahlin.com/blog/css-trick-animating-link-underlines/) - Transform-based underline animations
- [W3Schools Notification Badge](https://www.w3schools.com/howto/howto_css_notification_button.asp) - Badge positioning patterns
- [Material Tailwind Badge](https://www.material-tailwind.com/docs/html/badge) - Tailwind badge examples
- [DEV.to React Avatar with Initials](https://dev.to/surbhidighe/creating-stylish-initial-based-avatars-in-react-277j) - Avatar component patterns

### Tertiary (LOW confidence)
- WebSearch findings about Next.js 16 features - Some sources mention features not yet in official docs; verify against official Next.js documentation when implementing
- WebSearch findings about Tailwind v4 patterns - Community examples may use pre-release syntax; cross-reference with official Tailwind v4 release notes

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed and in use; versions verified from package.json
- Architecture: HIGH - Patterns extracted from existing codebase components; official Radix UI documentation verified
- Pitfalls: MEDIUM - Based on official documentation and common issues; some pitfalls are WebSearch-sourced but verified with multiple sources

**Research date:** 2026-01-28
**Valid until:** 2026-02-28 (30 days - stable technologies, Next.js 16 and React 19 are current stable versions)
