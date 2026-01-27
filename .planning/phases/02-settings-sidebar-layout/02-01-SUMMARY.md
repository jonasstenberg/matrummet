---
phase: 02-settings-sidebar-layout
plan: 01
subsystem: ui
tags: [react, next.js, tailwind, navigation, accessibility]

# Dependency graph
requires:
  - phase: 01-extract-hemmet-to-standalone-page
    provides: Standalone home page navigation structure
provides:
  - Desktop vertical sidebar navigation with sticky positioning
  - Mobile horizontal pill navigation with scrolling
  - CSS Grid layout for settings pages
  - Danger zone separator pattern for destructive actions
affects: [02-02, 02-03, 02-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Responsive navigation with CSS Grid (desktop sidebar, mobile pills)
    - aria-current="page" for accessibility
    - Danger zone separation with visual styling

key-files:
  created:
    - apps/frontend/components/settings-sidebar.tsx
    - apps/frontend/components/settings-pill-nav.tsx
  modified:
    - apps/frontend/app/(main)/installningar/layout.tsx
    - apps/frontend/app/(main)/installningar/page.tsx
    - apps/frontend/app/(main)/installningar/sakerhet/page.tsx
    - apps/frontend/app/(main)/installningar/api-nycklar/page.tsx

key-decisions:
  - "Used CSS Grid with grid-cols-[240px_1fr] for precise sidebar width control"
  - "Separated danger zone with Separator component and uppercase label styling"
  - "Active pill styling uses bg-warm for regular items, bg-destructive for danger items"
  - "Sticky sidebar positioned at top-20 to stay visible during scroll"

patterns-established:
  - "Sidebar navigation: vertical links with rounded-md pills, sticky positioning"
  - "Pill navigation: horizontal scrolling with flex-shrink-0 and whitespace-nowrap"
  - "Danger zone UI: Separator + uppercase label + destructive color styling"

# Metrics
duration: 2min
completed: 2026-01-27
---

# Phase 02 Plan 01: Settings Sidebar Layout Summary

**CSS Grid settings layout with 240px sticky sidebar on desktop and horizontal scrolling pills on mobile, featuring danger zone separation**

## Performance

- **Duration:** 2 min
- **Started:** 2026-01-27T22:11:13Z
- **Completed:** 2026-01-27T22:13:29Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Created responsive navigation infrastructure with desktop sidebar and mobile pill tabs
- Implemented CSS Grid layout for settings pages with 240px sidebar column
- Removed legacy SettingsViewToggle component from all settings pages
- Established danger zone visual pattern with separator and destructive styling

## Task Commits

Each task was committed atomically:

1. **Task 1: Create sidebar and pill navigation components** - `fbb46d5` (feat)
2. **Task 2: Update settings layout to CSS Grid and remove SettingsViewToggle** - `eb7d1b1` (feat)

## Files Created/Modified
- `apps/frontend/components/settings-sidebar.tsx` - Desktop vertical sidebar with sticky positioning, danger zone separator
- `apps/frontend/components/settings-pill-nav.tsx` - Mobile horizontal scrolling pill navigation
- `apps/frontend/app/(main)/installningar/layout.tsx` - CSS Grid layout with sidebar + content areas, max-w-6xl
- `apps/frontend/app/(main)/installningar/page.tsx` - Removed SettingsViewToggle, added h2 section heading
- `apps/frontend/app/(main)/installningar/sakerhet/page.tsx` - Removed SettingsViewToggle, added h2 section heading
- `apps/frontend/app/(main)/installningar/api-nycklar/page.tsx` - Removed SettingsViewToggle, added h2 section heading

## Decisions Made
- **Sidebar width:** Used 240px fixed width via grid-cols-[240px_1fr] for consistent sidebar sizing that accommodates Swedish text labels
- **Sticky positioning:** Set sidebar to sticky top-20 so it remains visible during content scroll
- **Danger zone pattern:** Separator component + uppercase "Farlig zon" label + destructive color classes for visual hierarchy
- **Mobile pills:** Used bg-warm for active regular pills (matches project warm color theme) vs bg-destructive for active Konto pill
- **Accessibility:** Applied aria-current="page" to active links in both sidebar and pill nav for screen reader support

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Settings sidebar layout infrastructure complete. Ready for:
- Plan 02-02: Create Konto danger zone page with household deletion
- Plan 02-03: Remove old Hemmet tab from settings
- Plan 02-04: Final verification and cleanup

**Components established:**
- SettingsSidebar can be reused or extended for other sidebar nav patterns
- SettingsPillNav pattern can be applied to other mobile navigation scenarios
- Danger zone styling pattern available for other destructive actions

**No blockers or concerns.**

---
*Phase: 02-settings-sidebar-layout*
*Completed: 2026-01-27*
