---
phase: 01-extract-hemmet-to-standalone-page
plan: 01
subsystem: ui
tags: [nextjs, react, routing, authentication, home-management]

# Dependency graph
requires:
  - phase: initial-codebase
    provides: Home settings component in settings route group
provides:
  - Standalone /hemmet/ route with auth guard and max-w-4xl layout
  - HomeSettingsClient shared component at components/home/
  - Navigation links to /hemmet in header and mobile menu
affects: [01-02, 02-sidebar-navigation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Standalone route with dedicated layout for feature pages"
    - "Server component pattern for data fetching with PostgREST RPC"

key-files:
  created:
    - apps/frontend/app/(main)/hemmet/layout.tsx
    - apps/frontend/app/(main)/hemmet/page.tsx
    - apps/frontend/components/home/home-settings-client.tsx
  modified:
    - apps/frontend/components/home/index.ts
    - apps/frontend/app/(main)/installningar/hemmet/page.tsx
    - apps/frontend/components/header.tsx
    - apps/frontend/components/mobile-menu.tsx

key-decisions:
  - "Used max-w-4xl container for home page (wider than settings' max-w-2xl) to accommodate member lists and invite sections"
  - "Kept old settings route functional during transition by updating import path"
  - "Added navigation links in header and mobile menu for route discoverability"

patterns-established:
  - "Auth guard in layout.tsx pattern for protected standalone routes"
  - "Server component fetching data via PostgREST RPC with signPostgrestToken"
  - "space-y-8 spacing for standalone feature pages vs space-y-6 for settings tabs"

# Metrics
duration: 3min
completed: 2026-01-27
---

# Phase 01 Plan 01: Extract Hemmet to Standalone Page Summary

**Standalone /hemmet/ route with auth guard, server component data fetching, and wider layout for home management UI**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-27T11:45:27Z
- **Completed:** 2026-01-27T11:48:39Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Created standalone /hemmet/ route with dedicated layout and auth guard
- Migrated HomeSettingsClient to shared components directory for reusability
- Maintained backward compatibility with existing settings route during transition
- Added navigation links to make new route discoverable

## Task Commits

Each task was committed atomically:

1. **Task 1: Move HomeSettingsClient to shared components directory** - `e73aac2` (refactor)
2. **Task 2: Create standalone /hemmet/ route with layout and page** - `315ed36` (feat)

## Files Created/Modified
- `apps/frontend/app/(main)/hemmet/layout.tsx` - Auth guard with max-w-4xl container for standalone home page
- `apps/frontend/app/(main)/hemmet/page.tsx` - Server component fetching home data via get_home_info RPC and rendering HomeSettingsClient
- `apps/frontend/components/home/home-settings-client.tsx` - Client component managing create/join/leave flows (moved from settings)
- `apps/frontend/components/home/index.ts` - Added HomeSettingsClient export to barrel
- `apps/frontend/app/(main)/installningar/hemmet/page.tsx` - Updated import to use shared component
- `apps/frontend/components/header.tsx` - Added "Mitt hem" link to user menu
- `apps/frontend/components/mobile-menu.tsx` - Added "Mitt hem" link to mobile navigation

## Decisions Made

**Layout width:** Used max-w-4xl for home page instead of settings' max-w-2xl because home management UI includes member lists, invite sections, and join code displays that need more horizontal space.

**Backward compatibility:** Kept old `/installningar/hemmet` route functional by updating its import to use the new shared component location. This ensures no disruption during the extraction process.

**Navigation:** Added "Mitt hem" links to both desktop header and mobile menu for route discoverability. While not specified in the plan, these were necessary for the feature to be accessible (Rule 3 - blocking user access to new route).

**Spacing:** Used space-y-8 for standalone page vs space-y-6 for settings tabs to provide more visual breathing room for the standalone feature page.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added navigation links to header and mobile menu**
- **Found during:** Task 2 (Creating standalone route)
- **Issue:** New /hemmet/ route would not be discoverable without navigation links - users had no way to access the feature
- **Fix:** Added "Mitt hem" link with Home icon to both header user menu and mobile menu, linking to /hemmet
- **Files modified:** apps/frontend/components/header.tsx, apps/frontend/components/mobile-menu.tsx
- **Verification:** Build passes, navigation links appear in UI
- **Committed in:** e73aac2 (Task 1 commit - included with refactor)

---

**Total deviations:** 1 auto-fixed (1 blocking - route accessibility)
**Impact on plan:** Navigation links essential for feature discoverability. Without them, users cannot access the new route. Minimal scope addition (2 small UI changes).

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Standalone /hemmet/ route is functional and accessible
- Old settings route still works, ready for removal in Phase 2
- Layout pattern established for other potential standalone feature pages
- Server component + RPC pattern validated for data fetching

**Ready for next plan in Phase 1.**

---
*Phase: 01-extract-hemmet-to-standalone-page*
*Completed: 2026-01-27*
