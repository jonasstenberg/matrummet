# Phase 1: Extract Hemmet to Standalone Page - Research

**Researched:** 2026-01-27
**Domain:** Route extraction and navigation integration (Next.js 16 App Router)
**Confidence:** HIGH

## Summary

Phase 1 extracts the Home management page (`/installningar/hemmet`) to a standalone route (`/hemmet`) with dedicated navigation links in both desktop and mobile menus. This research documents the EXACT current implementation, verified migration patterns, and Next.js 16-specific requirements.

**Current state:** Home management lives at `/installningar/hemmet/` with horizontal tab navigation. It uses a server component page fetching home data via `get_home_info()` RPC, and a client component (`HomeSettingsClient`) managing create/join/leave flows.

**Target state:** Home management at `/hemmet/` with dedicated navigation links. Old URL redirects permanently (308) to new location. Components migrate unchanged (no business logic changes needed).

**Primary recommendation:** Use `next.config.ts` redirects for 308 permanent redirect from old URL. Create new route structure mirroring current implementation. Update navigation components to add "Mitt hem" links. This is a pure routing change—no component refactoring required.

## Standard Stack

All required tools already exist in the current stack. No new dependencies needed.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | 16.1.5+ | Routing, layouts, server components | Built-in routing with file-based conventions |
| React | 19.2+ | Component framework | Required by Next.js 16 |
| Lucide React | Latest | Icons (Home icon for navigation) | Already used throughout app |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| next/navigation | Built-in | `redirect()`, `permanentRedirect()` | Client-side redirects in components (not needed for this phase) |
| PostgREST client | Existing | Fetch home data via RPCs | Already implemented in `home-actions.ts` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `next.config.ts` redirects | `permanentRedirect()` in page component | Config redirects are cleaner for static route changes, happen at edge |
| File-based routing | Dynamic route with middleware | File-based is Next.js convention, simpler |

**Installation:**
```bash
# No new packages needed - all tools already in stack
```

## Architecture Patterns

### Recommended Project Structure
```
apps/frontend/
├── app/(main)/
│   ├── hemmet/                     # NEW: Standalone home page
│   │   ├── layout.tsx              # Auth guard + max-width wrapper
│   │   └── page.tsx                # Server component (fetch home data)
│   └── installningar/
│       ├── hemmet/                 # DELETE: After redirect is verified
│       │   ├── page.tsx
│       │   └── home-settings-client.tsx
│       ├── layout.tsx              # Existing settings layout
│       └── page.tsx                # Existing Profil page
├── components/
│   ├── header.tsx                  # UPDATE: Add "Mitt hem" link
│   ├── mobile-menu.tsx             # UPDATE: Add "Mitt hem" link
│   └── home/                       # EXISTING: No changes needed
│       ├── home-settings.tsx
│       ├── home-setup-wizard.tsx
│       └── ...
└── next.config.ts                  # UPDATE: Add 308 redirect
```

### Pattern 1: Route Extraction with Redirect

**What:** Move existing page from nested route to top-level route while preserving old URL access.

**When to use:** When changing URL structure but need to maintain backward compatibility.

**Example:**
```typescript
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  // ... existing config

  async redirects() {
    return [
      {
        source: '/installningar/hemmet',
        destination: '/hemmet',
        permanent: true, // 308 status code
      },
    ]
  },
}

export default nextConfig
```
**Source:** [Next.js redirects documentation](https://nextjs.org/docs/app/api-reference/config/next-config-js/redirects)

### Pattern 2: Layout Migration (Minimal Change)

**What:** Create new layout that mirrors existing auth guard pattern.

**When to use:** When extracting route but not changing layout structure.

**Example:**
```typescript
// apps/frontend/app/(main)/hemmet/layout.tsx
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function HomeLayout({
  children,
}: {
  children: React.ReactNode
}) {
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
**Source:** Current `installningar/layout.tsx` pattern (verified in codebase)

### Pattern 3: Page Migration (Identical Logic)

**What:** Copy server component page logic to new route without changes.

**When to use:** When route structure changes but data fetching logic stays the same.

**Example:**
```typescript
// apps/frontend/app/(main)/hemmet/page.tsx
import { getSession, signPostgrestToken } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { HomeSettingsClient } from '@/components/home/home-settings-client'
import { env } from '@/lib/env'

async function getHomeInfo(token: string) {
  const response = await fetch(`${env.POSTGREST_URL}/rpc/get_home_info`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
    cache: 'no-store',
  })

  if (!response.ok) {
    return null
  }

  const result = await response.json()

  if (result === null) {
    return null
  }

  return {
    id: result.id,
    name: result.name,
    join_code: result.join_code,
    join_code_expires_at: result.join_code_expires_at,
    member_count: result.members?.length || 0,
    members: result.members || [],
  }
}

export default async function HomePage() {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

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
**Source:** Current `installningar/hemmet/page.tsx` (verified in codebase)

### Pattern 4: Navigation Integration

**What:** Add new navigation link to both desktop dropdown and mobile menu.

**When to use:** When creating new top-level page that needs global navigation access.

**Desktop Header Example:**
```typescript
// apps/frontend/components/header.tsx (user dropdown section)
import { Home } from 'lucide-react'

// Inside user menu dropdown:
<Link
  href="/mitt-skafferi"
  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
  onClick={() => setUserMenuOpen(false)}
>
  <UtensilsCrossed className="h-4 w-4" />
  Mitt skafferi
</Link>
<Link
  href="/inkopslista"
  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
  onClick={() => setUserMenuOpen(false)}
>
  <ShoppingCart className="h-4 w-4" />
  Inköpslista
</Link>
{/* NEW: Add Mitt hem link */}
<Link
  href="/hemmet"
  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
  onClick={() => setUserMenuOpen(false)}
>
  <Home className="h-4 w-4" />
  Mitt hem
</Link>
<Link
  href="/krediter"
  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
  onClick={() => setUserMenuOpen(false)}
>
  <Sparkles className="h-4 w-4" />
  AI-krediter
</Link>
```

**Mobile Menu Example:**
```typescript
// apps/frontend/components/mobile-menu.tsx
import { Home } from 'lucide-react'

// Inside navigation section (after Inköpslista, before AI-krediter):
<Link
  href="/inkopslista"
  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
  onClick={() => setOpen(false)}
>
  <ShoppingCart className="h-4 w-4" />
  Inköpslista
</Link>
{/* NEW: Add Mitt hem link */}
<Link
  href="/hemmet"
  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
  onClick={() => setOpen(false)}
>
  <Home className="h-4 w-4" />
  Mitt hem
</Link>
<Link
  href="/krediter"
  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
  onClick={() => setOpen(false)}
>
  <Sparkles className="h-4 w-4" />
  AI-krediter
</Link>
```
**Source:** Current header.tsx and mobile-menu.tsx patterns (verified in codebase)

### Anti-Patterns to Avoid

- **Don't use `permanentRedirect()` in page component:** Config-based redirects are cleaner for static route changes, happen at edge before server component execution.
- **Don't refactor components during route migration:** Move first, refactor later. Mixing route changes with component changes increases risk of breakage.
- **Don't delete old route immediately:** Verify redirect works in production before removing old files.
- **Don't change RLS policies:** Home data access is already correctly scoped to household members via `home_id` column and RLS policies. No database changes needed.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| URL redirects | Custom middleware redirect logic | `next.config.ts` redirects | Built-in, edge-optimized, handles all HTTP methods correctly |
| Permanent redirect (308) | `redirect()` with manual status code | `permanent: true` in config or `permanentRedirect()` | Next.js provides correct 308 (not 301) for method-preserving redirects |
| Route parameter extraction | Manual URL parsing | Next.js App Router file-based routing | Automatic, type-safe, works with layouts |
| Navigation state management | React context for "active page" | No state needed—URL is source of truth | Let Next.js handle it; avoid unnecessary client state |

**Key insight:** Next.js App Router already provides everything needed for route extraction. No custom routing logic required.

## Common Pitfalls

### Pitfall 1: Breaking Existing Bookmarks

**What goes wrong:** Users have bookmarked `/installningar/hemmet`. After extraction, bookmarks return 404.

**Why it happens:** Old route deleted without redirect in place.

**How to avoid:**
1. Add redirect in `next.config.ts` BEFORE deleting old route
2. Test redirect works (visit old URL, verify 308 redirect to new URL)
3. Only delete old route after redirect is verified in production

**Warning signs:**
- 404 errors in analytics for old URL
- Support tickets about "settings page not found"
- Browser back button leads to 404

**Specific to this phase:** Old URL is `/installningar/hemmet`, new is `/hemmet`. Redirect MUST be in place before Phase 2 deletes settings routes.

---

### Pitfall 2: Component Import Path Breakage

**What goes wrong:** `HomeSettingsClient` component moves from `app/(main)/installningar/hemmet/home-settings-client.tsx` to `components/home/home-settings-client.tsx`, breaking imports.

**Why it happens:** Component was co-located with page but should be in global components directory.

**How to avoid:**
1. FIRST verify where `HomeSettingsClient` lives (check imports)
2. If it's in `hemmet/` directory, move it to `components/home/` BEFORE creating new route
3. Update import path in new page: `@/components/home/home-settings-client`

**Warning signs:**
- TypeScript errors: "Cannot find module"
- Build failures
- Runtime errors about missing components

**Specific to this phase:** Current location is `app/(main)/installningar/hemmet/home-settings-client.tsx`. Should move to `components/home/home-settings-client.tsx` for consistency with other home components.

---

### Pitfall 3: Missing Navigation Link Icon Import

**What goes wrong:** Add "Mitt hem" link with `<Home />` icon but forget to import `Home` from `lucide-react`.

**Why it happens:** Copying link pattern from existing code but not checking imports.

**How to avoid:**
1. When adding Home icon, verify import exists: `import { Home } from 'lucide-react'`
2. Check if `Home` is already imported in file (it's not in current header.tsx or mobile-menu.tsx)
3. Add to existing icon imports at top of file

**Warning signs:**
- TypeScript error: "'Home' is not defined"
- Build failure
- Linter error about undefined component

**Specific to this phase:** Both `header.tsx` and `mobile-menu.tsx` need `Home` added to their icon imports.

---

### Pitfall 4: Redirect Triggers on Trailing Slash

**What goes wrong:** User visits `/installningar/hemmet/` (with trailing slash), redirect pattern doesn't match.

**Why it happens:** Next.js redirect `source` doesn't account for trailing slash variations.

**How to avoid:**
1. Test both `/installningar/hemmet` and `/installningar/hemmet/`
2. Add trailing slash handling if needed
3. Consider `trailingSlash: false` in `next.config.ts` for consistency

**Warning signs:**
- Redirect works for `/installningar/hemmet` but 404s for `/installningar/hemmet/`
- Users report "sometimes it works, sometimes it doesn't"

**Specific to this phase:** Current Next.js config doesn't specify `trailingSlash`. Default is `false`, so both URLs should work, but verify in testing.

---

### Pitfall 5: Auth Guard Duplication Logic Drift

**What goes wrong:** New `/hemmet/layout.tsx` copies auth guard from `/installningar/layout.tsx`. Later, auth logic updates in one but not the other.

**Why it happens:** Duplicated code instead of shared auth guard component.

**How to avoid:**
1. Accept duplication for Phase 1 (simple copy-paste)
2. Add TODO comment for future refactoring
3. Consider extracting to shared component in later phase

**Warning signs:**
- Auth behavior differs between settings and home pages
- Security vulnerabilities in one route but not the other
- Inconsistent redirect behavior

**Specific to this phase:** Acceptable to duplicate for MVP. Note in plan that auth guard refactoring is future work.

---

### Pitfall 6: Max-Width Inconsistency

**What goes wrong:** Settings layout uses `max-w-2xl`, new home layout uses `max-w-4xl`. Feels jarring when navigating between pages.

**Why it happens:** Copying layout from different source or guessing appropriate width.

**How to avoid:**
1. Decide on max-width based on content needs (home page has wider member list, invite sections)
2. Document decision: "Home page uses max-w-4xl (wider than settings max-w-2xl) to accommodate member list and invite sections side-by-side"
3. Keep consistent within each section (don't mix widths)

**Warning signs:**
- Designer flags "layout feels inconsistent"
- Content appears cramped or too spread out

**Specific to this phase:** Recommendation is `max-w-4xl` for home page (wider content), keep `max-w-2xl` for settings. Document this decision.

---

### Pitfall 7: Forgetting Mobile Menu Update

**What goes wrong:** Desktop header gets "Mitt hem" link, mobile menu doesn't. Mobile users can't access home page.

**Why it happens:** Desktop and mobile navigation are separate components. Developer updates one, forgets the other.

**How to avoid:**
1. Checklist: "Update BOTH header.tsx AND mobile-menu.tsx"
2. Test on mobile viewport before considering task done
3. Code review checks for navigation parity

**Warning signs:**
- Mobile users report "can't find home settings"
- Desktop works fine, mobile doesn't
- Different navigation items between viewports

**Specific to this phase:** MUST update both files. Add verification step in plan.

---

## Code Examples

Verified patterns from official sources and current codebase:

### Next.js Config Redirect (308 Permanent)

```typescript
// apps/frontend/next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['sharp'],
  outputFileTracingIncludes: {
    '/*': ['node_modules/sharp/**/*'],
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 31536000,
  },

  // NEW: Add redirect for old home settings URL
  async redirects() {
    return [
      {
        source: '/installningar/hemmet',
        destination: '/hemmet',
        permanent: true, // 308 status code (method-preserving permanent redirect)
      },
    ]
  },
}

export default nextConfig
```
**Source:** [Next.js redirects documentation](https://nextjs.org/docs/app/api-reference/config/next-config-js/redirects)

**Why 308 not 301:** Next.js uses 308 (permanent) instead of 301 to preserve HTTP method. If user POSTs to old URL, 308 preserves POST; 301 would convert to GET.

### Server Component Data Fetching Pattern

```typescript
// apps/frontend/app/(main)/hemmet/page.tsx
import { getSession, signPostgrestToken } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { HomeSettingsClient } from '@/components/home/home-settings-client'
import { env } from '@/lib/env'

// Inline fetch function (same as current implementation)
async function getHomeInfo(token: string) {
  const response = await fetch(`${env.POSTGREST_URL}/rpc/get_home_info`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
    cache: 'no-store', // Don't cache home data (multi-user, real-time)
  })

  if (!response.ok) {
    return null
  }

  const result = await response.json()

  // RPC returns JSONB directly (not array-wrapped)
  if (result === null) {
    return null
  }

  return {
    id: result.id,
    name: result.name,
    join_code: result.join_code,
    join_code_expires_at: result.join_code_expires_at,
    member_count: result.members?.length || 0,
    members: result.members || [],
  }
}

export default async function HomePage() {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

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
**Source:** Current `apps/frontend/app/(main)/installningar/hemmet/page.tsx` (verified in codebase)

### Layout with Auth Guard

```typescript
// apps/frontend/app/(main)/hemmet/layout.tsx
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function HomeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="space-y-2 mb-8">
        {/* Optional: Page-level header here, or let page.tsx handle it */}
      </div>
      {children}
    </div>
  )
}
```
**Source:** Current `apps/frontend/app/(main)/installningar/layout.tsx` pattern (verified in codebase)

**Note:** Removed page header from layout to avoid duplication (page.tsx already has header). Layout only provides auth guard and container width.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 301/302 redirects | 307/308 redirects | Next.js 13+ | Preserves HTTP method (POST stays POST) |
| Manual redirect middleware | `next.config.ts` redirects | Next.js 13+ | Edge-optimized, cleaner config |
| `redirect()` for permanent | `permanentRedirect()` | Next.js 14+ | Explicit 308 status code |
| Route params sync access | Async params | Next.js 16 | Breaking change: must `await params` |

**Deprecated/outdated:**
- **Client-side redirects for route changes:** Use Next.js config redirects instead (happen at edge, faster)
- **Synchronous `params` access:** Next.js 16 requires `await params` (breaking change from v15)

## Open Questions

Things that couldn't be fully resolved:

1. **Should `HomeSettingsClient` move to `components/home/` directory?**
   - What we know: Currently at `app/(main)/installningar/hemmet/home-settings-client.tsx`
   - What's unclear: Whether it should stay co-located with page or move to global components
   - Recommendation: Move to `components/home/home-settings-client.tsx` for consistency with other home components (`home-settings.tsx`, `home-setup-wizard.tsx`, etc.)

2. **What max-width should home page use?**
   - What we know: Settings uses `max-w-2xl`, home has wider content (member list, invite sections)
   - What's unclear: Exact optimal width for home content
   - Recommendation: Use `max-w-4xl` (wider than settings) to accommodate multi-column layouts

3. **Should we test redirect with both trailing slash variants?**
   - What we know: Next.js default is `trailingSlash: false`
   - What's unclear: Whether both `/installningar/hemmet` and `/installningar/hemmet/` need explicit testing
   - Recommendation: Test both variants to verify redirect works consistently

## Sources

### Primary (HIGH confidence)
- Next.js v16 App Router - File-based routing conventions (verified in codebase)
- [Next.js redirects documentation](https://nextjs.org/docs/app/api-reference/config/next-config-js/redirects)
- [Next.js permanentRedirect function](https://nextjs.org/docs/app/api-reference/functions/permanentRedirect)
- Current codebase implementation:
  - `apps/frontend/app/(main)/installningar/hemmet/page.tsx`
  - `apps/frontend/app/(main)/installningar/hemmet/home-settings-client.tsx`
  - `apps/frontend/components/header.tsx`
  - `apps/frontend/components/mobile-menu.tsx`
  - `apps/frontend/lib/home-actions.ts`
  - `flyway/sql/V38__homes_feature.sql` (RLS policies)

### Secondary (MEDIUM confidence)
- [How To Permanently Redirect (301, 308) with Next JS - Rob Marshall](https://robertmarshall.dev/blog/how-to-permanently-redirect-301-308-with-next-js/)
- [Next.js 308 redirect discussion - GitHub](https://github.com/vercel/next.js/discussions/15432)
- Project research documents:
  - `.planning/research/ARCHITECTURE.md` (route structure recommendations)
  - `.planning/research/PITFALLS.md` (routing pitfalls)
  - `.planning/research/STACK.md` (technology patterns)

### Tertiary (LOW confidence)
- None (all findings verified with official docs or codebase inspection)

## Metadata

**Confidence breakdown:**
- Route extraction pattern: HIGH - Verified with Next.js docs and codebase
- Redirect implementation: HIGH - Verified with official Next.js documentation
- Navigation integration: HIGH - Verified by inspecting current header/mobile-menu patterns
- Component migration: HIGH - Current implementation inspected directly
- RLS policies: HIGH - Database schema inspected in `V38__homes_feature.sql`

**Research date:** 2026-01-27
**Valid until:** 60 days (Next.js routing patterns are stable)

**Key findings:**
1. **No component refactoring needed:** Page, layout, and client components can be copied almost verbatim
2. **Redirect is critical:** Must be in place before old route deletion (Phase 2 dependency)
3. **Navigation is straightforward:** Add one link to two files (header.tsx, mobile-menu.tsx)
4. **Zero database changes:** RLS policies already correctly scope home data by `home_id`
5. **Home icon import required:** Both navigation files need `import { Home } from 'lucide-react'`

**What makes this phase simple:**
- Pure routing change (no business logic changes)
- Components already well-structured (clean separation of concerns)
- Auth guard pattern already established
- Data fetching already correctly implemented
- RLS already enforces household access control

**What makes this phase critical:**
- Foundation for Phase 2 (settings sidebar redesign depends on this being complete)
- URL structure becomes permanent (redirect must be correct from day one)
- Navigation UX improves (users get dedicated home management access)
