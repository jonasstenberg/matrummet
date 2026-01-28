# Roadmap: Recept Footer & Legal Pages

**Created:** 2026-01-28
**Depth:** Quick
**Total Phases:** 2

## Overview

Transform the basic footer into a professional multi-column layout and add three essential content pages (About, Privacy Policy, Terms of Service) to make the app feel trustworthy and complete.

## Phases

### Phase 1: Footer Infrastructure

**Goal:** Users see a professional multi-column footer on all pages including auth.

**Dependencies:** None (foundation phase)

**Requirements:**
- FOOT-01: Multi-column footer layout with grouped links
- FOOT-02: Copyright line with current year preserved in new design
- FOOT-03: Footer renders on all pages including auth (login, register)

**Success Criteria:**
1. User sees multi-column footer with link groups on any main app page
2. User sees the same footer on login and register pages
3. User sees copyright line with current year in footer
4. Footer layout is responsive and works on mobile and desktop

### Phase 2: Content Pages

**Goal:** Users can access About, Privacy Policy, and Terms pages with real Swedish content.

**Dependencies:** Phase 1 (footer must link to these pages)

**Requirements:**
- PAGE-01: About page at /om with real Swedish content
- PAGE-02: Privacy Policy page at /integritetspolicy with real Swedish content
- PAGE-03: Terms of Service page at /villkor with real Swedish content

**Success Criteria:**
1. User can navigate to /om and read about the project's personal origins and purpose
2. User can navigate to /integritetspolicy and understand what data is stored (auth cookies, recipes, Stripe payments) and what isn't (no analytics/tracking)
3. User can navigate to /villkor and understand usage terms for the app
4. All three pages are accessible from footer links
5. Content reads naturally in Swedish and matches the app's tone (personal, humble, family-focused)

## Progress

| Phase | Goal | Status | Requirements |
|-------|------|--------|--------------|
| 1 - Footer Infrastructure | Users see a professional multi-column footer on all pages | Pending | FOOT-01, FOOT-02, FOOT-03 |
| 2 - Content Pages | Users can access About, Privacy, Terms pages | Pending | PAGE-01, PAGE-02, PAGE-03 |

**Overall Progress:** 0/6 requirements complete (0%)

---
*Roadmap created: 2026-01-28*
*Last updated: 2026-01-28*
