# Requirements: Navigation & Header Restructure

**Defined:** 2026-01-28
**Core Value:** Key features should be immediately visible in the header — not buried in a dropdown menu.

## v1.1 Requirements

### Desktop Navigation

- [ ] **NAV-01**: Nav items (Mitt skafferi, Inköpslista, Mitt hem, AI-krediter, Admin) appear as top-level items in the header row on desktop
- [ ] **NAV-02**: AI-krediter displays as Sparkles icon only; other nav items display as text labels
- [ ] **NAV-03**: Admin nav item only visible to admin users
- [ ] **NAV-04**: Active page's nav item has an underline indicator

### User Dropdown

- [ ] **DROP-01**: User dropdown contains only Inställningar and Logga ut (all other items removed)

### Search Bar

- [ ] **SRCH-01**: Search bar appears in a full-width dedicated row below the header (not in the header row)
- [ ] **SRCH-02**: Header row and search row are both sticky on desktop
- [ ] **SRCH-03**: Search row is not sticky on mobile

### Auth States

- [ ] **AUTH-01**: Logged-out state shows Logo + search bar + login button (no nav items visible)

### Mobile

- [ ] **MOBI-01**: Mobile keeps slide-out drawer menu with all nav items

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
| NAV-01 | — | Pending |
| NAV-02 | — | Pending |
| NAV-03 | — | Pending |
| NAV-04 | — | Pending |
| DROP-01 | — | Pending |
| SRCH-01 | — | Pending |
| SRCH-02 | — | Pending |
| SRCH-03 | — | Pending |
| AUTH-01 | — | Pending |
| MOBI-01 | — | Pending |

**Coverage:**
- v1.1 requirements: 10 total
- Mapped to phases: 0
- Unmapped: 10 ⚠️

---
*Requirements defined: 2026-01-28*
*Last updated: 2026-01-28 after initial definition*
