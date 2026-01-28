---
phase: 03-integration-visual-polish
plan: 01
subsystem: frontend-hemmet-ui
tags: [layout, navigation, routing, React, Next.js]
requires: [02-02]
provides: [hemmet-sidebar-navigation, hemmet-sub-pages]
affects: []
tech-stack:
  added: []
  patterns: [CSS Grid sidebar layout, React cache() for data fetching, conditional layout based on data]
key-files:
  created:
    - apps/frontend/lib/home-api.ts
    - apps/frontend/components/hemmet-sidebar.tsx
    - apps/frontend/components/hemmet-pill-nav.tsx
    - apps/frontend/app/(main)/hemmet/hushall/page.tsx
    - apps/frontend/app/(main)/hemmet/medlemmar/page.tsx
    - apps/frontend/app/(main)/hemmet/bjud-in/page.tsx
    - apps/frontend/components/home/hushall-client.tsx
    - apps/frontend/components/home/medlemmar-client.tsx
    - apps/frontend/components/home/bjud-in-client.tsx
  modified:
    - apps/frontend/app/(main)/hemmet/layout.tsx
    - apps/frontend/app/(main)/hemmet/page.tsx
    - apps/frontend/components/home/home-leave-dialog.tsx
    - apps/frontend/components/home/home-settings.tsx (deprecated)
    - apps/frontend/components/home/home-settings-client.tsx (deprecated)
decisions:
  - Use React cache() for getHomeInfo to deduplicate fetches within single request
  - Use bg-secondary/10 green accent for Hemmet active nav (distinct from settings' warm/destructive)
  - Hide sidebar when user has no household (show full-width wizard instead)
  - Place leave household as inline button on hushall page instead of danger zone card
  - Deprecate old monolithic components but don't delete (for reference)
metrics:
  duration: 10min
  completed: 2026-01-28
---

# Phase 03 Plan 01: Hemmet Sidebar Layout Summary

**One-liner:** Restructured Hemmet from single-page to sidebar + sub-pages layout with CSS Grid, matching settings pattern exactly (240px sidebar, green accent navigation, responsive pills).

## What Was Built

### Task 1: Sidebar Layout and Navigation
Created the foundational sidebar infrastructure matching the settings pattern:

1. **Shared data fetching** (`home-api.ts`):
   - Uses React's `cache()` to deduplicate `getHomeInfo()` calls within a single request
   - Both layout and sub-pages call directly - no prop drilling
   - Returns both home data and userEmail in single fetch

2. **Navigation components**:
   - `HemmetSidebar`: Desktop vertical navigation with green accent (`bg-secondary/10 text-secondary`) for active links
   - `HemmetPillNav`: Mobile horizontal scrolling pills with same green accent
   - Three links: Hushåll, Medlemmar, Bjud in

3. **Layout updates** (`hemmet/layout.tsx`):
   - Fetches home data to determine layout
   - No home → full-width wizard (max-w-4xl, no sidebar)
   - Has home → CSS Grid layout (max-w-6xl, 240px sidebar + 1fr content)
   - Sidebar sticky at top-20, matches settings exactly
   - Page header with h1 "Mitt hem" and description

4. **Root page redirect** (`hemmet/page.tsx`):
   - Simple redirect to `/hemmet/hushall`
   - Layout handles all auth and data fetching

### Task 2: Decompose into Sub-Pages
Split the monolithic home-settings component into three focused pages:

1. **Hushall page** (`/hemmet/hushall`):
   - Shows HomeSetupWizard when no home (create/join flow)
   - Shows household name editor when has home
   - Inline leave household button (ghost variant, destructive color, LogOut icon)
   - No separate danger zone card

2. **Medlemmar page** (`/hemmet/medlemmar`):
   - Redirects to hushall if no home
   - Displays member list with count in title
   - Member removal functionality preserved

3. **Bjud in page** (`/hemmet/bjud-in`):
   - Redirects to hushall if no home
   - Join code management (generate, disable, copy)
   - Email invite form
   - All existing invitation functionality preserved

4. **Client components**:
   - `HushallClient`: Handles setup wizard vs household info logic, name editing, leave action
   - `MedlemmarClient`: Member list management with optimistic updates
   - `BjudInClient`: Invite code and email invitation management

5. **Component updates**:
   - `HomeLeaveDialog`: Added optional `children` prop for custom trigger button
   - `home-settings.tsx` and `home-settings-client.tsx`: Marked deprecated with comments

## Deviations from Plan

None - plan executed exactly as written. All functionality preserved, no bugs discovered, no missing critical features.

## Technical Decisions

### Data Fetching Pattern
Used React's `cache()` for server-side data deduplication instead of prop drilling:
- Layout and all sub-pages independently call `getHomeInfo()`
- React automatically deduplicates within single request lifecycle
- Cleaner than passing data through layout props or context

**Why:** Simpler mental model, no nested prop passing, standard Next.js server component pattern

### Active Link Styling
Chose `bg-secondary/10 text-secondary` (green) for Hemmet active navigation:
- Settings uses `bg-muted` (neutral) for regular items
- Settings uses `bg-destructive/10 text-destructive` for danger items
- Hemmet needed distinct visual identity

**Why:** Green secondary color complements warm palette, distinct from settings, feels appropriate for "home" concept

### Leave Household Placement
Moved leave action from separate danger zone card to inline button on hushall page:
- Small ghost button with destructive coloring and LogOut icon
- Appears in CardHeader next to title
- Still triggers confirmation dialog

**Why:** Less visual weight, cleaner layout, user specifically requested "small icon/button" instead of "separate danger zone card"

### Conditional Layout
Layout component decides between sidebar vs full-width based on home data:
- No home → max-w-4xl, no sidebar, wizard flow
- Has home → max-w-6xl, CSS Grid, sidebar navigation

**Why:** Better UX (no empty sidebar when wizard is shown), matches settings pattern where layout adapts to auth state

## Next Phase Readiness

**Blockers:** None

**Concerns:** None

**Recommendations:**
- Phase 03-02 (visual polish) can proceed immediately
- Consider adding loading states for data fetching if users report perceived slowness
- Could add analytics to track which Hemmet sub-page is most used

## Files Changed

**Created (9 files):**
- `apps/frontend/lib/home-api.ts` - Cached server-side home data fetching
- `apps/frontend/components/hemmet-sidebar.tsx` - Desktop sidebar navigation
- `apps/frontend/components/hemmet-pill-nav.tsx` - Mobile pill navigation
- `apps/frontend/app/(main)/hemmet/hushall/page.tsx` - Household info page
- `apps/frontend/app/(main)/hemmet/medlemmar/page.tsx` - Members list page
- `apps/frontend/app/(main)/hemmet/bjud-in/page.tsx` - Invite page
- `apps/frontend/components/home/hushall-client.tsx` - Household client wrapper
- `apps/frontend/components/home/medlemmar-client.tsx` - Members client wrapper
- `apps/frontend/components/home/bjud-in-client.tsx` - Invite client wrapper

**Modified (5 files):**
- `apps/frontend/app/(main)/hemmet/layout.tsx` - Added CSS Grid sidebar layout
- `apps/frontend/app/(main)/hemmet/page.tsx` - Redirects to /hemmet/hushall
- `apps/frontend/components/home/home-leave-dialog.tsx` - Added children prop for custom trigger
- `apps/frontend/components/home/home-settings.tsx` - Deprecated
- `apps/frontend/components/home/home-settings-client.tsx` - Deprecated

**Deleted:** None (old components deprecated but kept for reference)

## Commits

- `2cba42d` - feat(03-01): restructure Hemmet into sidebar layout with sub-pages
- `4dcba48` - feat(03-01): add new sidebar/client components and sub-pages
