# Phase 2: Content Pages - Context

**Gathered:** 2026-01-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Three Swedish content pages accessible from the footer: About (/om), Privacy Policy (/integritetspolicy), and Terms of Service (/villkor). Real content that makes the app feel trustworthy and complete. Footer links from Phase 1 already point to these routes.

</domain>

<decisions>
## Implementation Decisions

### Page tone & voice
- Straightforward and minimal — no fluff, let the product speak for itself
- About page is purely factual — no personal backstory, just what the app is and does
- Privacy and terms use plain Swedish — avoid legal jargon, explain things simply
- Entity name in legal text is "Matrummet" (consistent with footer copyright)

### Content depth & structure
- About page: a couple of short paragraphs (what it is, key features, who it's for)
- Privacy policy: sectioned with clear headings (what we collect, how we use it, cookies, etc.)
- Structure fits each page — About can be freeform, privacy/terms use sections
- All three pages include a "last updated" date

### Legal content accuracy
- Data stored: auth data (email, password hash), recipe data, Stripe customer ID (not card details), JWT session cookies
- No analytics or tracking whatsoever — no Google Analytics, no Plausible, no tracking pixels
- Users can self-service delete their account and all associated data
- Content ownership: users own their recipes, Matrummet gets a standard license to display content within the app

### Page layout & presentation
- Narrow prose column (~650px max-width), centered, optimized for reading
- Clear h1 heading on each page ("Om Recept", "Integritetspolicy", "Villkor")
- Pages live within the existing app layout (nav bar + footer)
- Text only — no icons, illustrations, or decorative elements

### Claude's Discretion
- Exact heading hierarchy within sections
- Paragraph length and line spacing
- Specific section ordering on privacy and terms pages
- How to phrase the "last updated" date

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches within the straightforward, minimal tone.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-content-pages*
*Context gathered: 2026-01-28*
