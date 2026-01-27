# Roadmap: Settings & Home Page Redesign

## Overview

This milestone restructures Matrummet's settings page from horizontal tabs to a vertical sidebar layout, and extracts the Home (Hemmet) management feature to its own standalone page. The work moves through three phases: first extract Hemmet to an independent route with improved UX, then rebuild settings with the new sidebar navigation, then verify the whole thing works together with visual polish. All changes are frontend-only with zero new dependencies.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Extract Hemmet to Standalone Page** - Move Home management out of settings into its own route with improved layout
- [ ] **Phase 2: Settings Sidebar Layout** - Replace horizontal tabs with vertical sidebar navigation and add danger zone section
- [ ] **Phase 3: Integration & Visual Polish** - Cross-page verification, visual consistency, and clean modern design for both pages

## Phase Details

### Phase 1: Extract Hemmet to Standalone Page
**Goal**: Users can access and manage their household from a dedicated page independent of settings
**Depends on**: Nothing (first phase)
**Requirements**: REQ-04, REQ-05, REQ-06, REQ-07
**Success Criteria** (what must be TRUE):
  1. User navigates to `/hemmet/` and sees a standalone Home management page (not inside settings)
  2. User finds "Mitt hem" link in both the desktop header dropdown and mobile menu
  3. Home page displays household info, members, and invite flow in clearly separated sections (not crammed together)
  4. User can invite a household member via join code or email without confusion about which method to use
  5. Visiting the old URL `/installningar/hemmet` redirects to `/hemmet/` (no broken bookmarks)
**Plans**: 3 plans

Plans:
- [ ] 01-01-PLAN.md — Create standalone /hemmet/ route and move HomeSettingsClient to shared components
- [ ] 01-02-PLAN.md — Add navigation links and 308 redirect from old URL
- [ ] 01-03-PLAN.md — Redesign home page layout with separate Card sections and simplified invite flow

### Phase 2: Settings Sidebar Layout
**Goal**: Users navigate settings through a clean sidebar on desktop and stacked links on mobile, with a separated danger zone for account deletion
**Depends on**: Phase 1 (Phase 1 removes Hemmet from settings; Phase 2 deletes the old route and rebuilds navigation)
**Requirements**: REQ-01, REQ-02, REQ-03
**Success Criteria** (what must be TRUE):
  1. Settings page shows a vertical sidebar on desktop (240px) with links for Profil, Sakerhet, API-nycklar, and Konto (danger zone)
  2. On mobile, settings navigation appears as stacked links at the top of the page (not a sidebar)
  3. Active settings section is visually highlighted in the sidebar and announced to screen readers (`aria-current="page"`)
  4. Account deletion appears in its own "Konto" section below a visual separator labeled "Farlig zon", completely separate from password change in Sakerhet
  5. The old `SettingsViewToggle` horizontal tabs component is removed; settings pages no longer render tab navigation
**Plans**: TBD

Plans:
- [ ] 02-01: TBD
- [ ] 02-02: TBD

### Phase 3: Integration & Visual Polish
**Goal**: Both pages feel cohesive, modern, and work correctly across all navigation flows and viewports
**Depends on**: Phase 2
**Requirements**: REQ-08
**Success Criteria** (what must be TRUE):
  1. User can navigate the full loop: header dropdown -> settings -> switch sections -> back to header -> Hemmet -> back, with correct active states and no stale UI
  2. Both settings and Hemmet pages use consistent spacing, typography, and visual style that reads as clean and modern
  3. All existing functionality preserved: profile editing, password change, API key management, home creation/joining/leaving, member management, and invites all work as before
  4. No regressions in existing test suites (unit, API integration)
**Plans**: TBD

Plans:
- [ ] 03-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3

| Phase | Plans Complete | Status | Completed |
|-------|---------------|--------|-----------|
| 1. Extract Hemmet | 0/3 | Planned | - |
| 2. Settings Sidebar | 0/TBD | Not started | - |
| 3. Integration & Polish | 0/TBD | Not started | - |
