# Phase 6: Auth & Mobile States - Context

**Gathered:** 2026-01-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Navigation works correctly in logged-out state and on mobile devices. Logged-out users see a minimal header with search and auth buttons. Mobile users access all nav items through the existing slide-out drawer menu. No new features — this phase ensures existing navigation adapts to all auth states and viewports.

</domain>

<decisions>
## Implementation Decisions

### Logged-out layout
- Header contains: Logo + search bar + login/signup buttons (far right, where avatar normally sits)
- Search row appears below header, same as logged-in (dedicated full-width row)
- Sticky behavior same as logged-in: header row sticky, search row sticky on desktop, scrolls away on mobile
- No nav items visible for logged-out users (all auth-gated)

### Login & signup buttons
- Two buttons: "Logga in" (outlined) and "Skapa konto" (filled/primary)
- Signup is the primary CTA (filled), login is secondary (outlined)
- Both navigate to their respective pages (no modals)
- Clicking login goes to /login, clicking signup goes to signup page

### Mobile drawer contents (logged-in)
- Nav items in same order as desktop header: Mitt skafferi, Inköpslista, Mitt hem, AI-krediter, Admin (if admin)
- Icons + text labels matching the header's icon/text combinations
- Separator, then Inställningar + Logga ut at the bottom
- Active page highlighted with visual indicator in the drawer

### Mobile drawer (logged-out)
- No hamburger menu / drawer at all for logged-out users
- Login and signup buttons are in the header (same as desktop, far right)

### Auth transition
- Instant swap when auth state changes (no fade animation)
- During initial auth check: show logo + skeleton placeholders on right side (no flash of logged-out state)
- After login: redirect back to previous page (not always home)
- Auth-gated pages (e.g., /installningar): redirect to /login with return URL, then back after successful login

### Claude's Discretion
- Skeleton placeholder design during auth loading
- Exact button sizing and spacing for login/signup pair
- Drawer icon selection for nav items (match desktop where applicable)
- Active state indicator style in mobile drawer (background, bold, etc.)

</decisions>

<specifics>
## Specific Ideas

- Drawer icons should match the same icon + text combos used in the desktop header
- Signup button is the primary CTA (filled), login is secondary (outlined) — prioritize new user acquisition

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-auth-mobile-states*
*Context gathered: 2026-01-28*
