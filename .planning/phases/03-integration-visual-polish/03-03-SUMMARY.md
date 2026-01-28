---
phase: 03-integration-visual-polish
plan: 03
subsystem: ui
tags: [scroll-indicators, mobile-navigation, tailwind-mask, ResizeObserver]

# Dependency graph
requires:
  - phase: 03-01
    provides: hemmet-pill-nav component
  - phase: 03-02
    provides: settings-pill-nav component
provides:
  - Smart scroll fade indicators on mobile pill navigation (both settings and Hemmet)
  - JavaScript-based overflow detection with ResizeObserver
  - Conditional mask-x utilities for subtle fade edges
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: [ResizeObserver for overflow detection, conditional Tailwind mask utilities]

key-files:
  created: []
  modified:
    - apps/frontend/components/settings-pill-nav.tsx
    - apps/frontend/components/hemmet-pill-nav.tsx

key-decisions:
  - "Used JS overflow detection (ResizeObserver) instead of CSS-only approach for reliable detection"
  - "Applied mask-x-from-5% mask-x-to-95% for subtle fade edges"
  - "Both pill navs use identical fade pattern for consistency"

patterns-established:
  - "Scroll fade pattern: ResizeObserver detects overflow + conditional Tailwind mask-x utilities"
  - "Mobile navigation enhancement: visual indicators only when content actually overflows"

# Metrics
duration: 2min
completed: 2026-01-28
---

# Phase 03 Plan 03: Scroll Fade Indicators & Phase 3 Verification Summary

**Smart scroll fade indicators on mobile pill navigation using ResizeObserver overflow detection and Tailwind v4.1 mask-x utilities, completing Phase 3 integration.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-01-28T07:03:04Z
- **Completed:** 2026-01-28T07:05:17Z
- **Tasks:** 2 (1 auto, 1 checkpoint)
- **Files modified:** 2

## Accomplishments

- Added smart scroll fade indicators to both settings and Hemmet pill navigation
- Fade edges only appear when content actually overflows (not visible when pills fit)
- All tests pass with no regressions
- Complete Phase 3 integration verified by user across 14 verification criteria

## Task Commits

Each task was committed atomically:

1. **Task 1: Add scroll fade indicators to both pill navs and run tests** - `b844d3d` (feat)
2. **Task 2: Human verification checkpoint** - User approved

**Plan metadata:** (this commit) (docs: complete plan)

## Files Created/Modified

- `apps/frontend/components/settings-pill-nav.tsx` - Added ResizeObserver overflow detection and conditional mask-x fade
- `apps/frontend/components/hemmet-pill-nav.tsx` - Added ResizeObserver overflow detection and conditional mask-x fade

## Decisions Made

### 1. JavaScript overflow detection over CSS-only approach
**Context:** Need to conditionally show fade indicators only when content overflows

**Decision:** Use ResizeObserver to detect when `scrollWidth > clientWidth` and conditionally apply mask classes

**Rationale:**
- CSS-only solutions (like checking `::-webkit-scrollbar`) are unreliable across browsers
- ResizeObserver provides accurate, real-time overflow detection
- Enables precise control: fade only appears when user can actually scroll

**Alternatives considered:**
- Pure CSS with gradient masks always visible → Rejected (shows fade even when no overflow)
- Media queries to guess breakpoints → Rejected (unreliable, content-dependent)

### 2. Tailwind mask-x utilities for fade implementation
**Context:** Need subtle fade edges on horizontal scroll containers

**Decision:** Apply `mask-x-from-5% mask-x-to-95%` when overflow detected

**Rationale:**
- Tailwind v4.1 includes mask utilities for linear-gradient masking
- 5%/95% thresholds create subtle fade without obscuring content
- Native CSS mask-image performs well, no JS animation needed

**Technical implementation:**
```tsx
const [hasOverflow, setHasOverflow] = useState(false)

useEffect(() => {
  const el = scrollRef.current
  if (!el) return

  const checkOverflow = () => {
    setHasOverflow(el.scrollWidth > el.clientWidth)
  }

  checkOverflow()
  const observer = new ResizeObserver(checkOverflow)
  observer.observe(el)
  return () => observer.disconnect()
}, [])

<div
  ref={scrollRef}
  className={cn(
    'overflow-x-auto',
    hasOverflow && 'mask-x-from-5% mask-x-to-95%'
  )}
>
```

### 3. Identical pattern for both pill navs
**Context:** Settings and Hemmet each have their own pill navigation component

**Decision:** Apply exact same overflow detection and fade pattern to both

**Rationale:**
- Consistent UX across both navigation contexts
- Easier maintenance (single pattern to update if needed)
- Users expect identical behavior for similar UI elements

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - implementation straightforward, all tests passed on first run.

## User Setup Required

None - no external service configuration required.

## Phase 3 Verification Results

User verified all 14 integration criteria:

✓ Header dropdown shows both "Mitt hem" and "Installningar" links
✓ Settings sidebar renders on desktop with 4 sections
✓ No redundant h2 headings on settings pages
✓ Card styling is consistent across all settings sections
✓ Profile editing, password change, API key management all functional
✓ Hemmet sidebar renders with 3 sections and green accent color
✓ All Hemmet sections render correctly
✓ Leave household appears as small button (not danger card)
✓ Mobile pill navigation appears on both pages
✓ Scroll fade indicators appear when pills overflow
✓ Full navigation loop works without stale UI
✓ Active states remain correct during cross-page navigation

**Result:** Phase 3 complete - all integration and visual polish requirements met.

## Next Phase Readiness

**Phase 3 complete.** All requirements from REQ-01 through REQ-08 have been delivered:

- REQ-01: Hemmet extracted to standalone page ✓
- REQ-02: Settings sidebar layout ✓
- REQ-03: Hemmet sidebar layout ✓
- REQ-04: Responsive mobile pill navigation ✓
- REQ-05: Cross-page navigation ✓
- REQ-06: No redundant headings ✓
- REQ-07: Consistent Card components ✓
- REQ-08: Clean modern design with scroll indicators ✓

**No blockers or concerns.**

**Next work:** Project roadmap complete. Future enhancements could include:
- Loading states for data fetching
- Analytics to track feature usage
- Additional polish based on user feedback

---
*Phase: 03-integration-visual-polish*
*Completed: 2026-01-28*
