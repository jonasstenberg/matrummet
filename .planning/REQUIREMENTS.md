# Requirements: Navigation & Header Restructure

**Defined:** 2026-01-28
**Core Value:** Key features should be immediately visible in the header — not buried in a dropdown menu.

## v1.1 Requirements

### Desktop Navigation

- [x] **NAV-01**: Nav items (Mitt skafferi, Inköpslista, Mitt hem, AI-krediter, Admin) appear as top-level items in the header row on desktop
- [x] **NAV-02**: AI-krediter displays as Sparkles icon only; other nav items display as text labels
- [x] **NAV-03**: Admin nav item only visible to admin users
- [x] **NAV-04**: Active page's nav item has an underline indicator

### User Dropdown

- [x] **DROP-01**: User dropdown contains only Inställningar and Logga ut (all other items removed)

### Search Bar

- [x] **SRCH-01**: Search bar appears in a full-width dedicated row below the header (not in the header row)
- [x] **SRCH-02**: ~~Header row and search row are both sticky on desktop~~ Updated: Only header row is sticky; search row scrolls normally (user feedback during Phase 6)
- [x] **SRCH-03**: Search row is not sticky on mobile

### Auth States

- [x] **AUTH-01**: Logged-out state shows Logo + search bar + login/signup buttons (no nav items visible)

### Mobile

- [x] **MOBI-01**: Mobile keeps slide-out drawer menu with all nav items

## Future Requirements

None — this is a focused restructuring milestone.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Backend/API changes | Purely frontend restructuring |
| New nav items or pages | Only repositioning existing items |
| Bottom tab bar for mobile | Keeping existing drawer approach |
| Search functionality changes | Only moving position, not changing behavior |
| Settings or Hemmet page changes | Handled in v1.0 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| NAV-01 | Phase 4 | Complete |
| NAV-02 | Phase 4 | Complete |
| NAV-03 | Phase 4 | Complete |
| NAV-04 | Phase 4 | Complete |
| DROP-01 | Phase 4 | Complete |
| SRCH-01 | Phase 5 | Complete |
| SRCH-02 | Phase 5 | Complete |
| SRCH-03 | Phase 5 | Complete |
| AUTH-01 | Phase 6 | Complete |
| MOBI-01 | Phase 6 | Complete |

**Coverage:**
- v1.1 requirements: 10 total
- Mapped to phases: 10
- Unmapped: 0 ✓

---
*Requirements defined: 2026-01-28*
*Last updated: 2026-01-28 after roadmap creation*
