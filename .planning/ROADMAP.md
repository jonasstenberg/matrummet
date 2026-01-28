# Roadmap: Matrummet

## Milestones

- ✅ **v1.0 Settings & Home Page Redesign** - Phases 1-3 (shipped 2026-01-28)
- 🚧 **v1.1 Navigation & Header Restructure** - Phases 4-6 (in progress)

## Phases

<details>
<summary>✅ v1.0 Settings & Home Page Redesign (Phases 1-3) - SHIPPED 2026-01-28</summary>

### Phase 1: Extract Hemmet to Standalone Page
**Goal**: Users can access and manage their household from a dedicated page independent of settings
**Plans**: 3 plans

Plans:
- [x] 01-01-PLAN.md — Create standalone /hemmet/ route and move HomeSettingsClient to shared components
- [x] 01-02-PLAN.md — Add navigation links and 308 redirect from old URL
- [x] 01-03-PLAN.md — Redesign home page layout with separate Card sections and simplified invite flow

### Phase 2: Settings Sidebar Layout
**Goal**: Users navigate settings through a clean sidebar on desktop and stacked links on mobile, with a separated danger zone for account deletion
**Plans**: 2 plans

Plans:
- [x] 02-01-PLAN.md — Create sidebar/pill navigation components and update settings layout to CSS Grid
- [x] 02-02-PLAN.md — Extract account deletion to Konto page, strip SecurityForm, delete deprecated files

### Phase 3: Integration & Visual Polish
**Goal**: Both pages feel cohesive, modern, and work correctly across all navigation flows and viewports
**Plans**: 3 plans

Plans:
- [x] 03-01-PLAN.md — Restructure Hemmet into sidebar + sub-pages layout matching settings
- [x] 03-02-PLAN.md — Remove redundant headings and standardize Card components across settings
- [x] 03-03-PLAN.md — Add scroll fade indicators to mobile pills, run tests, human verification

</details>

## 🚧 v1.1 Navigation & Header Restructure (In Progress)

**Milestone Goal:** Transform header from crowded dropdown to visible top-level navigation with dedicated search row

### Phase 4: Desktop Header Restructure
**Goal**: Key features appear as visible navigation items in the header, not buried in a dropdown
**Depends on**: Phase 3 (previous milestone)
**Requirements**: NAV-01, NAV-02, NAV-03, NAV-04, DROP-01
**Success Criteria** (what must be TRUE):
  1. Desktop header shows Logo, then nav items (Mitt skafferi, Inköpslista, Mitt hem, AI-krediter icon, Admin), then user icon/dropdown
  2. AI-krediter displays as Sparkles icon only; other nav items display as text labels
  3. Admin nav item only visible to admin users (hidden for regular users)
  4. Active page's nav item shows underline indicator
  5. User dropdown contains only Inställningar and Logga ut
**Plans**: 2 plans

Plans:
- [x] 04-01-PLAN.md — Create UI primitives (DropdownMenu, Tooltip), DesktopNav component, and UserAvatar component
- [x] 04-02-PLAN.md — Rewire header.tsx with new desktop nav layout and slim user dropdown

### Phase 5: Search Repositioning
**Goal**: Search bar has more space and prominence in a dedicated row below the header
**Depends on**: Phase 4
**Requirements**: SRCH-01, SRCH-02, SRCH-03
**Success Criteria** (what must be TRUE):
  1. Search bar appears in a full-width dedicated row below the header row (not in header row)
  2. On desktop, both header row and search row remain visible when scrolling (sticky)
  3. On mobile, header row is sticky but search row scrolls away normally
**Plans**: TBD

Plans:
- [ ] TBD

### Phase 6: Auth & Mobile States
**Goal**: Navigation works correctly in logged-out state and on mobile devices
**Depends on**: Phase 4, Phase 5
**Requirements**: AUTH-01, MOBI-01
**Success Criteria** (what must be TRUE):
  1. Logged-out users see Logo + search bar + login button (no nav items visible)
  2. Mobile users access all nav items through existing slide-out drawer menu
  3. Mobile drawer menu includes all nav items (Mitt skafferi, Inköpslista, Mitt hem, AI-krediter, Admin if admin)
**Plans**: TBD

Plans:
- [ ] TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Extract Hemmet | v1.0 | 3/3 | Complete | 2026-01-28 |
| 2. Settings Sidebar | v1.0 | 2/2 | Complete | 2026-01-28 |
| 3. Integration & Polish | v1.0 | 3/3 | Complete | 2026-01-28 |
| 4. Desktop Header Restructure | v1.1 | 2/2 | Complete | 2026-01-28 |
| 5. Search Repositioning | v1.1 | 0/? | Not started | - |
| 6. Auth & Mobile States | v1.1 | 0/? | Not started | - |
