# Phase 6: Auth & Mobile States - Research

**Researched:** 2026-01-28
**Domain:** Authentication state UI patterns, mobile navigation with Radix UI, loading states, and redirect flows
**Confidence:** HIGH

## Summary

This phase requires implementing conditional navigation UI based on authentication state and ensuring mobile users can access all features through the existing Sheet drawer. The technical challenge is preventing flash of incorrect UI during auth checks while providing instant, accessible navigation across all device sizes and auth states.

The standard approach uses React conditional rendering with proper loading skeletons, Next.js server-side session handling to minimize flash of unauthenticated content (FOUC), and Radix UI Sheet component for the mobile drawer. The existing codebase already has all necessary primitives in place—this phase is primarily about composition and conditional logic, not new infrastructure.

**Primary recommendation:** Use server-side session check in layout to provide initial auth state, render skeleton placeholders during client-side hydration, conditionally render navigation based on user state, and preserve existing Radix Sheet drawer for mobile with auth-aware content.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.3 | UI library with conditional rendering | Already in use, stable conditional patterns |
| Next.js | 16.1.1 | Server-side auth check, routing, redirects | Already in use, built-in redirect and session handling |
| Radix UI Dialog | ^1.1.15 | Sheet/drawer primitive (mobile menu) | Already in use as @radix-ui/react-dialog, powers Sheet component |
| lucide-react | ^0.513.0 | Icon library for nav items | Already in use across all navigation |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Skeleton component | Built-in | Loading placeholder | During auth initialization |
| useSearchParams | Next.js built-in | Return URL handling | After login redirect |
| usePathname | Next.js built-in | Active state detection | Mobile drawer active indicators |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Server-side session | Client-only auth check | Client-only causes FOUC, server-side prevents it |
| Radix Sheet | Custom drawer | Sheet has battle-tested accessibility and animations |
| Query params for redirect | localStorage | Query params work cross-device, more transparent |

**Installation:**
No new packages needed—all dependencies already in package.json.

## Architecture Patterns

### Recommended Component Structure
```
components/
├── header.tsx              # Conditionally renders auth UI
├── desktop-nav.tsx         # Auth-gated nav items
├── mobile-menu.tsx         # Sheet with auth-conditional content
├── ui/
│   ├── button.tsx          # Variant: outline, default
│   ├── sheet.tsx           # Radix Dialog wrapper
│   └── skeleton.tsx        # Loading placeholders
```

### Pattern 1: Conditional Header UI Based on Auth State
**What:** Render different header layouts for logged-in vs logged-out users
**When to use:** Top-level layout components that depend on auth state
**Example:**
```tsx
// Source: Codebase analysis + React conditional rendering patterns
export function Header() {
  const { user } = useAuth()

  return (
    <header>
      <Logo />

      {/* Desktop Nav - auth-gated */}
      {user && (
        <div className="hidden md:flex">
          <DesktopNav />
        </div>
      )}

      <div className="flex-1" /> {/* Spacer */}

      {/* Desktop User Controls */}
      <div className="hidden md:flex">
        {user ? (
          <DropdownMenu>
            <UserAvatar user={user} />
            {/* Inställningar, Logga ut */}
          </DropdownMenu>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/login">Logga in</Link>
            </Button>
            <Button asChild>
              <Link href="/registrera">Skapa konto</Link>
            </Button>
          </div>
        )}
      </div>

      {/* Mobile Menu - auth-aware */}
      {user && <MobileMenu />}
    </header>
  )
}
```

### Pattern 2: Prevent Flash of Logged-Out State (FOUC)
**What:** Show skeleton placeholders during auth initialization instead of logged-out UI
**When to use:** Initial page load before auth state is confirmed
**Example:**
```tsx
// Source: https://andreas.fyi/writing/nextjs-auth-skeleton-loaders
// Pattern: Server-side session + client skeleton during hydration
export function Header() {
  const { user } = useAuth()
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    setIsHydrated(true)
  }, [])

  // During SSR or initial hydration, show skeleton if we expect user
  if (!isHydrated) {
    return (
      <header>
        <Logo />
        <div className="flex-1" />
        <div className="hidden md:flex gap-2">
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
      </header>
    )
  }

  // After hydration, show actual auth state
  return <ActualHeader user={user} />
}
```

### Pattern 3: Mobile Sheet with Auth-Conditional Content
**What:** Render different drawer content based on auth state
**When to use:** Mobile navigation that adapts to logged-in/logged-out
**Example:**
```tsx
// Source: Codebase mobile-menu.tsx + Radix Sheet patterns
export function MobileMenu() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)

  // No drawer for logged-out users
  if (!user) {
    return null
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild className="md:hidden">
        <button aria-label="Öppna meny">
          <Menu className="h-6 w-6" />
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-80">
        <SheetHeader>
          <SheetTitle>Meny</SheetTitle>
        </SheetHeader>
        <nav className="mt-6 flex flex-col gap-2">
          {/* Nav items with icons matching desktop */}
          <MobileNavItem href="/mitt-skafferi" icon={UtensilsCrossed}>
            Mitt skafferi
          </MobileNavItem>
          {/* ... more items ... */}
          <Separator />
          <MobileNavItem href="/installningar" icon={UserCog}>
            Inställningar
          </MobileNavItem>
          <button onClick={logout}>
            <LogOut />
            Logga ut
          </button>
        </nav>
      </SheetContent>
    </Sheet>
  )
}
```

### Pattern 4: Return URL After Login
**What:** Preserve intended destination when redirecting to login, then return after auth
**When to use:** Protected routes that redirect unauthenticated users to login
**Example:**
```tsx
// Source: https://dev.to/dalenguyen/fixing-nextjs-authentication-redirects
// In protected layout (e.g., /installningar/layout.tsx)
export default async function ProtectedLayout({ children }) {
  const session = await getSession()

  if (!session) {
    const currentPath = headers().get('x-pathname') || '/installningar'
    redirect(`/login?returnUrl=${encodeURIComponent(currentPath)}`)
  }

  return children
}

// In login form component
export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  async function handleSubmit(e) {
    e.preventDefault()
    await login(email, password)

    // Redirect to return URL or default to home
    const returnUrl = searchParams.get('returnUrl') || '/'
    router.push(returnUrl)
  }

  return <form onSubmit={handleSubmit}>{/* ... */}</form>
}
```

### Pattern 5: Active State in Mobile Drawer
**What:** Highlight current page in mobile navigation
**When to use:** Mobile drawer with multiple nav items
**Example:**
```tsx
// Source: Codebase desktop-nav.tsx patterns applied to mobile
function MobileNavItem({ href, icon: Icon, children }) {
  const pathname = usePathname()
  const isActive = pathname === href

  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-2 rounded-md px-3 py-2',
        'text-sm font-medium transition-colors',
        isActive
          ? 'bg-accent text-accent-foreground font-semibold'
          : 'hover:bg-muted'
      )}
      aria-current={isActive ? 'page' : undefined}
    >
      <Icon className="h-4 w-4" />
      {children}
    </Link>
  )
}
```

### Anti-Patterns to Avoid
- **Rendering logged-out UI then swapping to logged-in UI**: Causes jarring flash and poor UX. Use skeleton or server-side state instead.
- **Client-only auth checks for initial render**: Always causes FOUC. Server-side session prevents this.
- **Separate mobile and desktop nav item lists**: Leads to drift. Share nav items config, vary only presentation.
- **Hiding hamburger with CSS on logged-out**: Leaves inaccessible button in DOM. Conditionally render instead.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Mobile slide-out drawer | Custom drawer with animations | Radix Sheet (Dialog primitive) | Handles focus trapping, ESC key, backdrop clicks, ARIA attributes, animations |
| Skeleton loading UI | Custom pulse/shimmer | Built-in Skeleton component | Consistent with design system, animate-pulse utility |
| Return URL preservation | Custom redirect state | Query parameters (returnUrl) | URL-based state is shareable, transparent, works cross-device |
| Button variants | Inline styles for primary/secondary | Button component variants | Maintains design consistency, accessible by default |

**Key insight:** Authentication UI state management looks simple but has many edge cases (initial load, hydration, redirect loops, accessibility). Using Next.js built-ins (server-side session, redirect) and Radix primitives (Sheet) handles these cases properly.

## Common Pitfalls

### Pitfall 1: Flash of Unauthenticated Content (FOUC)
**What goes wrong:** User sees logged-out UI (login/signup buttons) for a split second before auth state loads and swaps to logged-in UI
**Why it happens:** Client-side auth check runs after initial render, React renders logged-out state first
**How to avoid:**
- Server-side session check in layout provides initial auth state (prevents FOUC entirely)
- If client-side hydration needed, render skeleton placeholders instead of definitive UI
- Use `isHydrated` flag to delay rendering auth-dependent UI until after mount
**Warning signs:** Users report seeing login button briefly when they're already logged in

### Pitfall 2: Redirect Loops
**What goes wrong:** User gets stuck bouncing between /login and protected page infinitely
**Why it happens:**
- Protected layout redirects to /login with returnUrl
- Login page redirects authenticated users to returnUrl
- If returnUrl is /login itself, creates loop
**How to avoid:**
- Validate returnUrl before redirecting (must not be /login or /registrera)
- Default to safe fallback (home) if returnUrl is missing or suspicious
- Clear returnUrl param after successful redirect
**Warning signs:** Browser back button broken, Network tab shows rapid redirects

### Pitfall 3: Mobile Drawer Accessibility Issues
**What goes wrong:** Screen readers don't announce drawer properly, focus escapes drawer, or ESC key doesn't close
**Why it happens:** Custom drawer implementation misses ARIA attributes, focus trap, or keyboard handlers
**How to avoid:** Use Radix Sheet component which handles all accessibility concerns
**Warning signs:** Keyboard navigation broken, VoiceOver announces incorrectly, focus jumps outside drawer

### Pitfall 4: Inconsistent Nav Item Ordering
**What goes wrong:** Mobile drawer shows items in different order than desktop nav
**Why it happens:** Separate hardcoded lists for mobile and desktop
**How to avoid:**
- Define nav items once in shared config/constant
- Map over config in both desktop and mobile components
- Vary only presentation (icons, layout), not content or order
**Warning signs:** User confusion about feature locations, maintenance drift

### Pitfall 5: Login/Signup Button Layout Shift on Mobile
**What goes wrong:** Two buttons don't fit side-by-side on small screens, causing layout break or tiny buttons
**Why it happens:** Fixed button sizes don't account for narrow viewports
**How to avoid:**
- Test on actual mobile viewport (320px width)
- Consider stacking buttons vertically on very small screens
- Use responsive gap and padding (gap-2 → sm:gap-3)
**Warning signs:** Horizontal scroll on mobile header, buttons overlap text

## Code Examples

Verified patterns from codebase:

### Logged-Out Header Buttons (Desktop)
```tsx
// Source: Codebase button.tsx variants
{!user && (
  <div className="hidden md:flex items-center gap-2">
    <Button variant="outline" asChild>
      <Link href="/login">Logga in</Link>
    </Button>
    <Button asChild>
      <Link href="/registrera">Skapa konto</Link>
    </Button>
  </div>
)}
```

### Mobile-Only Controls
```tsx
// Source: Codebase mobile-menu.tsx
// Pattern: Hide desktop, show mobile using md: breakpoint
<div className="md:hidden">
  {user ? (
    <MobileMenu />
  ) : (
    <div className="flex gap-2">
      <Button size="sm" variant="outline" asChild>
        <Link href="/login">Logga in</Link>
      </Button>
      <Button size="sm" asChild>
        <Link href="/registrera">Skapa konto</Link>
      </Button>
    </div>
  )}
</div>
```

### Protected Layout with Return URL
```tsx
// Source: Codebase /installningar/layout.tsx + redirect patterns
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function SettingsLayout({ children }) {
  const session = await getSession()

  if (!session) {
    redirect('/login?returnUrl=/installningar')
  }

  return <div>{children}</div>
}
```

### Drawer Active State Styling
```tsx
// Source: Codebase desktop-nav.tsx active state pattern
const pathname = usePathname()
const isActive = pathname === item.href

<Link
  href={item.href}
  className={cn(
    'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium',
    isActive
      ? 'bg-accent text-accent-foreground'
      : 'hover:bg-accent/50'
  )}
  aria-current={isActive ? 'page' : undefined}
>
  <Icon className="h-4 w-4" />
  {label}
</Link>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Client-side auth only | Server-side session + client hydration | Next.js 13+ App Router | Eliminates FOUC, better UX |
| Custom drawer components | Radix UI primitives (Sheet) | Radix UI 1.0+ | Accessibility handled by default |
| localStorage for redirect | Query parameters (returnUrl) | Industry standard | Transparent, shareable, debuggable |
| Separate mobile nav config | Shared nav items config | Modern pattern | Single source of truth, no drift |

**Deprecated/outdated:**
- **Hiding mobile menu with display:none**: Modern pattern is conditional rendering (not in DOM at all for logged-out)
- **Client-only useEffect auth check**: App Router favors server-side session in layout, client state is for UI only
- **Hardcoded button text in JSX**: Swedish UI should still extract strings for consistency, but inline is acceptable for this app's scale

## Open Questions

None. All requirements are straightforward composition of existing patterns:
- Conditional rendering: Standard React
- Auth state: Already using `useAuth()` hook
- Mobile drawer: Already using Radix Sheet
- Return URL: Standard query parameter pattern
- Skeleton: Built-in component exists

## Sources

### Primary (HIGH confidence)
- Codebase analysis: header.tsx, desktop-nav.tsx, mobile-menu.tsx, auth-provider.tsx, login-form.tsx
- React official docs: [Conditional Rendering](https://react.dev/learn/conditional-rendering)
- Next.js official docs: [redirect](https://nextjs.org/docs/app/api-reference/functions/redirect)
- Radix UI: [Sheet component](https://www.shadcn.io/ui/sheet) (built on Dialog primitive)

### Secondary (MEDIUM confidence)
- [Andreas Asprou: Next.js Auth Skeleton Loaders](https://andreas.fyi/writing/nextjs-auth-skeleton-loaders) - FOUC prevention patterns
- [DEV: Fixing Next.js Authentication Redirects](https://dev.to/dalenguyen/fixing-nextjs-authentication-redirects-preserving-deep-links-after-login-pkk) - Return URL patterns
- [Best Practices for Loading States in Next.js](https://www.getfishtank.com/insights/best-practices-for-loading-states-in-nextjs) - Skeleton patterns
- [Primary vs Secondary CTA Buttons](https://designcourse.com/blog/post/primary-vs-secondary-cta-buttons-in-ui-design) - Button hierarchy

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use, versions confirmed
- Architecture: HIGH - Patterns verified in existing codebase and official docs
- Pitfalls: HIGH - Based on documented issues and common auth UX problems

**Research date:** 2026-01-28
**Valid until:** 60 days (stable patterns, mature libraries, no fast-moving dependencies)
