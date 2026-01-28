# Phase 3: Integration & Visual Polish - Context

**Gathered:** 2026-01-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Cross-page verification, visual consistency, and clean modern design for both the settings pages and the standalone Hemmet page. Both pages should feel cohesive and work correctly across all navigation flows and viewports. Hemmet gets restructured into a sidebar + sub-pages layout matching settings. All existing functionality must be preserved.

</domain>

<decisions>
## Implementation Decisions

### Hemmet sidebar layout
- Hemmet adopts the same CSS Grid sidebar pattern as settings (sidebar + content area)
- Hemmet gets separate sub-pages (routes), not anchor-scroll sections
- Three sidebar items: Hushall, Medlemmar, Bjud in
- Hushall page includes a small icon to leave the household (replaces the old "Farozon" section)
- Default landing page for /hemmet/ is Hushall (household info)
- When user has no household: no sidebar shown, full-width create/join flow instead
- Sidebar appears after household is created/joined

### Sidebar styling
- Same structure as settings sidebar but with a different accent color
- Claude picks a complementary accent that feels distinct from settings' warm tones

### Visual consistency
- Unified visual rhythm across both pages: same heading sizes, card padding, gaps, card styles
- Remove redundant page-level h2 headings — sidebar active state + card heading is sufficient context
- Settings danger zone (Konto with "Farlig zon" separator) stays as-is

### Navigation flow
- Header dropdown links to /hemmet/ default (single link, not expanded sub-pages)
- Header dropdown shows active state for current top-level section (Installningar vs Hemmet)
- No cross-links between settings and Hemmet sidebars — header handles section switching

### Mobile pill navigation
- Hemmet uses the same horizontal scrolling pill pattern as settings on mobile
- Scroll fade/shadow indicators on both edges when content is scrollable — only visible when there's overflow in that direction
- Applied to both settings and Hemmet pill bars
- No page title above pills — pills alone provide context
- Pills scroll with page content (not sticky)

### Error and feedback states
- Form errors shown inline under the specific field (not toast)
- Success feedback via button state change (brief checkmark, then returns to normal)
- Loading states use skeleton placeholders matching the layout shape

### Empty/edge states
- Solo member in household: just show yourself in the member list, no special messaging or invite nudge

### Mobile polish
- 44px minimum touch target size for all interactive elements
- Reduced card padding on mobile for more content space

### Claude's Discretion
- Hemmet accent color choice (complementary to warm palette)
- Exact skeleton placeholder designs
- Specific heading sizes and spacing values for unified rhythm
- Scroll fade implementation approach (CSS gradient, mask, etc.)
- Button checkmark animation timing

</decisions>

<specifics>
## Specific Ideas

- "Hemmet should be made into a sidebar view as well, and use the same proportions as settings"
- "Add some kind of shadow/fade interaction on the sides that indicates that you can scroll. Only show it when you can actually scroll."
- "Currently on the setting page we have the h2 showing 'Profile' and within the card we have another h2 showing 'Profile', this is semantically wrong and leads to repetitiveness. Clean it up."

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-integration-visual-polish*
*Context gathered: 2026-01-28*
