# Phase 2: Settings Sidebar Layout - Context

**Gathered:** 2026-01-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the horizontal tab navigation in settings with a vertical sidebar on desktop and pill tabs on mobile. Add a separated danger zone section for account deletion. Remove the old `SettingsViewToggle` component. Sections: Profil, Sakerhet, API-nycklar, Konto (danger zone).

</domain>

<decisions>
## Implementation Decisions

### Sidebar appearance
- Text-only links, no icons
- Active link uses subtle background highlight
- "Instellningar" heading above the sidebar links
- Links listed flat: Profil, Sakerhet, API-nycklar
- Horizontal divider line + "Farlig zon" section heading before Konto link
- Konto link uses red/warning text color
- Sidebar separated from content area by a right border
- Sidebar is sticky (stays visible when scrolling content)
- Sidebar width: 240px (per roadmap)

### Mobile navigation
- Horizontal scrolling pill-shaped tabs at top of page
- Pills scroll away with page content (not sticky)
- Konto pill uses red/warning styling to match sidebar danger zone treatment
- Layout switches from mobile pills to desktop sidebar at md breakpoint (768px)

### Page transitions
- Each section is its own URL route (e.g., /installningar/profil, /installningar/sakerhet, /installningar/api-nycklar, /installningar/konto)
- /installningar redirects to /installningar/profil
- Client-side navigation using Next.js Link — sidebar stays, only content area changes
- Each section shows its name as an h1 heading in the content area

### Danger zone (Konto page)
- Contains only account deletion — no other account info
- Standard layout with explanatory text, only the delete button is red/destructive
- Confirmation requires typing email address before delete button becomes active

### Claude's Discretion
- Exact spacing, padding, and typography choices
- Loading states during section transitions
- Exact pill tab styling and scrolling behavior
- Error state handling
- Transition animations (if any)

</decisions>

<specifics>
## Specific Ideas

No specific references — open to standard approaches. Sidebar with right border + sticky behavior is a common pattern (VS Code, Linear-style navigation).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-settings-sidebar-layout*
*Context gathered: 2026-01-27*
