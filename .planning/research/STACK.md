# Technology Stack: Settings Side Menu Layout

**Project:** Matrummet Settings Page Redesign
**Researched:** 2026-01-27
**Confidence:** HIGH

## Executive Summary

For building a settings side menu layout with responsive mobile navigation, the existing stack (Next.js 16 App Router, React 19, Tailwind v4, Radix UI) provides **everything needed without additional dependencies**. The current implementation already uses the Radix UI Dialog primitive (via Sheet component) for mobile menus, and Tailwind v4's responsive utilities are sufficient for desktop sidebar styling.

**Recommendation:** Use pure CSS Grid/Flexbox with Tailwind utilities for the desktop sidebar layout, and leverage the existing Sheet component pattern (already in `mobile-menu.tsx`) for mobile drawer navigation. No new dependencies required.

## Recommended Approach

### Desktop: CSS Grid/Flexbox Layout

**Technology:** Tailwind v4 utility classes
**Pattern:** Two-column grid layout with fixed sidebar
**Why:** Native CSS, zero JavaScript overhead, leverages existing Tailwind utilities

| Aspect | Implementation | Rationale |
|--------|----------------|-----------|
| **Layout Structure** | CSS Grid (`grid grid-cols-[240px_1fr]`) | Two-dimensional control, explicit sidebar width, clean responsive breakpoints |
| **Sidebar Positioning** | `sticky top-[64px]` or fixed positioning | Keeps navigation visible during scroll, aligns below header |
| **Responsive Breakpoint** | `hidden md:grid` for desktop grid, `md:hidden` for mobile stack | Mobile-first approach, stacks vertically on small screens |
| **Navigation Links** | Plain `<Link>` components with Tailwind hover states | Next.js native routing, no Radix primitive needed for simple link list |
| **Active State** | Server-side route matching with conditional classes | Accurate, works with App Router, no client-side state |

**Example Implementation Pattern:**
```tsx
// Desktop: Grid layout (md:grid hidden on mobile)
<div className="grid grid-cols-[240px_1fr] gap-8 max-w-7xl mx-auto px-4">
  {/* Sidebar - hidden on mobile */}
  <aside className="hidden md:block">
    <nav className="sticky top-20 space-y-1">
      <Link href="/installningar" className="block px-3 py-2 rounded-md hover:bg-muted">
        Profil
      </Link>
      {/* More links... */}
    </nav>
  </aside>

  {/* Content */}
  <main>{children}</main>
</div>
```

### Mobile: Sheet Component (Radix UI Dialog)

**Technology:** Existing `@radix-ui/react-dialog` (via Sheet component)
**Pattern:** Slide-out drawer from left or right edge
**Why:** Already implemented in `mobile-menu.tsx`, consistent UX with existing mobile nav

| Aspect | Implementation | Rationale |
|--------|----------------|-----------|
| **Component** | Sheet (Radix Dialog primitive) | Already in use, accessible, handles focus management |
| **Trigger Pattern** | Hamburger icon or "Settings Menu" button | Familiar mobile pattern, saves vertical space |
| **Edge Position** | `side="left"` for settings menu | Left is conventional for navigation, right is used for user menu |
| **Responsive Display** | `md:hidden` on trigger, `md:hidden` on Sheet | Only visible on mobile, hidden when sidebar shows |

**Existing Pattern to Reuse:**
The app already demonstrates this pattern in `mobile-menu.tsx` (lines 21-26):
```tsx
<Sheet open={open} onOpenChange={setOpen}>
  <SheetTrigger asChild className="md:hidden">
    <button aria-label="Öppna meny">
      <Menu className="h-6 w-6" />
    </button>
  </SheetTrigger>
  <SheetContent side="right" className="w-80">
    {/* Navigation links */}
  </SheetContent>
</Sheet>
```

### Active Route Highlighting

**Technology:** Next.js App Router + `usePathname()` hook
**Pattern:** Match current route to highlight active menu item
**Why:** Built-in, accurate, works with server and client components

```tsx
'use client'
import { usePathname } from 'next/navigation'

const pathname = usePathname()
const isActive = pathname === '/installningar/profil'

<Link
  href="/installningar/profil"
  className={cn(
    "block px-3 py-2 rounded-md transition-colors",
    isActive
      ? "bg-warm text-warm-foreground font-medium"
      : "text-muted-foreground hover:bg-muted hover:text-foreground"
  )}
>
  Profil
</Link>
```

## What NOT to Add

| Dependency | Why NOT Needed | Alternative |
|------------|----------------|-------------|
| **@radix-ui/react-navigation-menu** | Too complex for simple link lists, adds unnecessary JavaScript | Plain `<Link>` components with Tailwind hover states |
| **Accordion/Collapsible for submenu** | Settings pages rarely need nested navigation | Flat navigation structure, group related settings on same page |
| **State management library** | No shared state between sidebar and content | `usePathname()` for active state, Sheet's internal state for mobile |
| **Third-party sidebar libraries** | Existing primitives are sufficient | CSS Grid + Sheet component |
| **CSS animation libraries** | Tailwind transitions handle all needed animations | `transition-colors` for hover, Sheet has built-in slide animations |

## Responsive Strategy

### Breakpoint: `md` (768px)

**Mobile (< 768px):**
- Stack layout vertically
- Hide desktop sidebar (`hidden md:block`)
- Show hamburger menu trigger (`md:hidden`)
- Sheet drawer slides in from left edge

**Desktop (≥ 768px):**
- Two-column grid layout (`md:grid`)
- Sticky sidebar visible
- Hide mobile trigger (`md:hidden`)
- Sheet component not rendered

### Implementation Pattern

```tsx
// Layout component
export default function SettingsLayout({ children }) {
  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      {/* Mobile: Sheet trigger */}
      <MobileSettingsMenu className="md:hidden" />

      {/* Desktop: Grid layout */}
      <div className="md:grid md:grid-cols-[240px_1fr] md:gap-8">
        {/* Sidebar - hidden on mobile */}
        <SettingsSidebar className="hidden md:block" />

        {/* Content - full width on mobile, constrained on desktop */}
        <main className="mt-6 md:mt-0">
          {children}
        </main>
      </div>
    </div>
  )
}
```

## Tailwind v4 Utilities Checklist

All required utilities are available in Tailwind v4:

- [x] **Grid layouts:** `grid`, `grid-cols-[240px_1fr]`
- [x] **Responsive prefixes:** `md:grid`, `md:hidden`, `md:block`
- [x] **Sticky positioning:** `sticky top-20`
- [x] **Spacing:** `gap-8`, `space-y-1`, `px-3`, `py-2`
- [x] **Transitions:** `transition-colors`, `hover:bg-muted`
- [x] **Flexbox:** `flex flex-col` (fallback if needed)
- [x] **Border radius:** `rounded-md` (uses `--radius-md` from globals.css)
- [x] **Custom colors:** `bg-warm`, `text-warm-foreground` (defined in globals.css)

## Accessibility Considerations

### Desktop Sidebar
- Use semantic `<nav>` element with `aria-label="Settings navigation"`
- Current page link should have `aria-current="page"`
- Maintain logical tab order (sidebar before content)

### Mobile Sheet
- Already handled by Radix Dialog primitive:
  - Focus trap when open
  - Esc key closes drawer
  - Overlay click closes drawer
  - Screen reader announcements
- Trigger button needs descriptive `aria-label="Open settings menu"`

## Integration with Existing Patterns

### Consistent with Current App

1. **Mobile Menu Pattern** (`mobile-menu.tsx`):
   - Already uses Sheet with `side="right"` for user menu
   - Settings menu can use `side="left"` for distinction
   - Same `open`/`setOpen` state pattern

2. **Header Pattern** (`header.tsx`):
   - Desktop dropdown menu uses manual state + ref (lines 24-40)
   - Settings can use simpler pattern (no dropdown, just links)

3. **Tabs Pattern** (`settings-view-toggle.tsx`):
   - Currently uses horizontal tabs with bottom border
   - **Replace with sidebar** (tabs become sidebar links on desktop)
   - **Keep for mobile?** No - use Sheet drawer instead for cleaner UX

### Migration from Horizontal Tabs

Current: Horizontal tabs at top of content area
```tsx
// OLD: settings-view-toggle.tsx (horizontal tabs)
<nav className="flex gap-6 border-b border-border">
  <Link href="/installningar">Profil</Link>
  <Link href="/installningar/sakerhet">Säkerhet</Link>
  {/* etc */}
</nav>
```

New: Vertical sidebar on desktop, drawer on mobile
```tsx
// NEW: Sidebar component (vertical links)
<nav className="space-y-1" aria-label="Settings navigation">
  <Link
    href="/installningar"
    className={cn(linkStyles, isActive && activeStyles)}
  >
    <User className="h-4 w-4" />
    Profil
  </Link>
  {/* etc */}
</nav>
```

## Performance Notes

- **Zero JavaScript for desktop sidebar:** Pure CSS positioning and layout
- **Sheet only loads on mobile:** Dynamic import with `ssr: false` (see header.tsx:12-14)
- **No layout shift:** Grid explicit sizing prevents CLS
- **Sticky sidebar doesn't reflow:** Uses `position: sticky`, no scroll listeners

## Code Organization

Suggested file structure:

```
app/(main)/installningar/
├── layout.tsx                    # Grid layout, mobile trigger, sidebar
├── _components/
│   ├── settings-sidebar.tsx      # Desktop nav links (server component)
│   └── mobile-settings-menu.tsx  # Sheet drawer (client component)
├── page.tsx                      # Profil (default)
├── sakerhet/page.tsx
├── api-nycklar/page.tsx
└── hemmet/page.tsx
```

## Sources

### High Confidence (Official Documentation)
- [Radix UI Dialog](https://www.radix-ui.com/primitives/docs/components/dialog) - Sheet component foundation
- [Next.js App Router Layouts](https://nextjs.org/docs/app/getting-started/layouts-and-pages) - Layout patterns
- [Tailwind CSS Sidebar UI](https://tailwindcss.com/plus/ui-blocks/application-ui/application-shells/sidebar) - Official patterns

### Medium Confidence (Current Best Practices 2026)
- [Modern CSS Layout Guide](https://www.frontendtools.tech/blog/modern-css-layout-techniques-flexbox-grid-subgrid-2025) - Grid vs Flexbox in 2026
- [CSS Flexbox Responsive Layouts](https://coder-coder.com/build-flexbox-website-layout/) - Mobile-first sidebar patterns
- [Shadcn UI Sheet Component](https://ui.shadcn.com/docs/components/sheet) - Sheet implementation patterns (January 2026)
- [Responsive Sidebar Layouts](https://matthewjamestaylor.com/left-sidebar-layout) - CSS Grid sidebar patterns

### Verification Notes
- All Radix primitives verified via Context7 query (2026-01-27)
- Tailwind v4 utilities confirmed in package.json (v4.1.8)
- Next.js 16 App Router patterns verified via official docs
- Mobile Sheet pattern verified in existing codebase (`mobile-menu.tsx`)
