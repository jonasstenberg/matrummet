# Architecture Research: Settings Redesign & Home Extraction

**Research Date:** 2026-01-27
**Research Type:** Architecture dimension
**Milestone Context:** Subsequent milestone — restructuring existing Next.js App Router pages

---

## Executive Summary

The settings page redesign requires migrating from horizontal tab navigation to a vertical side menu layout, while extracting the Home management feature to a standalone page. This research defines the optimal route structure, layout hierarchy, and component architecture for Next.js App Router to support both changes.

**Key Decision:** Settings sections should remain as sub-routes (not anchor-based sections) to maintain URL addressability, browser history, and SSR benefits. The Home page should be extracted to a top-level route.

---

## Current Architecture

### Route Structure
```
/installningar/                    # Profil tab (default)
/installningar/sakerhet/           # Security tab
/installningar/api-nycklar/        # API Keys tab
/installningar/hemmet/             # Home management tab
```

### Component Hierarchy
```
apps/frontend/app/(main)/installningar/
  ├── layout.tsx                   # Auth guard + page header
  ├── page.tsx                     # Profil content + SettingsViewToggle
  ├── sakerhet/
  │   └── page.tsx                 # Security content + SettingsViewToggle
  ├── api-nycklar/
  │   └── page.tsx                 # API Keys content + SettingsViewToggle
  └── hemmet/
      ├── page.tsx                 # Home management content + SettingsViewToggle
      └── home-settings-client.tsx # Client component for home features
```

### Navigation Pattern
- **SettingsViewToggle Component**: Horizontal tab bar with border-bottom active indicator
- **Placement**: Repeated in each page component
- **Active State**: Passed as prop (`activeView="profil"`)
- **Implementation**: Client component using Next.js Link for navigation

### Existing Layout Patterns in Codebase

**Admin Layout (side navigation reference):**
- Location: `/apps/frontend/app/(main)/admin/layout.tsx`
- Pattern: Horizontal tab navigation at top of layout
- Links array with `{ href, label }`
- Active state via `usePathname()` hook
- Wraps all admin pages

**Settings Layout (current):**
- Location: `/apps/frontend/app/(main)/installningar/layout.tsx`
- Pattern: Simple auth guard with header
- No navigation component (delegated to child pages)
- Max-width container (`max-w-2xl`)

---

## Recommended Architecture

### New Route Structure

```
/installningar/                    # Settings with side menu (Profil default)
/installningar/sakerhet/           # Security section
/installningar/api-nycklar/        # API Keys section
/installningar/konto/              # NEW: Account section (danger zone)
/hemmet/                           # NEW: Standalone home management page
```

**Rationale for Sub-routes:**
1. **URL Addressability**: Users can bookmark `/installningar/sakerhet` directly
2. **Browser History**: Back/forward buttons work naturally between sections
3. **SSR Benefits**: Each section can server-render independently
4. **Code Splitting**: Next.js automatically splits each route's code
5. **Consistent with Admin Pattern**: Aligns with existing admin navigation pattern

**Rationale for `/hemmet/` (not `/installningar/hemmet/`):**
1. Home management is conceptually separate from personal settings
2. Home affects multiple users (shared context), settings affect individual user
3. Clearer mental model: settings = personal, home = collaborative
4. Allows different layout constraints (home may need different max-width)
5. Matches user dropdown structure (separate menu item from Inställningar)

### Component Hierarchy

```
apps/frontend/app/(main)/
  ├── installningar/
  │   ├── layout.tsx                      # NEW: Side menu layout + auth guard
  │   ├── page.tsx                        # Profil content (no toggle)
  │   ├── sakerhet/
  │   │   └── page.tsx                    # Security content (no toggle)
  │   ├── api-nycklar/
  │   │   └── page.tsx                    # API Keys content (no toggle)
  │   └── konto/
  │       └── page.tsx                    # NEW: Account danger zone (no toggle)
  └── hemmet/
      ├── layout.tsx                      # NEW: Simple auth guard layout
      └── page.tsx                        # Home management content
```

```
apps/frontend/components/
  ├── settings-side-menu.tsx              # NEW: Vertical navigation component
  ├── home/                               # EXISTING: Home-related components
  │   ├── home-settings.tsx
  │   ├── home-member-list.tsx
  │   ├── home-invite-section.tsx
  │   └── ...
  └── settings-view-toggle.tsx            # REMOVE: No longer needed
```

---

## Detailed Component Design

### Settings Side Menu Component

**File:** `apps/frontend/components/settings-side-menu.tsx`

**Responsibilities:**
- Render vertical navigation with icons
- Highlight active section based on current pathname
- Responsive: full-width on mobile, fixed-width sidebar on desktop
- Sections: Profil, Säkerhet, API-nycklar, Konto
- Danger Zone separator before Konto section

**Key Characteristics:**
- Client component (`"use client"`) for `usePathname()` hook
- Uses Lucide icons for visual hierarchy
- Matches existing nav patterns (admin, header dropdown)
- Active state via pathname matching
- Link-based navigation (no client-side routing)

**Implementation Pattern (based on admin layout):**
```tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { User, Shield, Key, AlertTriangle } from "lucide-react"

const settingsLinks = [
  { href: "/installningar", label: "Profil", icon: User },
  { href: "/installningar/sakerhet", label: "Säkerhet", icon: Shield },
  { href: "/installningar/api-nycklar", label: "API-nycklar", icon: Key },
]

const dangerLinks = [
  { href: "/installningar/konto", label: "Konto", icon: AlertTriangle },
]

export function SettingsSideMenu() {
  const pathname = usePathname()

  return (
    <nav className="space-y-6">
      <div className="space-y-1">
        {settingsLinks.map((link) => (
          <Link key={link.href} href={link.href} className={...}>
            <link.icon className="h-4 w-4" />
            {link.label}
          </Link>
        ))}
      </div>

      <div className="pt-4 border-t space-y-1">
        <p className="text-xs text-muted-foreground px-3 mb-2">Farlig zon</p>
        {dangerLinks.map((link) => (...))}
      </div>
    </nav>
  )
}
```

### Settings Layout Component

**File:** `apps/frontend/app/(main)/installningar/layout.tsx`

**Responsibilities:**
- Auth guard (redirect to `/login` if not authenticated)
- Render page header ("Inställningar")
- Render side menu (desktop: left sidebar, mobile: top navigation)
- Provide content container with appropriate max-width
- Responsive grid layout (sidebar + content)

**Layout Structure:**
```tsx
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

      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-8">
        {/* Side menu - hidden on mobile, shown on desktop */}
        <aside className="hidden md:block">
          <SettingsSideMenu />
        </aside>

        {/* Mobile menu - shown on mobile, hidden on desktop */}
        <div className="md:hidden">
          <SettingsSideMenu />
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

**Key Layout Decisions:**
- **Max-width**: `max-w-6xl` (wider than current `max-w-2xl` to accommodate sidebar)
- **Grid Layout**: `grid-cols-[240px_1fr]` — fixed 240px sidebar, flexible content
- **Responsive**: Sidebar hidden on mobile (`md:block`), top nav shown (`md:hidden`)
- **Content Container**: `min-w-0` prevents content overflow in grid

### Home Page Layout

**File:** `apps/frontend/app/(main)/hemmet/layout.tsx`

**Responsibilities:**
- Auth guard (redirect to `/login` if not authenticated)
- Simple wrapper with max-width constraint
- No side menu (standalone page)

**Layout Structure:**
```tsx
export default async function HomeLayout({ children }) {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  return (
    <div className="max-w-4xl mx-auto">
      {children}
    </div>
  )
}
```

**File:** `apps/frontend/app/(main)/hemmet/page.tsx`

**Responsibilities:**
- Fetch home info via `get_home_info()` RPC
- Render page header ("Mitt hem" or similar)
- Render home management components (existing `HomeSettingsClient`)

**Pattern (migrated from current `/installningar/hemmet/page.tsx`):**
```tsx
export default async function HomePage() {
  const session = await getSession()
  const postgrestToken = await signPostgrestToken(session.email)
  const home = await getHomeInfo(postgrestToken)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-bold">Mitt hem</h1>
        <p className="text-muted-foreground">
          Hantera ditt hem och medlemmar
        </p>
      </div>

      <HomeSettingsClient home={home} userEmail={session.email} />
    </div>
  )
}
```

---

## Navigation Integration

### Header User Dropdown

**File:** `apps/frontend/components/header.tsx`

**Changes Required:**
- Add "Mitt hem" link to user dropdown (after "Inköpslista", before "AI-krediter")
- Update existing "Inställningar" link (no changes to href)

**Updated Dropdown Structure:**
```tsx
<Link href="/mitt-skafferi">Mitt skafferi</Link>
<Link href="/inkopslista">Inköpslista</Link>
<Link href="/hemmet">Mitt hem</Link>           {/* NEW */}
<Link href="/krediter">AI-krediter</Link>
<Link href="/installningar">Inställningar</Link>
{isAdmin(user) && <Link href="/admin/kategorier">Admin</Link>}
<button onClick={logout}>Logga ut</button>
```

### Mobile Menu

**File:** `apps/frontend/components/mobile-menu.tsx`

**Changes Required:**
- Add "Mitt hem" link with Home icon (after "Inköpslista", before "AI-krediter")
- Update existing "Inställningar" link (no changes to href)

**Icon:** Use `Home` from `lucide-react`

---

## Responsive Behavior

### Desktop (≥768px)

**Settings Page:**
- Side menu fixed at 240px width (left sidebar)
- Content area flexible (fills remaining space)
- Both visible simultaneously

**Home Page:**
- Centered content with `max-w-4xl`
- No sidebar

### Mobile (<768px)

**Settings Page:**
- Side menu shown as horizontal scrollable nav at top
- Content area full width below menu
- Stacked vertically

**Home Page:**
- Full width content (respecting container padding)

---

## Migration Strategy & Build Order

### Phase 1: Extract Home Page (Independent)
**Can be built first** — no dependencies on settings redesign

1. Create `/apps/frontend/app/(main)/hemmet/layout.tsx`
2. Create `/apps/frontend/app/(main)/hemmet/page.tsx`
3. Move content from `/installningar/hemmet/page.tsx` to new location
4. Update imports for `HomeSettingsClient` component (no changes to component itself)
5. Add "Mitt hem" link to header dropdown and mobile menu
6. Test home page functionality in isolation

**Acceptance Criteria:**
- `/hemmet/` route accessible and functional
- Home info fetched and displayed correctly
- Create/join/leave home flows work
- Member list displays
- Invite code generation works

### Phase 2: Settings Side Menu (Depends on Phase 1 completion)
**Must be built after** — removes `/installningar/hemmet/` route

1. Create `SettingsSideMenu` component
2. Update `/installningar/layout.tsx` with side menu
3. Remove `SettingsViewToggle` from all settings pages
4. Create `/installningar/konto/page.tsx` for danger zone
5. Update settings page components (remove toggle, adjust spacing)
6. Delete `SettingsViewToggle` component
7. Delete `/installningar/hemmet/` directory
8. Test all settings sections with new navigation

**Acceptance Criteria:**
- Side menu visible on all settings pages
- Active state highlights correct section
- All settings sections functional
- Responsive layout works on mobile/desktop
- `/installningar/hemmet/` route returns 404 (removed)

### Phase 3: Integration Testing
1. Test navigation flows (header → settings → home)
2. Test browser back/forward buttons
3. Test direct URL access to all routes
4. Test mobile menu navigation
5. Test responsive breakpoints
6. Verify auth guards on both `/installningar/` and `/hemmet/`

---

## Component Boundaries

### Clear Separation of Concerns

**Layout Components (Server Components):**
- `apps/frontend/app/(main)/installningar/layout.tsx` — Settings layout with side menu
- `apps/frontend/app/(main)/hemmet/layout.tsx` — Home layout (simple wrapper)

**Page Components (Server Components):**
- `apps/frontend/app/(main)/installningar/page.tsx` — Profil content
- `apps/frontend/app/(main)/installningar/sakerhet/page.tsx` — Security content
- `apps/frontend/app/(main)/installningar/api-nycklar/page.tsx` — API Keys content
- `apps/frontend/app/(main)/installningar/konto/page.tsx` — Account danger zone
- `apps/frontend/app/(main)/hemmet/page.tsx` — Home management

**Navigation Components (Client Components):**
- `apps/frontend/components/settings-side-menu.tsx` — Settings navigation (NEW)
- `apps/frontend/components/header.tsx` — Global header with user dropdown (UPDATE)
- `apps/frontend/components/mobile-menu.tsx` — Mobile sheet menu (UPDATE)

**Feature Components (Client Components):**
- `apps/frontend/components/profile-form.tsx` — Profil form
- `apps/frontend/components/security-form.tsx` — Security form
- `apps/frontend/components/api-key-manager.tsx` — API Keys manager
- `apps/frontend/components/home/home-settings.tsx` — Home settings (existing)
- All other feature-specific components (no changes)

**Components to Remove:**
- `apps/frontend/components/settings-view-toggle.tsx` — Replaced by SettingsSideMenu

---

## Data Flow & State Management

### Settings Pages
**No change** — each page fetches its own data server-side

- **Profil**: No data fetching (uses auth context from layout)
- **Säkerhet**: No data fetching (form for password change)
- **API-nycklar**: Server-side fetch of API keys via `getApiKeys()` action
- **Konto**: No data fetching (danger zone actions)

### Home Page
**Migrated from current implementation**

- **Server-side**: Fetch home info via `get_home_info()` RPC in page component
- **Client-side**: `HomeSettingsClient` manages home creation, joining, leaving, invite codes
- **Actions**: Use existing home actions from `lib/home-actions.ts`

### Navigation State
- **Active Section**: Determined by `usePathname()` in `SettingsSideMenu`
- **No Global State**: No need for context or state management for navigation

---

## Accessibility Considerations

### Keyboard Navigation
- Tab order: logo → search → user menu → side menu → content
- Arrow keys for side menu navigation (native link behavior)
- Focus visible states on all interactive elements

### Screen Readers
- Semantic HTML: `<nav>`, `<aside>`, `<main>` elements
- ARIA labels: `aria-label="Inställningar navigation"`
- Active state announced: `aria-current="page"` on active link

### Mobile Usability
- Touch targets: minimum 44x44px for all links
- Horizontal scroll for mobile menu (if needed)
- Clear visual separation between sections

---

## Testing Strategy

### Unit Tests
- `SettingsSideMenu` component: active state logic, link rendering
- Layout components: auth guard redirects

### Integration Tests
- Navigation flows: clicking links updates URL and content
- Responsive behavior: side menu visibility at breakpoints
- Auth guards: unauthenticated access redirects

### E2E Tests
- User journey: header dropdown → settings → section navigation → home page
- Mobile menu: sheet open/close, navigation, home link
- Direct URL access: `/installningar/sakerhet` loads correct content

---

## Performance Considerations

### Code Splitting
- Each settings route automatically split by Next.js
- Home page split separately from settings
- Side menu component bundled with settings layout

### Server-Side Rendering
- All pages server-render with auth data
- No client-side navigation delays (Link preloading)
- Minimal layout shift (fixed sidebar width)

### Caching
- Settings pages: no caching (user-specific data)
- Home page: no caching (home-specific data)
- Navigation components: static (cached)

---

## Risk Assessment & Mitigations

### Risk: Breaking Existing Bookmarks
**Impact:** Users with bookmarked `/installningar/hemmet/` links will 404
**Mitigation:** Add redirect in Next.js middleware or page component
```tsx
// apps/frontend/app/(main)/installningar/hemmet/page.tsx (temporary)
export default function OldHomeSettingsPage() {
  redirect('/hemmet')
}
```

### Risk: Mobile Side Menu Overflow
**Impact:** Too many sections could cause horizontal scroll or cramped UI
**Mitigation:** Use vertical stacking on mobile (not horizontal tabs)

### Risk: Home Icon Confusion
**Impact:** "Home" icon might conflict with "Hem" (recipes homepage)
**Mitigation:** Use `Home` icon with clear label "Mitt hem" to differentiate from recipe home

### Risk: Inconsistent Layout Widths
**Impact:** Settings (max-w-6xl) vs Home (max-w-4xl) may feel jarring
**Mitigation:** Use consistent max-widths; align with content needs (settings wider for sidebar)

---

## Quality Gate Checklist

- [x] Route structure is explicit and justified
- [x] Component boundaries clearly defined with file paths
- [x] Build order implications noted (Phase 1 → Phase 2 → Phase 3)
- [x] Responsive behavior specified for mobile/desktop
- [x] Navigation integration points identified (header, mobile menu)
- [x] Data flow patterns documented
- [x] Accessibility considerations included
- [x] Migration risks identified with mitigations
- [x] Testing strategy defined
- [x] Performance implications considered

---

## Appendix: Codebase Patterns Reference

### Next.js App Router Conventions
- Route groups: `(main)`, `(auth)` — organize routes without affecting URL
- Layouts: `layout.tsx` — shared UI wrapper for route segment and children
- Pages: `page.tsx` — unique UI for a route
- Server Components by default — no `"use client"` needed

### Layout Nesting
```
app/
  layout.tsx                 # Root layout (metadata, fonts, global styles)
  (main)/
    layout.tsx              # Main layout (header, footer, auth context)
    installningar/
      layout.tsx            # Settings layout (side menu, page header)
      page.tsx              # Settings page (Profil section)
      sakerhet/
        page.tsx            # Nested page (Security section)
```

### Auth Guard Pattern (from existing codebase)
```tsx
export default async function Layout({ children }) {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  return <div>{children}</div>
}
```

### Active Route Detection (from admin layout)
```tsx
"use client"

import { usePathname } from "next/navigation"

export function Navigation() {
  const pathname = usePathname()

  return (
    <Link
      href="/path"
      className={pathname === "/path" ? "active" : "inactive"}
    >
      Label
    </Link>
  )
}
```

---

**Research Complete:** 2026-01-27
**Next Step:** Use this architecture document to structure phases in roadmap
