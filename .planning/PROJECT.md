# Recept Footer & Legal Pages

## What This Is

Improving the footer of the Recept recipe app to feel more professional, with a multi-column responsive layout linking to About, Privacy Policy, and Terms of Service pages — each with real Swedish content. The footer appears on all pages including auth (login/register).

## Core Value

The app feels trustworthy and complete with proper legal pages and a polished footer that's visible everywhere.

## Requirements

### Validated

- ✓ Basic footer with copyright text — existing
- ✓ Footer rendered in main layout — existing
- ✓ Multi-column footer layout with link groups — v1.0
- ✓ Footer visible on all pages (main + auth layouts) — v1.0
- ✓ About page (/om) with real Swedish content — v1.0
- ✓ Privacy Policy page (/integritetspolicy) with real Swedish content — v1.0
- ✓ Terms of Service page (/villkor) with real Swedish content — v1.0
- ✓ Copyright line preserved in new footer design — v1.0

### Active

(None — v1.0 scope complete. Next requirements defined in v1.1 milestone.)

### Out of Scope

- Contact page — not requested
- Cookie consent banner — no third-party tracking, only functional cookies
- English translations — app is Swedish-only
- Footer on admin pages beyond what main layout provides

## Context

Shipped v1.0 with 1,618 lines added across 16 files (TypeScript/TSX).
Tech stack: Next.js 16, React 19, Tailwind v4, Radix UI, @tailwindcss/typography.
Footer uses shared Server Component between (main) and (auth) route groups.
Content pages use prose layout with max-w-prose (~65ch) for reading-optimized typography.

## Constraints

- **Tech stack**: Next.js App Router, React 19, Tailwind v4 — must use existing patterns
- **Language**: All user-facing content in Swedish
- **Layout**: Footer works in both `(main)` and `(auth)` layouts via shared component import
- **Legal accuracy**: Privacy and terms content accurately reflects actual data practices

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Multi-column footer | More professional feel, room for link groups | ✓ Good |
| Footer on all pages including auth | Legal links should be accessible before login | ✓ Good |
| Real content (not placeholder) | App should feel complete and trustworthy | ✓ Good |
| Swedish routes (/om, /integritetspolicy, /villkor) | Consistent with existing Swedish route convention | ✓ Good |
| Matrummet as copyright entity | Brand name, not app name (Recept) | ✓ Good |
| bg-muted/30 without border-t | Background-only separation | ✓ Good |
| Auth layout flex-1 for sticky footer | Works with root layout flexbox | ✓ Good |
| Straightforward, minimal content tone | No personal backstory, just facts | ✓ Good |
| Plain Swedish language | Avoid legal jargon, make accessible | ✓ Good |
| "Vad vi INTE gor" privacy section | Explicitly state no tracking to build trust | ✓ Good |
| Typography plugin via @plugin directive | Tailwind v4 requires this syntax | ✓ Good |

---
*Last updated: 2026-01-28 after v1.0 milestone*
