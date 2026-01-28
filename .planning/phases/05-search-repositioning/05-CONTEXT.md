# Phase 5: Search Repositioning - Context

**Gathered:** 2026-01-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Move the search bar from the header row into a dedicated full-width row below the header. On desktop, both header and search rows are sticky. On mobile, header is sticky but search row scrolls away (with a slight threshold before scrolling out). No new search functionality — this is a repositioning and scroll behavior change.

</domain>

<decisions>
## Implementation Decisions

### Search row layout
- Search row constrained to the same max-width as the header content (not full viewport)
- Search bar only — no filter chips or additional elements in the row
- Subtle border between header row and search row for visual separation
- Same vertical padding as header row — both rows feel like equal parts of the header block

### Sticky scroll behavior
- Desktop: both header row and search row are sticky (pinned on scroll)
- Mobile: header row is sticky, search row scrolls away with a slight threshold delay before disappearing
- Drop shadow appears below the search row (bottom of the combined sticky block) when scrolled
- Shadow fades in smoothly (opacity transition) as user scrolls — not a binary toggle

### Search bar styling
- Search bar has a max-width and is centered within the row (not stretched full width)
- Slightly larger than current size — taller input with larger text to take advantage of the dedicated space
- Search icon positioned inside the input on the left side
- Border on focus only — minimal/borderless at rest, visible border appears when focused

### Recent searches and empty states
- When search bar is focused but empty, show recent searches in a floating dropdown panel below the input
- Individual recent searches can be cleared with an X button, plus a "Clear all" link
- No-results state uses helpful suggestion tone: "No recipes found for 'X'. Try a different term or browse categories."

### Claude's Discretion
- Exact max-width value for the search bar
- Shadow intensity and color
- Scroll threshold distance on mobile before search row scrolls away
- Transition timing for shadow fade-in
- Exact sizing increase for the search bar (height, font-size)
- Recent searches dropdown styling and positioning details
- How many recent searches to show
- Where/how recent searches are stored (localStorage, etc.)

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-search-repositioning*
*Context gathered: 2026-01-28*
