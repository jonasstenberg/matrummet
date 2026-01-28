---
phase: 05-search-repositioning
plan: 01
subsystem: ui
tags: [react, next.js, tailwind, sticky-positioning, scroll-behavior, search]

# Dependency graph
requires:
  - phase: 04-desktop-header-restructure
    provides: Restructured desktop header with top-level nav, slim user dropdown
provides:
  - SearchRow component with stacked sticky positioning
  - Header without embedded search bar (desktop and mobile)
  - Layout rendering SearchRow between Header and main
affects: [05-02, 06-auth-mobile-states]

# Tech tracking
tech-stack:
  added: []
  patterns: [Stacked sticky positioning pattern, scroll-direction detection for mobile hide/show]

key-files:
  created: [apps/frontend/components/search-row.tsx]
  modified: [apps/frontend/components/header.tsx, apps/frontend/app/(main)/layout.tsx]

key-decisions:
  - "Search row uses border-t for visual separation from header (not shadow)"
  - "Mobile scroll-away uses translate-y with 50px threshold for smooth UX"
  - "SearchBar max-width expanded to max-w-xl (~576px) from w-72 (288px)"
  - "Single scroll handler manages both shadow and hide state"

patterns-established:
  - "Stacked sticky elements with different z-index (header z-50, search z-40)"
  - "Mobile scroll-direction detection with useRef for previous scroll position"

# Metrics
duration: 3min
completed: 2026-01-28
---

# Phase 5 Plan 1: SearchRow Component & Header Rewire Summary

**Dedicated SearchRow component with stacked sticky positioning on desktop and scroll-away behavior on mobile, search bar removed from header entirely**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-28
- **Completed:** 2026-01-28
- **Tasks:** 2 (1 implementation + 1 checkpoint)
- **Files modified:** 3

## Accomplishments
- Created SearchRow component with stacked sticky positioning (md:sticky md:top-16 md:z-40)
- Removed search bar from header (both desktop and mobile sections)
- Updated layout to render SearchRow between Header and main content
- Desktop: both header and search row remain visible when scrolling
- Mobile: search row scrolls away after 50px of downward scrolling, reappears on scroll up
- Subtle shadow fades in below search row when page is scrolled
- SearchBar width expanded from 288px to ~576px (max-w-xl)
- Human verification approved (sticky behavior, shadow, mobile scroll-away, search functionality)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create SearchRow component and rewire header/layout** - `b52405d` (feat)
2. **Task 2: Human verification checkpoint** - (approved)

**Plan metadata:** (to be committed after this summary)

## Files Created/Modified
- `apps/frontend/components/search-row.tsx` - New SearchRow component with sticky desktop positioning, mobile scroll-away, scroll shadow, Suspense-wrapped SearchBar
- `apps/frontend/components/header.tsx` - Removed SearchBar import, Suspense import, desktop search section, mobile search section; kept all other header functionality
- `apps/frontend/app/(main)/layout.tsx` - Added SearchRow import, renders between Header and main

## Decisions Made
- **border-t for visual separation:** Subtle top border between header and search row rather than shadow or gap
- **Single scroll handler:** One useEffect manages both isScrolled (shadow) and isHidden (mobile scroll-away) state
- **max-w-xl for search bar:** ~576px gives significantly more width than previous w-72 (288px) while staying centered

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - implementation completed smoothly. Frontend build and lint pass.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Plan 05-01 Complete** - Search bar repositioned to dedicated row. Ready for Plan 05-02 (search bar enhancements).

**What's ready:**
- SearchRow component rendering SearchBar in dedicated full-width row
- Stacked sticky positioning working on desktop
- Mobile scroll-away behavior working
- Header cleaned of all search references

**Next plan needs:**
- Plan 05-02: Enhance search bar with larger styling, focus border, recent searches dropdown

**No blockers or concerns.**

---
*Phase: 05-search-repositioning*
*Completed: 2026-01-28*
