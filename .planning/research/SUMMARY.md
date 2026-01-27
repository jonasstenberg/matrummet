# Project Research Summary

**Project:** Matrummet Settings Redesign & Home Extraction
**Domain:** UI restructuring -- settings page layout migration (horizontal tabs to sidebar) + route extraction
**Researched:** 2026-01-27
**Confidence:** HIGH

## Executive Summary

This project restructures Matrummet's settings page from horizontal tab navigation to a vertical sidebar layout, extracts the Home (Hemmet) management feature to a standalone top-level route, and introduces a dedicated Account/Danger Zone section. The existing stack -- Next.js 16 App Router, React 19, Tailwind v4, and Radix UI -- provides everything needed with zero new dependencies. The desktop sidebar uses CSS Grid (`grid-cols-[240px_1fr]`), the mobile variant reuses the existing Sheet/Dialog pattern already proven in `mobile-menu.tsx`, and active route highlighting relies on `usePathname()`. This is a well-charted territory with established patterns.

The recommended approach is to build in two sequential phases: first extract `/hemmet/` to a standalone route (independent, low-risk), then rebuild the settings layout with the sidebar (depends on Phase 1 removing the old hemmet route). All four research dimensions agree on this ordering. The architecture research confirmed that sub-routes (not anchor sections) are correct for URL addressability, browser history, and code splitting. The features research validated that left-side vertical navigation is table stakes (80% of visual attention falls left), and that the 3+1 section structure (Profil, Sakerhet, API-nycklar + Konto danger zone) fits the cognitive load guideline of 5-7 items.

The primary risks are breaking existing bookmarks when moving `/installningar/hemmet` to `/hemmet/` (mitigated with 308 redirects), losing form state during sidebar navigation (mitigated by Next.js 16 `cacheComponents` or explicit save patterns), and shipping a mobile-unusable sidebar (mitigated by mobile-first design with the Sheet drawer pattern). All 13 identified pitfalls map cleanly to specific phases, with the critical ones concentrated in Phase 1 (redirects, param access, role-based UI) and Phase 2 (mobile layout, accessibility, navigation state).

## Key Findings

### Recommended Stack

No new dependencies required. The existing stack covers all needs.

**Core technologies:**
- **CSS Grid + Tailwind v4:** Desktop sidebar layout (`grid-cols-[240px_1fr]`) -- zero JavaScript overhead, responsive breakpoints via `md:` prefix
- **Radix UI Dialog (Sheet):** Mobile navigation drawer -- already implemented in `mobile-menu.tsx`, handles focus trap and accessibility
- **`usePathname()` hook:** Active route highlighting -- built-in, accurate, works with App Router
- **Next.js App Router layouts:** Shared settings layout with auth guard -- automatic code splitting per route

**What NOT to add:** `@radix-ui/react-navigation-menu` (overkill for link lists), accordion/collapsible for submenu (flat structure is better), state management libraries (URL is the state), third-party sidebar libraries (CSS Grid suffices).

### Expected Features

**Must have (table stakes):**
- Left-side vertical navigation (240px sidebar, sticky positioning)
- Clear visual hierarchy with active state highlighting (`aria-current="page"`)
- Logical grouping: Profil, Sakerhet, API-nycklar, separated Konto danger zone
- Immediate feedback on setting changes (save confirmations, error states)
- Confirmation dialogs for destructive actions (account deletion)
- Responsive mobile layout (Sheet drawer, 44x44px touch targets)
- Keyboard navigation and screen reader support

**Should have (differentiators):**
- Calm, minimalist design (2026 trend toward uncluttered settings)
- Inline danger zone confirmation pattern (click-to-confirm instead of modal overload)
- Household name/identity with member list and role indicators (admin vs member)
- Email invitation flow with pending status tracking

**Defer (v2+):**
- Settings search functionality (only 4 sections, not needed yet)
- Activity indicators and attribution for household members
- Personal vs shared recipe separation
- Multi-email batch invitations
- Invitation link sharing as alternative to email

### Architecture Approach

Settings sections remain as sub-routes under `/installningar/` for URL addressability and SSR benefits. The Home page extracts to `/hemmet/` as a top-level route because it represents a collaborative (multi-user) concern, not a personal setting. The settings layout shifts from `max-w-2xl` to `max-w-6xl` to accommodate the sidebar, while the home page uses `max-w-4xl` without a sidebar. Navigation is centralized: the `SettingsSideMenu` client component replaces `SettingsViewToggle`, and both header dropdown and mobile menu gain a "Mitt hem" link.

**Major components:**
1. **`installningar/layout.tsx`** (Server) -- Auth guard, page header, CSS Grid container with sidebar slot and content slot
2. **`settings-side-menu.tsx`** (Client) -- Vertical nav links with icons, danger zone separator, active state from `usePathname()`
3. **`mobile-settings-menu.tsx`** (Client) -- Sheet drawer reusing sidebar navigation data, visible only below `md` breakpoint
4. **`hemmet/page.tsx`** (Server) -- Standalone home management page with `HomeSettingsClient` (existing component, no changes)
5. **`settings-view-toggle.tsx`** -- DELETED (replaced by sidebar)

### Critical Pitfalls

1. **Breaking existing bookmarks** (Critical, Phase 1) -- Implement 308 permanent redirects from `/installningar/hemmet` to `/hemmet` in `next.config.js` or middleware before removing the old route
2. **Losing form state on navigation** (Critical, Phase 2) -- Enable Next.js 16 `cacheComponents` experimental flag; test fill-navigate-return cycle; add unsaved changes warnings
3. **Unusable mobile sidebar** (Critical, Phase 2) -- Design mobile-first using Sheet drawer pattern; test on real devices; enforce 44x44px touch targets
4. **Missing accessibility attributes** (Critical, Phase 2) -- Use semantic `<nav>` with `aria-label`, `aria-current="page"` on active link, test with VoiceOver
5. **Regression test gaps after restructure** (Moderate, Phase 3) -- Update all E2E test URLs; run full test suite (unit, API, E2E) before merge; add redirect tests

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Extract Home to Standalone Route

**Rationale:** Independent of settings redesign. Can ship separately with zero risk to existing settings functionality. Architecture research confirms no shared dependencies between home management and settings layout.
**Delivers:** `/hemmet/` route as standalone page; "Mitt hem" link in header dropdown and mobile menu; 308 redirect from old URL
**Addresses:** Home management table stakes (member list, invitation flow, household settings); navigation integration
**Avoids:** Pitfall 1 (broken bookmarks via redirects), Pitfall 5 (param access -- audit before extraction), Pitfall 9 (multi-user roles -- design role-based UI from start), Pitfall 13 (update both desktop and mobile navigation)

### Phase 2: Settings Sidebar Layout

**Rationale:** Depends on Phase 1 completing (removes `/installningar/hemmet/` route). This is the core UI restructure.
**Delivers:** Vertical sidebar on desktop, Sheet drawer on mobile, new Konto/danger zone section, deletion of `SettingsViewToggle`
**Uses:** CSS Grid layout, Radix Sheet, `usePathname()` for active state
**Implements:** `settings-side-menu.tsx`, updated `installningar/layout.tsx`, `konto/page.tsx`
**Avoids:** Pitfall 2 (form state loss), Pitfall 3 (mobile-first design), Pitfall 4 (ARIA from day one), Pitfall 6 (shared active state logic via URL), Pitfall 7 (4 sections stays within 5-7 limit)

### Phase 3: Integration Testing and Polish

**Rationale:** Both structural changes complete; now verify everything works together across viewports and navigation flows.
**Delivers:** Full regression coverage, loading states, consistent spacing, cross-viewport navigation verification
**Avoids:** Pitfall 8 (form validation regression), Pitfall 10 (test gaps), Pitfall 11 (loading states), Pitfall 12 (spacing inconsistency)

### Phase Ordering Rationale

- **Phase 1 before Phase 2:** Architecture research explicitly states Phase 2 depends on Phase 1 because Phase 2 deletes `/installningar/hemmet/`. Building in this order also provides a safe incremental ship point -- if Phase 2 is delayed, Home extraction still delivers value.
- **Testing as Phase 3:** Not because it is optional, but because meaningful integration tests require both structural changes to be in place. Unit tests happen within each phase.
- **No Phase 0 needed:** The codebase already runs Next.js 16 and async request APIs are already handled (verified in existing route handlers).

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1:** Home page role-based UI specifics -- pitfalls research noted the multi-user household context lacks domain-specific patterns. Plan should validate admin vs member visibility rules against existing RLS policies.

Phases with standard patterns (skip research-phase):
- **Phase 2:** Sidebar layout is thoroughly documented across all 4 research files. CSS Grid pattern, Sheet reuse, active state via `usePathname()` -- all patterns are concrete with code examples.
- **Phase 3:** Standard testing and polish. No novel patterns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new dependencies; all patterns verified in existing codebase and official docs |
| Features | HIGH | Multiple authoritative UX sources (NN/g, Smashing, Toptal); clear table stakes vs differentiators |
| Architecture | HIGH | Route structure validated against App Router conventions; build order justified by dependency analysis |
| Pitfalls | HIGH | 13 pitfalls with Next.js 16 specifics verified via Context7; phase mapping is precise |

**Overall confidence:** HIGH

### Gaps to Address

- **`cacheComponents` stability:** This is an experimental Next.js 16 flag. If it causes issues, fall back to explicit form save patterns and unsaved-changes warnings. Validate during Phase 2 implementation.
- **Household role-based UI specifics:** Research found general multi-user patterns but not household-specific ones. During Phase 1 planning, map existing RLS policies to UI visibility rules.
- **Optimal settings category count:** Currently 4 sections (3 + danger zone). Research says 5-7 is the cognitive limit. No risk now, but enforce this limit if future features request new settings sections.

## Sources

### Primary (HIGH confidence)
- Next.js 16 official docs via Context7 (v16.1.5) -- layouts, cache components, routing
- Radix UI Dialog documentation -- Sheet/drawer foundation
- Tailwind CSS official sidebar patterns -- Grid layout utilities
- MDN/W3C -- ARIA navigation role, `aria-current`

### Secondary (MEDIUM-HIGH confidence)
- NN/g vertical navigation research -- left-side sidebar validation
- Smashing Magazine -- dangerous actions management patterns
- Toptal, LogRocket -- settings UX best practices
- SaaS Frame (97 examples) -- team/member invitation UI patterns

### Tertiary (MEDIUM confidence)
- 2026 UX trend articles (Index.dev, SetProduct) -- calm design trends
- Recipe-specific apps (Morsel, Bublup, OrganizEat) -- household sharing patterns

---
*Research completed: 2026-01-27*
*Ready for roadmap: yes*
