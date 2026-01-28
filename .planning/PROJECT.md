# Matrummet — Navigation & Header Restructure

## What This Is

Restructure Matrummet's main header navigation from a single user dropdown containing all links to a proper top-level nav bar with dedicated items. Move the search bar from the header row to a full-width row below. This is a UI/UX improvement milestone for an existing Swedish recipe management app.

## Core Value

Key features (pantry, shopping list, home, credits, admin) should be immediately visible in the header — not buried in a dropdown menu.

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
- ✓ Settings page uses sidebar layout (desktop) and pill nav (mobile) — v1.0
- ✓ Settings has sections: Profil, Säkerhet, API-nycklar, Konto — v1.0
- ✓ Delete account is its own danger zone section — v1.0
- ✓ Hemmet extracted to standalone page at /hemmet/ — v1.0
- ✓ Hemmet page redesigned with sidebar + sub-pages — v1.0
- ✓ Hemmet invite flow simplified — v1.0
- ✓ Clean, modern visual design for settings and Hemmet — v1.0

### Active

- [ ] REQ-01: Nav items (Mitt skafferi, Inköpslista, Mitt hem, AI-krediter, Admin) appear as top-level items in the header row on desktop
- [ ] REQ-02: AI-krediter displays as icon only (Sparkles), other nav items as text labels
- [ ] REQ-03: Admin nav item only visible to admin users
- [ ] REQ-04: User dropdown slimmed to only Inställningar and Logga ut
- [ ] REQ-05: Search bar moves to a full-width dedicated row below the header
- [ ] REQ-06: Both header row and search row are sticky on desktop
- [ ] REQ-07: Search row is not sticky on mobile
- [ ] REQ-08: Active page's nav item has an underline indicator
- [ ] REQ-09: Logged-out state shows Logo + search bar + login button (no nav items)
- [ ] REQ-10: Mobile keeps slide-out drawer menu with all nav items

### Out of Scope

- Backend/API changes — this is purely frontend restructuring
- New nav items or pages — only restructuring where existing items appear
- Bottom tab bar for mobile — keeping the existing drawer approach
- Search functionality changes — only moving the bar's position, not changing behavior
- Settings or Hemmet page changes — those were handled in v1.0

## Context

Matrummet is a mature Swedish recipe management app built with Next.js 16, React 19, Tailwind v4, and Radix UI. The header currently has: Logo (left), search bar w-96 (center, desktop), and a user dropdown (right) that holds 7 items (Mitt skafferi, Inköpslista, Mitt hem, AI-krediter, Inställningar, Admin, Logga ut). On mobile, a slide-out Sheet drawer contains all nav items.

The previous milestone (v1.0) restructured settings into a sidebar layout and extracted Hemmet to its own page. The Hemmet link was added to the user dropdown. Now the dropdown is too crowded and key features are hidden behind a click.

## Constraints

- **Stack**: Must use existing tech (Next.js App Router, Tailwind v4, Radix UI) — no new dependencies
- **Header**: Single row for logo + nav items + user icon on desktop; two-row layout with search below
- **Auth**: Nav items only visible when logged in; admin item gated by admin role
- **Content**: All existing navigation destinations preserved — no links removed, just repositioned
- **Mobile**: Keep existing Sheet drawer pattern for mobile navigation

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Move 5 items out of user dropdown to top-level nav | Key features should be immediately visible, not buried in a menu | — Pending |
| Search bar to dedicated full-width row | Header row needs space for nav items; search benefits from more width | — Pending |
| Icons for AI-krediter and user profile, text for rest | Saves horizontal space; Sparkles icon is recognizable for credits | — Pending |
| Sticky header + sticky search on desktop only | Desktop has vertical space for two sticky rows; mobile doesn't | — Pending |
| Keep mobile drawer unchanged | Drawer already handles all nav items well; bottom tabs not needed | — Pending |
| Underline for active nav state | Clear, conventional indicator that doesn't add visual weight | — Pending |
| Logged out: no nav items | Nav items are all auth-gated features; showing them logged-out would be confusing | — Pending |

---
*Last updated: 2026-01-28 after milestone v1.1 initialization*
