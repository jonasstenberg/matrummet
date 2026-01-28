# Recept Footer & Legal Pages

## What This Is

Improving the footer of the Recept recipe app to feel more professional, with a multi-column layout linking to About, Privacy Policy, and Terms of Service pages — each with real Swedish content. The footer should appear on all pages including auth (login/register).

## Core Value

The app feels trustworthy and complete with proper legal pages and a polished footer that's visible everywhere.

## Requirements

### Validated

- ✓ Basic footer with copyright text — existing
- ✓ Footer rendered in main layout — existing

### Active

- [ ] Multi-column footer layout with link groups
- [ ] Footer visible on all pages (main + auth layouts)
- [ ] About page (/om) with real Swedish content — personal project tone, built for family, passion for cooking, humble note about being useful for others
- [ ] Privacy Policy page (/integritetspolicy) with real Swedish content — covers auth cookies, recipe data, Stripe payments, no analytics/tracking
- [ ] Terms of Service page (/villkor) with real Swedish content — usage terms for the app
- [ ] Copyright line preserved in new footer design

### Out of Scope

- Contact page — not requested
- Cookie consent banner — no third-party tracking, only functional cookies
- English translations — app is Swedish-only
- Footer on admin pages beyond what main layout provides

## Context

- Recept is a Swedish recipe management app (Next.js 16, React 19, Tailwind v4, Radix UI)
- Current footer is minimal: just `© {year} Recept` in a centered muted container
- Footer currently only renders in `(main)` layout, not `(auth)` layout
- App uses JWT auth with cookies for session persistence
- Stripe is integrated as payment service
- No analytics or third-party tracking
- Routes are in Swedish (e.g., /recept, /sok, /installningar)

## Constraints

- **Tech stack**: Next.js App Router, React 19, Tailwind v4 — must use existing patterns
- **Language**: All user-facing content in Swedish
- **Layout**: Footer must work in both `(main)` and `(auth)` layouts without duplication of the component
- **Legal accuracy**: Privacy and terms content should accurately reflect actual data practices (cookies, Stripe, no tracking)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Multi-column footer | More professional feel, room for link groups | — Pending |
| Footer on all pages including auth | Legal links should be accessible before login | — Pending |
| Real content (not placeholder) | App should feel complete and trustworthy | — Pending |
| Swedish routes (/om, /integritetspolicy, /villkor) | Consistent with existing Swedish route convention | — Pending |

---
*Last updated: 2026-01-28 after initialization*
