# Matrummet — Settings & Home Page Redesign

## What This Is

Redesign the Inställningar (Settings) page from a tab-based layout to a side menu layout, and extract the Hemmet (Home) section into a standalone page. This is a UI/UX improvement milestone for an existing Swedish recipe management app.

## Core Value

Settings should be clean, navigable, and modern — and the Home feature deserves its own page rather than being buried in a settings tab.

## Requirements

### Validated

- ✓ Profile editing (name) — existing
- ✓ Password change with validation requirements — existing
- ✓ Account deletion with confirmation — existing
- ✓ API key creation, viewing, and revocation — existing
- ✓ Home creation and naming — existing
- ✓ Member management (list, remove) — existing
- ✓ Invite system (join codes, email invites) — existing
- ✓ Authentication-gated settings access — existing

### Active

- [ ] REQ-01: Settings page uses side menu layout (sidebar on desktop, stacked links on mobile)
- [ ] REQ-02: Settings has 3 sections: Profil, Säkerhet, API-nycklar
- [ ] REQ-03: Delete account is its own "danger zone" section at bottom of settings, separate from password change
- [ ] REQ-04: Hemmet is extracted to a standalone page at its own route
- [ ] REQ-05: Hemmet page linked from user dropdown menu (not top-level nav)
- [ ] REQ-06: Hemmet page redesigned with clearer section separation (not everything crammed together)
- [ ] REQ-07: Hemmet invite flow simplified (join codes + email invites less confusing)
- [ ] REQ-08: Clean, modern visual design for both pages

### Out of Scope

- New settings sections (theme, language, email preferences) — not adding content, just restructuring
- Top-level navigation changes beyond adding Hemmet to user menu — keep existing nav structure
- Backend/API changes — this is purely frontend restructuring
- Mobile app or responsive breakpoint overhaul — just handle the side menu responsive behavior

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| REQ-01 | Phase 2 | Pending |
| REQ-02 | Phase 2 | Pending |
| REQ-03 | Phase 2 | Pending |
| REQ-04 | Phase 1 | Pending |
| REQ-05 | Phase 1 | Pending |
| REQ-06 | Phase 1 | Pending |
| REQ-07 | Phase 1 | Pending |
| REQ-08 | Phase 3 | Pending |

## Context

Matrummet is a mature Swedish recipe management app built with Next.js 16, React 19, Tailwind v4, and Radix UI. The settings page currently uses horizontal tabs with 4 sections (Profil, Säkerhet, API-nycklar, Hemmet) implemented as separate routes under `/installningar/`. The Hemmet section is the heaviest — it contains home setup wizard, member management, invite codes, and email invites — making it feel out of place as a settings tab.

The app uses a consistent component library with Radix UI primitives and Tailwind for styling. The header has a user dropdown menu where the Hemmet link will be added.

## Constraints

- **Stack**: Must use existing tech (Next.js App Router, Tailwind v4, Radix UI) — no new dependencies for layout
- **Routes**: Settings stays at `/installningar/`, Hemmet moves to a new route
- **Auth**: Both pages require authentication (existing pattern via layout.tsx)
- **Content**: All existing functionality must be preserved — no features removed

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Side menu instead of tabs for settings | 3 sections don't warrant horizontal tabs; sidebar is more scalable and modern | — Pending |
| Extract Hemmet to standalone page | Home management is a feature, not a setting; it was too heavy for a tab | — Pending |
| Hemmet in user dropdown, not top nav | Important but not used daily; user menu keeps it accessible without cluttering main nav | — Pending |
| Delete account as separate danger zone | Separating destructive actions from routine security settings improves clarity | — Pending |
| Mobile settings: stacked links at top | Natural responsive pattern for sidebar navigation on small screens | — Pending |
| No new settings content | Focus on restructuring, not feature additions | — Pending |
| Phase 1 before Phase 2 | Phase 2 deletes old hemmet route; Phase 1 must extract it first. Independent ship point. | — Pending |
| REQ-08 in Phase 3 | Visual polish cross-cuts both pages; can only be fully verified after both structural changes land | — Pending |

---
*Last updated: 2026-01-27 after roadmap creation*
