# Phase 1: Footer Infrastructure - Context

**Gathered:** 2026-01-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Professional multi-column footer visible on all pages including auth (login, register). Replaces the current minimal copyright-only footer. The footer links to legal/content pages built in Phase 2.

</domain>

<decisions>
## Implementation Decisions

### Column structure & grouping
- 2-column layout: left column for links, right column for app info
- Both columns have visible bold headings
- Copyright line sits inside the right (info) column, at the bottom

### Visual style & branding
- Subtle/muted background — gentle separation from page content, not dark
- Comfortable vertical spacing — balanced presence, not cramped or oversized
- No top border/divider — background color change alone provides separation
- Personal & warm feel — reflects the family recipe app character
- App name/logo displayed in the info column
- No tagline — just name/logo and copyright
- Simple underline on link hover
- Background color tone: Claude's discretion (pick what fits existing palette)

### Link content & labels
- Links column contains only the Phase 2 legal pages: Om, Integritetspolicy, Villkor
- Links column heading: "Information"
- Links point to routes (/om, /integritetspolicy, /villkor) even before Phase 2 builds those pages
- Copyright text: "© {year} Matrummet"

### Mobile layout
- Columns stack vertically on mobile
- Info column first (brand-first), then links below
- Left-aligned content on mobile
- Tighter padding on mobile compared to desktop

### Claude's Discretion
- Muted background color tone (warm vs cool — fit to existing palette)
- Exact font sizes and spacing values
- Info column heading text
- Breakpoint for column stacking

</decisions>

<specifics>
## Specific Ideas

- The copyright entity is "Matrummet" not "Recept" — use in all copyright references
- Footer must work in both (main) and (auth) layouts without duplication
- All text in Swedish

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-footer-infrastructure*
*Context gathered: 2026-01-28*
