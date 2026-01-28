# Phase 1: Footer Infrastructure - Research

**Researched:** 2026-01-28
**Domain:** Next.js 16 App Router layouts, Tailwind v4 responsive design, React 19 Server Components
**Confidence:** HIGH

## Summary

This phase requires implementing a professional multi-column footer that appears consistently across both the `(main)` and `(auth)` route groups in the existing Next.js 16 App Router application. The app already has a full-height flexbox layout pattern (`flex min-h-screen flex-col` on root) and uses Tailwind v4 with a warm color palette defined via `@theme` variables.

The standard approach is to create a single reusable Server Component footer in `/components` and import it into both layout files. The footer should use CSS Grid for desktop 2-column layout and Flexbox for mobile stacking, with responsive breakpoints using Tailwind's mobile-first system. The existing root layout already handles full-height structure, so the footer will naturally sit at the bottom via the flexbox layout in `app/layout.tsx`.

**Primary recommendation:** Create a single `<Footer>` Server Component in `/components/footer.tsx` that both `(main)/layout.tsx` and `(auth)/layout.tsx` import, using Tailwind CSS Grid for desktop columns and mobile-first responsive classes for stacking.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.1.1 | App Router with route groups | Official React framework with built-in routing, layouts, and Server Components |
| React | 19.2.3 | Server Components by default | Stable release with RSC, footers are naturally server components (static content) |
| Tailwind CSS | 4.1.8 | Utility-first styling with @theme | v4 is current stable, uses CSS-first configuration with theme variables |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | 0.513.0 | Icon components | Already in project for consistent iconography if footer needs icons |
| clsx | 2.1.1 | Conditional class names | Already in project, useful for responsive/conditional styling |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Server Component | Client Component | Server Component is correct - footer content is static, no interactivity needed |
| CSS Grid | Flexbox only | Grid is cleaner for 2-column desktop layout; Flexbox better for mobile stacking |
| Shared component | Duplicate in each layout | DRY principle violated, maintenance burden doubles |

**Installation:**
```bash
# No new dependencies required - all tools already in project
```

## Architecture Patterns

### Recommended Project Structure
```
apps/frontend/
├── app/
│   ├── (auth)/
│   │   └── layout.tsx           # Import Footer
│   ├── (main)/
│   │   └── layout.tsx           # Import Footer
│   └── layout.tsx               # Root layout with full-height flex
├── components/
│   └── footer.tsx               # Shared Footer component
└── lib/
    └── constants.ts             # APP_NAME already exists
```

### Pattern 1: Shared Component Between Route Groups
**What:** Place reusable components outside route group folders, import into multiple layouts
**When to use:** Any component that appears in multiple route groups (header, footer)
**Example:**
```typescript
// apps/frontend/components/footer.tsx
export function Footer() {
  return <footer>...</footer>
}

// apps/frontend/app/(main)/layout.tsx
import { Footer } from "@/components/footer"
export default function MainLayout({ children }) {
  return (
    <>
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  )
}

// apps/frontend/app/(auth)/layout.tsx
import { Footer } from "@/components/footer"
export default function AuthLayout({ children }) {
  return (
    <>
      <main className="min-h-screen flex items-center justify-center">
        {children}
      </main>
      <Footer />
    </>
  )
}
```

### Pattern 2: Full-Height Layout with Sticky Footer (Existing)
**What:** Root layout uses `flex min-h-screen flex-col`, child layouts use `flex-1` on main content
**When to use:** Already implemented in this app - ensures footer sits at bottom regardless of content height
**Example:**
```typescript
// app/layout.tsx (EXISTING)
<body>
  <div className="flex min-h-screen flex-col">
    {children}  {/* layouts render here */}
  </div>
</body>

// app/(main)/layout.tsx (EXISTING)
<main className="flex-1">  {/* Takes available space, pushes footer down */}
  <div className="container mx-auto max-w-7xl px-4 py-8">{children}</div>
</main>
```

### Pattern 3: Responsive Grid-to-Stack Layout
**What:** CSS Grid for desktop columns, mobile-first approach stacks vertically on small screens
**When to use:** Multi-column footers that need to reflow on mobile
**Example:**
```typescript
// Mobile-first: default is vertical stack
<div className="grid grid-cols-1 gap-8 md:grid-cols-2">
  <div>Column 1</div>
  <div>Column 2</div>
</div>

// Tailwind applies md: at ≥768px, maintaining single column below
```

### Pattern 4: Dynamic Year in Server Component
**What:** Use `new Date().getFullYear()` directly in JSX - no state/hooks needed for Server Components
**When to use:** Copyright notices in footers
**Example:**
```typescript
// Server Component - evaluated at build/request time
export function Footer() {
  return (
    <p>© {new Date().getFullYear()} Matrummet</p>
  )
}
```

### Anti-Patterns to Avoid
- **Client Component for static footer:** Wastes client bundle, Server Component is correct for static content
- **Duplicating footer in both layouts:** Violates DRY, doubles maintenance burden
- **Position absolute for footer:** Legacy hack, breaks responsive layouts - use flexbox pattern already in app
- **Using state for current year:** Server Components don't need useState/useEffect for this
- **Separate footer for each route group:** Creates inconsistency, user decisions explicitly require same footer everywhere

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Full-height layout with bottom footer | Custom height calculations, position absolute | Flexbox pattern with `flex min-h-screen flex-col` + `flex-1` on main | Already implemented in app, handles all content heights correctly |
| Responsive column layout | Manual media queries, JavaScript resize handlers | Tailwind CSS Grid with mobile-first breakpoints | Native CSS, no JavaScript, optimized for performance |
| Color palette management | Inline hex codes, scattered CSS variables | Tailwind v4 `@theme` variables | Already configured with warm palette, ensures consistency |
| Component sharing across route groups | Complex context providers, layout wrappers | Simple ES6 imports from `/components` | Zero overhead, standard pattern, works with RSC |

**Key insight:** Next.js App Router handles route groups organizationally only - they don't create component isolation. Standard ES6 imports work perfectly for sharing components.

## Common Pitfalls

### Pitfall 1: Treating Route Groups as Component Boundaries
**What goes wrong:** Developers assume components in `(main)` can't be used in `(auth)` or try to create separate footer instances
**Why it happens:** Route groups use parentheses syntax which looks like scoping, but they're purely organizational
**How to avoid:** Understand that route groups only affect URL structure and layout nesting - components in `/components` are accessible to all route groups
**Warning signs:** Duplicated footer code, inconsistent footer appearance between main and auth pages

### Pitfall 2: Footer Not Appearing on Auth Pages
**What goes wrong:** Footer exists in `(main)/layout.tsx` but auth pages don't show it
**Why it happens:** `(auth)/layout.tsx` is a separate layout hierarchy - it doesn't inherit from `(main)/layout.tsx`
**How to avoid:** Import and render `<Footer />` in both `(main)/layout.tsx` AND `(auth)/layout.tsx` - each route group needs its own footer instance
**Warning signs:** Footer appears on main app pages but missing from login/register pages

### Pitfall 3: Breaking Mobile Layout with Wrong Breakpoint Logic
**What goes wrong:** Using `sm:` for mobile styling when it actually means "≥640px and above"
**Why it happens:** Common misconception that `sm:` means "small screens" - Tailwind is mobile-first
**How to avoid:** Unprefixed classes apply to mobile, prefixed classes apply at breakpoint and above. For mobile-only, use unprefixed or `max-md:` modifiers
**Warning signs:** Footer looks fine on desktop but broken on mobile, or vice versa

### Pitfall 4: Auth Layout Breaking Full-Height Pattern
**What goes wrong:** Auth layout uses `min-h-screen` directly on `<main>` which fights with root layout's flexbox
**Why it happens:** Existing auth layout has `min-h-screen` on main, which can cause footer to not stick properly
**How to avoid:** Remove `min-h-screen` from auth main, let root layout's flexbox handle full height, or adjust auth layout to work with footer
**Warning signs:** Footer floats in middle of page on auth routes, or appears above fold on short auth pages

### Pitfall 5: Using Wrong Copyright Entity Name
**What goes wrong:** Copyright shows "© Recept" instead of "© Matrummet"
**Why it happens:** Context document explicitly states copyright entity is "Matrummet" not "Recept"
**How to avoid:** Reference context decisions - use "Matrummet" in all copyright text
**Warning signs:** QA testing catches incorrect branding in footer

### Pitfall 6: Testing Only Desktop or Only Mobile
**What goes wrong:** Footer looks perfect on developer's screen but broken on actual devices
**Why it happens:** Not testing responsive breakpoints, assuming single layout works everywhere
**How to avoid:** Test at multiple breakpoints (mobile 375px, tablet 768px, desktop 1024px+), use browser DevTools responsive mode
**Warning signs:** Bug reports from users on different devices, layout shifts at specific widths

## Code Examples

Verified patterns from official sources:

### Tailwind v4 Color Configuration (Existing)
```css
/* apps/frontend/app/globals.css - ALREADY CONFIGURED */
@theme {
  --color-background: #F5F3F0;
  --color-muted: #f2eeea;
  --color-muted-foreground: #6b6b6b;
  --color-border: #e0dbd5;
}
```
Source: Project codebase, follows [Tailwind CSS v4 theme configuration](https://tailwindcss.com/docs/theme)

### Mobile-First Responsive Grid
```typescript
// Mobile: single column (default, unprefixed)
// Desktop: two columns (md: prefix applies at ≥768px)
<div className="grid grid-cols-1 gap-8 md:grid-cols-2">
  <div>{/* Links column */}</div>
  <div>{/* Info column */}</div>
</div>
```
Source: [Tailwind CSS responsive design](https://tailwindcss.com/docs/responsive-design)

### Dynamic Copyright Year (Server Component)
```typescript
// No useState/useEffect needed - Server Component renders at request time
export function Footer() {
  const currentYear = new Date().getFullYear()
  return <p>© {currentYear} Matrummet</p>
}
```
Source: [Medium - Creating Dynamic Copyright Year](https://medium.com/@blockchainTrucker/creating-a-dynamic-copyright-year-for-your-footer-a-step-by-step-guide-42507c422a2e)

### Footer with Muted Background (Context Decision)
```typescript
// Subtle background separation - user decided "not dark"
<footer className="bg-muted/30">  {/* 30% opacity of muted color */}
  {/* Or solid muted: */}
  {/* <footer className="bg-muted"> */}
</footer>
```
Source: Project context decisions, uses existing `--color-muted` from globals.css

### Full Footer Implementation Example
```typescript
// apps/frontend/components/footer.tsx
export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-muted/30">
      <div className="container mx-auto max-w-7xl px-4 py-8 md:py-12">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          {/* Links column */}
          <div>
            <h3 className="font-semibold text-foreground mb-4">Information</h3>
            <nav className="flex flex-col gap-2">
              <a href="/om" className="text-muted-foreground hover:underline">
                Om
              </a>
              <a href="/integritetspolicy" className="text-muted-foreground hover:underline">
                Integritetspolicy
              </a>
              <a href="/villkor" className="text-muted-foreground hover:underline">
                Villkor
              </a>
            </nav>
          </div>

          {/* Info column */}
          <div className="md:text-right">
            <h3 className="font-semibold text-foreground mb-4">Matrummet</h3>
            <p className="text-sm text-muted-foreground">
              © {currentYear} Matrummet
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
```
Source: Synthesized from research and context decisions

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| JavaScript config file for Tailwind | CSS-first with `@theme` | Tailwind v4.0 (Dec 2023) | Simpler configuration, better DX, already adopted in this project |
| Client Components by default | Server Components by default | React 19 / Next.js 13+ | Footers are naturally Server Components, smaller client bundles |
| position: absolute for sticky footer | Flexbox with `flex-1` on main | Modern CSS (2020+) | Cleaner code, better responsive behavior, already implemented in app |
| Manual media queries | Tailwind responsive utilities | Tailwind CSS (2019+) | Less CSS, mobile-first by default, maintainable |
| Route groups (marketing)/(shop) | Route groups (main)/(auth) | Next.js 13 App Router (2022) | Organizational tool, this app uses for layout separation |

**Deprecated/outdated:**
- Tailwind v3 JavaScript config files: v4 uses CSS `@theme`, project already migrated
- Pages Router layouts with `_app.js`: App Router uses nested `layout.tsx`, project uses App Router
- Client Components for static content: React 19 defaults to Server Components, footer should be RSC

## Open Questions

Things that couldn't be fully resolved:

1. **Auth layout full-height pattern compatibility**
   - What we know: Current auth layout uses `min-h-screen flex items-center justify-center` on main
   - What's unclear: Whether adding footer breaks the centered auth card, needs testing
   - Recommendation: Add footer to auth layout, test visually - may need to adjust auth main to not use `min-h-screen` and rely on root layout's flexbox instead

2. **Optimal background color tone (warm vs cool)**
   - What we know: User marked this as "Claude's discretion", existing palette is warm (#F5F3F0 background, #f2eeea muted)
   - What's unclear: Whether to use existing `bg-muted` or create new footer-specific color
   - Recommendation: Start with `bg-muted/30` (30% opacity) for subtle separation, can adjust based on visual testing

3. **Info column heading text**
   - What we know: User marked this as "Claude's discretion"
   - What's unclear: Whether to use "Matrummet" (brand name), "Om oss", or something else
   - Recommendation: Use "Matrummet" for consistency with copyright entity, reinforces branding

## Sources

### Primary (HIGH confidence)
- Project codebase files (apps/frontend/app/layout.tsx, globals.css, package.json)
- [Next.js App Router Layouts Documentation](https://nextjs.org/docs/app/getting-started/layouts-and-pages)
- [Tailwind CSS v4 Theme Variables](https://tailwindcss.com/docs/theme)
- [Tailwind CSS Responsive Design](https://tailwindcss.com/docs/responsive-design)

### Secondary (MEDIUM confidence)
- [Next.js 16 Release Blog](https://nextjs.org/blog/next-16) - App Router default, React 19 features
- [Next.js Route Groups Documentation](https://nextjs.org/docs/app/api-reference/file-conventions/route-groups) - Sharing components between groups
- [LogRocket: Guide to Next.js Layouts](https://blog.logrocket.com/guide-next-js-layouts-nested-layouts/) - Layout patterns and state persistence
- [Tailwind CSS Best Practices 2025-2026](https://www.frontendtools.tech/blog/tailwind-css-best-practices-design-system-patterns) - Design tokens, typography
- [Medium: Creating Dynamic Copyright Year](https://medium.com/@blockchainTrucker/creating-a-dynamic-copyright-year-for-your-footer-a-step-by-step-guide-42507c422a2e)
- [CSS Sticky Footer Guide: Flexbox vs Grid](https://prismic.io/blog/css-sticky-footers) - Modern approaches
- [DEV: Fixing Sticky Footer with Next.js and TailwindCSS](https://dev.to/streetcommunityprogrammer/fixing-the-sticky-footer-issue-with-nextjs-and-tailwindcss-1i2b)

### Tertiary (LOW confidence)
- None - all findings verified with official documentation or project codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in project, versions verified from package.json
- Architecture: HIGH - patterns verified in official Next.js and Tailwind docs, existing app structure analyzed
- Pitfalls: MEDIUM-HIGH - common mistakes from community sources verified with official docs where possible

**Research date:** 2026-01-28
**Valid until:** ~30 days (2026-02-28) - stable ecosystem, Next.js 16 and Tailwind v4 are current stable versions
