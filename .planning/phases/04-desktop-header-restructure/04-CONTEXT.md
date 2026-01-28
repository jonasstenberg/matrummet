# Phase 4: Desktop Header Restructure - Context

**Gathered:** 2026-01-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Restructure the desktop header so key features (Mitt skafferi, Inköpslista, Mitt hem, AI-krediter, Admin) appear as visible top-level navigation items instead of being buried in a dropdown. The user dropdown is reduced to only Inställningar and Logga ut. Mobile drawer and search repositioning are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Nav item styling & spacing
- Default state: subtle, medium font weight, muted color — active item stands out by contrast
- Active indicator: thick accent bar (3-4px) in brand color at bottom of nav item
- Hover state: subtle background highlight (pill/chip effect)
- Spacing: compact — items feel grouped together as a cohesive navigation bar

### Header layout & alignment
- Nav items left-aligned after logo — Logo on far left, nav items flow after a gap, user icon on far right
- Keep current header height — nav items must fit within existing vertical space
- User dropdown opens on click (not hover)
- User represented by initials circle (e.g., "JS") — more personal than generic icon

### AI-krediter icon behavior
- Sparkles icon with superscript badge showing credit count (notification-style, top-right corner overlap)
- No special visual indicator for low/zero credits — badge always looks the same
- Tooltip on hover showing "AI-krediter" for discoverability

### Claude's Discretion
- Exact font sizes and weights for nav items
- Transition/animation for underline indicator
- Background highlight color and opacity for hover state
- Initials circle color scheme
- Badge size and exact positioning on Sparkles icon

</decisions>

<specifics>
## Specific Ideas

No specific references — open to standard approaches. Key constraint is fitting all nav items within the existing header height while maintaining compact spacing.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-desktop-header-restructure*
*Context gathered: 2026-01-28*
