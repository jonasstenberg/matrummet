# Phase 2: Settings Sidebar Layout - Research

**Researched:** 2026-01-27
**Domain:** Settings page sidebar navigation (vertical desktop layout, pill tabs mobile)
**Confidence:** HIGH

## Summary

Phase 2 transforms settings navigation from horizontal tabs (SettingsViewToggle) to a vertical sidebar on desktop and horizontal pill tabs on mobile. The phase adds a new "Konto" danger zone section for account deletion, moving it out of the Säkerhet page. All required patterns already exist in the codebase—no new dependencies needed.

**Current state:** Settings uses horizontal tab navigation (`SettingsViewToggle` component) repeated on each page. Three sections: Profil, Säkerhet, API-nycklar. Account deletion lives in SecurityForm alongside password change.

**Target state:** Vertical sidebar navigation (240px fixed width) on desktop with sticky positioning. Horizontal scrolling pill tabs on mobile. Four sections: Profil, Säkerhet, API-nycklar, Konto (danger zone). Account deletion isolated to Konto page. SettingsViewToggle component removed.

**Primary recommendation:** Use CSS Grid layout (`grid-cols-[240px_1fr]`) for desktop sidebar with existing Radix UI Separator for danger zone divider. Mobile uses simple horizontal scroll container with pill-styled links. Leverage existing patterns from admin layout for active state detection via `usePathname()`. No external navigation libraries needed.

## Standard Stack

All required tools exist in the current stack. No new dependencies.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | 16.1.1 | Layout composition, routing | Built-in file-based layouts |
| React | 19.2.3 | Component framework | Required by Next.js 16 |
| Tailwind v4 | 4.1.8 | CSS Grid, responsive utilities | Native CSS, zero JS overhead |
| Radix UI | Current | Separator component for danger zone | Already used throughout app |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Lucide React | Current | Icons (optional for sidebar links) | Visual hierarchy in navigation |
| next/navigation | Built-in | `usePathname()` for active state | Client component routing state |
| cn utility | Existing | Conditional className merging | Active link styling |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS Grid sidebar | Radix Navigation Menu | Grid is simpler, no JS overhead. Navigation Menu adds unnecessary complexity for flat link lists |
| Pill tabs (mobile) | Radix Tabs primitive | Custom pills maintain consistent styling, avoid Radix tabs overhead |
| usePathname() | Server-side route matching | usePathname() works in client components, more flexible |

**Installation:**
```bash
# No new packages needed - all tools already in stack
```

## Architecture Patterns

### Recommended Project Structure
```
apps/frontend/
├── app/(main)/installningar/
│   ├── layout.tsx              # UPDATE: Add sidebar layout + grid
│   ├── page.tsx                # UPDATE: Remove SettingsViewToggle
│   ├── sakerhet/
│   │   └── page.tsx            # UPDATE: Remove SettingsViewToggle
│   ├── api-nycklar/
│   │   └── page.tsx            # UPDATE: Remove SettingsViewToggle
│   └── konto/                  # NEW: Danger zone page
│       └── page.tsx            # Account deletion only
├── components/
│   ├── settings-view-toggle.tsx # DELETE: Replaced by sidebar
│   └── security-form.tsx       # UPDATE: Remove account deletion section
└── next.config.ts              # UPDATE: Add /installningar -> /installningar/profil redirect
```

### Pattern 1: Vertical Sidebar with CSS Grid

**What:** Two-column layout with fixed-width sidebar (240px) and flexible content area using CSS Grid.

**When to use:** Desktop viewport (≥768px) for vertical navigation with sticky positioning.

**Example:**
```tsx
// app/(main)/installningar/layout.tsx
export default async function SettingsLayout({ children }) {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-bold">Inställningar</h1>
        <p className="text-muted-foreground">
          Hantera ditt konto och dina inställningar
        </p>
      </div>

      {/* Desktop: Grid layout with sidebar */}
      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-8">
        {/* Sidebar - hidden on mobile */}
        <aside className="hidden md:block">
          <SettingsSidebar />
        </aside>

        {/* Mobile pills - hidden on desktop */}
        <div className="md:hidden mb-6">
          <SettingsPillNav />
        </div>

        {/* Content area */}
        <main className="min-w-0">
          {children}
        </main>
      </div>
    </div>
  )
}
```

**Key characteristics:**
- `grid-cols-[240px_1fr]`: Fixed 240px sidebar, flexible content
- `min-w-0`: Prevents content overflow in grid container
- `hidden md:block`: Show sidebar only on desktop
- Max-width increased to `max-w-6xl` (from `max-w-2xl`) to accommodate sidebar

**Source:** Phase 1 ARCHITECTURE.md, Tailwind CSS Grid documentation

### Pattern 2: Sidebar Navigation with Active State

**What:** Vertical link list with active state highlighting using pathname matching.

**When to use:** Desktop sidebar navigation requiring current page indication.

**Example:**
```tsx
// components/settings-sidebar.tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"

const settingsLinks = [
  { href: "/installningar", label: "Profil" },
  { href: "/installningar/sakerhet", label: "Säkerhet" },
  { href: "/installningar/api-nycklar", label: "API-nycklar" },
]

const dangerLinks = [
  { href: "/installningar/konto", label: "Konto" },
]

export function SettingsSidebar() {
  const pathname = usePathname()

  const getLinkStyles = (href: string) => {
    const isActive = pathname === href
    return cn(
      "block px-3 py-2 rounded-md text-sm transition-colors",
      isActive
        ? "bg-muted text-foreground font-medium"
        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
    )
  }

  return (
    <nav aria-label="Inställningar" className="sticky top-20 space-y-6">
      <div className="space-y-1">
        {settingsLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={getLinkStyles(link.href)}
            aria-current={pathname === link.href ? "page" : undefined}
          >
            {link.label}
          </Link>
        ))}
      </div>

      <div className="space-y-1">
        <Separator />
        <p className="px-3 pt-4 pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Farlig zon
        </p>
        {dangerLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              getLinkStyles(link.href),
              "text-destructive hover:text-destructive hover:bg-destructive/10"
            )}
            aria-current={pathname === link.href ? "page" : undefined}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
```

**Key characteristics:**
- `"use client"`: Required for `usePathname()` hook
- `sticky top-20`: Stays visible when scrolling (20 = header height)
- `aria-current="page"`: Screen reader accessibility
- Danger zone: Red text color, separate section with divider
- Active state: `bg-muted` background highlight

**Source:** Existing codebase patterns (header.tsx, mobile-menu.tsx), ARCHITECTURE.md

### Pattern 3: Mobile Pill Navigation

**What:** Horizontal scrolling pill-shaped tabs for mobile navigation.

**When to use:** Mobile viewport (<768px) for compact navigation.

**Example:**
```tsx
// components/settings-pill-nav.tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/installningar", label: "Profil" },
  { href: "/installningar/sakerhet", label: "Säkerhet" },
  { href: "/installningar/api-nycklar", label: "API-nycklar" },
  { href: "/installningar/konto", label: "Konto" },
]

export function SettingsPillNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Inställningar" className="overflow-x-auto">
      <div className="flex gap-2 pb-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          const isDanger = item.href.includes("/konto")

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap",
                isActive
                  ? isDanger
                    ? "bg-destructive text-destructive-foreground"
                    : "bg-warm text-warm-foreground"
                  : isDanger
                  ? "bg-muted text-destructive hover:bg-destructive/10"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
```

**Key characteristics:**
- `overflow-x-auto`: Horizontal scroll on small screens
- `flex-shrink-0`: Pills don't compress
- `rounded-full`: Pill shape
- `whitespace-nowrap`: Prevent text wrapping
- Konto pill: Red styling when not active, red background when active

**Source:** Context decisions (pill tabs specified), existing scroll patterns in codebase

### Pattern 4: Account Deletion Page (Danger Zone)

**What:** Standalone Konto page containing only account deletion with email confirmation.

**When to use:** Isolating destructive actions from standard settings.

**Example:**
```tsx
// app/(main)/installningar/konto/page.tsx
import { AccountDeletionForm } from "@/components/account-deletion-form"

export default function AccountPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2">Konto</h2>
        <p className="text-muted-foreground">
          Hantera ditt konto och radering
        </p>
      </div>

      <AccountDeletionForm />
    </div>
  )
}
```

```tsx
// components/account-deletion-form.tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export function AccountDeletionForm() {
  const { user, clearUser } = useAuth()
  const router = useRouter()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [emailConfirmation, setEmailConfirmation] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const isOAuthUser = user?.provider !== null
  const isEmailValid = emailConfirmation === user?.email
  const canDelete = isEmailValid && (isOAuthUser || password)

  async function handleDelete() {
    if (!canDelete) return

    setError(null)
    setIsLoading(true)

    try {
      const response = await fetch("/api/user/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password: isOAuthUser ? null : password }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Något gick fel")
      }

      clearUser()
      router.push("/")
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Något gick fel")
    } finally {
      setIsLoading(false)
    }
  }

  function handleDialogChange(open: boolean) {
    setDialogOpen(open)
    if (!open) {
      setEmailConfirmation("")
      setPassword("")
      setError(null)
    }
  }

  return (
    <div className="bg-card border border-destructive/50 rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-4 text-destructive">
        Radera konto
      </h3>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Om du raderar ditt konto kommer all din kontoinformation att tas bort permanent.
          Dina recept kommer att bevaras men kommer inte längre att vara kopplade till ditt konto.
        </p>
        <p className="text-sm font-medium text-destructive">
          Denna åtgärd kan inte ångras.
        </p>

        <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
          <DialogTrigger asChild>
            <Button variant="destructive">
              Radera mitt konto
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Bekräfta radering av konto</DialogTitle>
              <DialogDescription className="space-y-2">
                <span className="block">
                  Du håller på att permanent radera ditt konto. All din kontoinformation
                  kommer att tas bort och kan inte återställas.
                </span>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Email confirmation */}
              <div className="space-y-2">
                <Label htmlFor="emailConfirm">
                  Bekräfta genom att skriva din e-postadress: <strong>{user?.email}</strong>
                </Label>
                <Input
                  id="emailConfirm"
                  type="email"
                  value={emailConfirmation}
                  onChange={(e) => setEmailConfirmation(e.target.value)}
                  placeholder={user?.email}
                  disabled={isLoading}
                />
              </div>

              {/* Password confirmation for non-OAuth users */}
              {!isOAuthUser && (
                <div className="space-y-2">
                  <Label htmlFor="password">Ditt lösenord</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Ange ditt lösenord"
                    disabled={isLoading}
                  />
                </div>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => handleDialogChange(false)}
                disabled={isLoading}
              >
                Avbryt
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={!canDelete || isLoading}
              >
                {isLoading ? "Raderar..." : "Radera mitt konto"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
```

**Key characteristics:**
- Email confirmation: User must type their email address to enable delete button
- Password confirmation: Non-OAuth users must also enter password
- Dialog confirmation: Two-step process (button → dialog → confirm)
- Destructive styling: Red border, red headings, red button
- API route: Calls existing `/api/user/delete-account` endpoint

**Source:** Existing security-form.tsx deletion logic, Context decisions (email confirmation required)

### Anti-Patterns to Avoid

- **Repeating navigation in each page component:** Move sidebar to layout, not individual pages
- **Hardcoding active state:** Use `usePathname()` to derive from URL, not local state
- **Forgetting mobile navigation:** Desktop sidebar alone is insufficient
- **Nesting account deletion in Säkerhet:** Danger zone should be isolated (violates REQ-03)
- **Using `/installningar` without redirect:** Must redirect to `/installningar/profil` (default view)

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Danger zone visual separator | Custom CSS borders/spacing | Radix UI Separator component | Already installed, accessible, theme-aware |
| Active link detection | Manual state tracking | `usePathname()` hook | Next.js built-in, accurate, works with App Router |
| Responsive layout | Custom media query hooks | Tailwind responsive prefixes | Zero JS, SSR-safe, consistent breakpoints |
| Sticky positioning | Scroll event listeners | CSS `position: sticky` | No JS overhead, native browser optimization |
| Dialog for deletion | Custom modal | Radix Dialog (via Sheet/Dialog) | Accessible, focus trap, keyboard handling |

**Key insight:** Next.js App Router + Tailwind v4 provide all primitives needed. Custom solutions add complexity without benefit.

## Common Pitfalls

### Pitfall 1: Breaking `/installningar` Default Route

**What goes wrong:** User navigates to `/installningar` (no trailing path) and sees blank page or error. This happens when you remove the default `page.tsx` without adding a redirect.

**Why it happens:** Phase 2 restructures navigation but forgets that `/installningar` alone is a valid route. Users expect it to show Profil section by default.

**How to avoid:**
1. Keep `/installningar/page.tsx` as Profil content (current pattern)
2. OR add redirect in `next.config.ts`:
```typescript
redirects: async () => [
  {
    source: '/installningar',
    destination: '/installningar/profil',
    permanent: false, // 307 temporary - internal routing
  },
]
```
3. Test direct navigation to `/installningar` before launch

**Warning signs:**
- Direct URL access to `/installningar` returns 404
- Header "Inställningar" link broken
- User reports "settings page missing"

**Source:** PITFALLS.md Pitfall 1, Next.js routing conventions

---

### Pitfall 2: Sidebar Not Sticky (Scrolls Away)

**What goes wrong:** User scrolls down long settings page, sidebar scrolls off-screen. Navigation becomes inaccessible without scrolling back up.

**Why it happens:** Developer uses `relative` positioning instead of `sticky`, or forgets `top-*` offset value.

**How to avoid:**
1. Use `sticky top-20` (20 = header height offset)
2. Test on long content pages (API-nycklar with many keys)
3. Verify sidebar stays visible during scroll
4. Ensure parent container doesn't have `overflow-hidden`

**Warning signs:**
- Sidebar disappears when scrolling
- Navigation requires scrolling to top
- UX feels janky (constant scrolling needed)

**Correct implementation:**
```tsx
<nav className="sticky top-20 space-y-6">
  {/* Links */}
</nav>
```

**Source:** STACK.md Pattern 1, existing codebase sticky patterns (recipe-detail.tsx line 184)

---

### Pitfall 3: Mobile Pills Overflow Without Scroll

**What goes wrong:** Four navigation pills don't fit in mobile viewport. Text wraps awkwardly, or pills overlap, making them unclickable.

**Why it happens:** Developer uses flexbox without `overflow-x-auto`, or forgets `flex-shrink-0` on pills.

**How to avoid:**
1. Wrap pills in container with `overflow-x-auto`
2. Set `flex-shrink-0` on pill elements
3. Use `whitespace-nowrap` to prevent text wrapping
4. Test on narrow viewport (320px iPhone SE)

**Warning signs:**
- Pills stack vertically on mobile (unintended)
- Text wraps inside pills
- Horizontal scroll doesn't work
- Pills overlap

**Correct implementation:**
```tsx
<nav className="overflow-x-auto">
  <div className="flex gap-2 pb-2">
    <Link className="flex-shrink-0 px-4 py-2 rounded-full whitespace-nowrap">
      Profil
    </Link>
  </div>
</nav>
```

**Source:** Context decisions (horizontal scrolling pills), existing scroll patterns (add-to-shopping-list-dialog.tsx)

---

### Pitfall 4: Forgetting to Remove SettingsViewToggle

**What goes wrong:** After implementing sidebar, developer leaves `SettingsViewToggle` imports in settings pages. Users see both horizontal tabs AND sidebar simultaneously.

**Why it happens:** Incremental migration leaves old navigation in place. Developer focuses on new sidebar, forgets to clean up old component.

**How to avoid:**
1. Grep for all SettingsViewToggle usages:
```bash
grep -r "SettingsViewToggle" apps/frontend/app
```
2. Remove import and usage from each settings page
3. Delete `components/settings-view-toggle.tsx` file
4. Verify no other components import it

**Warning signs:**
- Duplicate navigation on settings pages
- Both tabs and sidebar visible
- Layout feels cluttered
- User confusion (which navigation to use?)

**Files to update:**
- `/installningar/page.tsx`
- `/installningar/sakerhet/page.tsx`
- `/installningar/api-nycklar/page.tsx`

**Source:** Phase architecture, ARCHITECTURE.md component removal list

---

### Pitfall 5: Account Deletion Still in SecurityForm

**What goes wrong:** REQ-03 requires account deletion in separate "Konto" section. Developer creates Konto page but forgets to remove deletion logic from SecurityForm. Now deletion exists in TWO places.

**Why it happens:** Focus on creating new Konto page, old SecurityForm logic not audited.

**How to avoid:**
1. Extract deletion logic to new `AccountDeletionForm` component
2. Remove deletion section from `SecurityForm` component
3. Update SecurityForm to show ONLY password change
4. Test that deletion only works from `/installningar/konto`
5. Verify `/installningar/sakerhet` shows no deletion UI

**Warning signs:**
- Account deletion appears on both Säkerhet and Konto pages
- SecurityForm still has Dialog with deletion button
- Users confused about where to delete account

**Files to update:**
- `components/security-form.tsx` (remove lines 177-251: delete account section)
- `components/account-deletion-form.tsx` (new file with extracted logic)

**Source:** Success Criteria SC-04, REQ-03, Context decisions

---

### Pitfall 6: Missing `aria-current="page"` on Active Link

**What goes wrong:** Screen readers don't announce which page is currently active. Keyboard users navigating sidebar have no audio feedback about location.

**Why it happens:** Accessibility attribute overlooked. Visual active state (background color) is present but screen reader annotation missing.

**How to avoid:**
1. Add `aria-current="page"` to active link:
```tsx
<Link
  href="/installningar"
  aria-current={pathname === "/installningar" ? "page" : undefined}
>
```
2. Test with screen reader (VoiceOver on Mac, NVDA on Windows)
3. Verify "current page" is announced
4. Apply to both desktop sidebar and mobile pills

**Warning signs:**
- Lighthouse accessibility score flags missing `aria-current`
- Screen reader doesn't announce page location
- Navigation feels "silent" to keyboard users

**Source:** PITFALLS.md Pitfall 4, ARIA best practices, stepper.tsx line 113 (existing example)

## Code Examples

Verified patterns from official sources and existing codebase:

### Layout Grid Structure
```tsx
// Source: ARCHITECTURE.md, STACK.md
<div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-8">
  <aside className="hidden md:block">
    <SettingsSidebar />
  </aside>

  <div className="md:hidden mb-6">
    <SettingsPillNav />
  </div>

  <main className="min-w-0">
    {children}
  </main>
</div>
```

### Active Link Styling
```tsx
// Source: Existing patterns (header.tsx, mobile-menu.tsx)
const isActive = pathname === href

<Link
  href={href}
  className={cn(
    "block px-3 py-2 rounded-md text-sm transition-colors",
    isActive
      ? "bg-muted text-foreground font-medium"
      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
  )}
  aria-current={isActive ? "page" : undefined}
>
  {label}
</Link>
```

### Danger Zone Separator
```tsx
// Source: Radix UI Separator (ui/separator.tsx)
import { Separator } from "@/components/ui/separator"

<Separator />
<p className="px-3 pt-4 pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
  Farlig zon
</p>
```

### Email Confirmation Input
```tsx
// Source: Context decisions (type email to confirm)
const [emailConfirmation, setEmailConfirmation] = useState("")
const isEmailValid = emailConfirmation === user?.email

<Label htmlFor="emailConfirm">
  Bekräfta genom att skriva din e-postadress: <strong>{user?.email}</strong>
</Label>
<Input
  id="emailConfirm"
  type="email"
  value={emailConfirmation}
  onChange={(e) => setEmailConfirmation(e.target.value)}
  placeholder={user?.email}
/>

<Button
  variant="destructive"
  disabled={!isEmailValid}
>
  Radera mitt konto
</Button>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Horizontal tabs (repeated per page) | Sidebar in layout (single source) | Phase 2 | Navigation state managed in layout, not individual pages |
| Combined password + deletion in SecurityForm | Separate Konto page for deletion | Phase 2 | Clearer separation of concerns, danger zone isolated |
| Tab navigation with border-bottom indicator | Sidebar with background highlight | Phase 2 | More scannable, better mobile UX with pills |
| Manual active state prop (`activeView="profil"`) | Pathname-based active detection | Phase 2 | URL is source of truth, no prop drilling |

**Deprecated/outdated:**
- **SettingsViewToggle component**: Replaced by SettingsSidebar + SettingsPillNav
- **Account deletion in SecurityForm**: Moved to AccountDeletionForm in Konto page
- **Horizontal tab pattern for settings**: Vertical sidebar is new standard (desktop)

## Open Questions

Things that couldn't be fully resolved:

1. **Should sidebar links use icons?**
   - What we know: Context decisions say "text-only links, no icons"
   - What's unclear: Icons improve scannability (User, Shield, Key icons common in settings)
   - Recommendation: Follow context decision (no icons), revisit if user testing shows scannability issues

2. **Should mobile pills be sticky (fixed at top)?**
   - What we know: Context says "pills scroll away with page content (not sticky)"
   - What's unclear: Sticky pills improve navigation access on long pages
   - Recommendation: Follow context decision (not sticky), test on long API-nycklar page

3. **Should we add route prefetching to sidebar links?**
   - What we know: Next.js Link prefetches by default
   - What's unclear: Prefetch all settings routes on sidebar render, or wait for hover?
   - Recommendation: Use default Next.js behavior (prefetch on hover), measure performance

4. **Should account deletion require re-authentication?**
   - What we know: Current implementation requires password OR email confirmation
   - What's unclear: Should OAuth users re-authenticate via provider before deletion?
   - Recommendation: Email confirmation sufficient for OAuth users (as specified), consider re-auth in future security audit

## Sources

### Primary (HIGH confidence)
- **Existing codebase analysis**: settings-view-toggle.tsx, security-form.tsx, installningar/layout.tsx, ui/separator.tsx
- **Phase 1 RESEARCH.md**: Route patterns, layout structure (verified implementation)
- **ARCHITECTURE.md**: Detailed route structure, component hierarchy, responsive patterns
- **STACK.md**: Technology stack, CSS Grid patterns, Radix UI usage
- **PITFALLS.md**: Common mistakes, Next.js 16 gotchas, accessibility requirements
- **Context decisions (02-CONTEXT.md)**: Sidebar appearance, mobile pills, danger zone, email confirmation

### Secondary (MEDIUM confidence)
- **Tailwind CSS Grid documentation**: CSS Grid utility classes
- **Next.js App Router layouts**: Nested layout composition
- **Radix UI Separator docs**: Divider component API

### Tertiary (LOW confidence)
- None - all findings verified against codebase or official documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All tools exist in codebase, verified via package.json
- Architecture: HIGH - Patterns verified in existing code (admin layout, header, mobile-menu)
- Pitfalls: HIGH - Derived from existing phase research + codebase analysis
- Danger zone implementation: HIGH - Based on existing security-form.tsx deletion logic

**Research date:** 2026-01-27
**Valid until:** 30 days (stable patterns, no fast-moving dependencies)

**Verification notes:**
- All component patterns verified against existing codebase
- CSS Grid syntax confirmed in Tailwind v4.1.8
- Next.js 16.1.1 layout composition verified
- Radix UI Separator component exists in ui/separator.tsx
- Account deletion API route verified at app/api/user/delete-account/route.ts
