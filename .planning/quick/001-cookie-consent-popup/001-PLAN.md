---
phase: quick
plan: 001
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/frontend/components/cookie-consent-banner.tsx
  - apps/frontend/lib/cookie-consent.ts
  - apps/frontend/app/layout.tsx
autonomous: true

must_haves:
  truths:
    - "First-time visitor sees a cookie consent banner at the bottom of the page"
    - "User can accept all cookies with a single click"
    - "User can choose which cookie categories to allow (functional vs payment)"
    - "After consenting, the banner does not appear again on subsequent visits"
    - "User can change cookie preferences later (link in footer)"
    - "Stripe checkout is only initiated when payment cookies are consented to"
  artifacts:
    - path: "apps/frontend/lib/cookie-consent.ts"
      provides: "Cookie consent state management (read/write/check)"
      exports: ["getConsent", "setConsent", "hasConsent", "CookieConsent", "CONSENT_KEY"]
    - path: "apps/frontend/components/cookie-consent-banner.tsx"
      provides: "GDPR-compliant cookie consent banner component"
      min_lines: 80
    - path: "apps/frontend/app/layout.tsx"
      provides: "Root layout with cookie consent banner mounted"
      contains: "CookieConsentBanner"
  key_links:
    - from: "apps/frontend/components/cookie-consent-banner.tsx"
      to: "apps/frontend/lib/cookie-consent.ts"
      via: "import consent helpers"
      pattern: "import.*cookie-consent"
    - from: "apps/frontend/app/layout.tsx"
      to: "apps/frontend/components/cookie-consent-banner.tsx"
      via: "renders banner in body"
      pattern: "CookieConsentBanner"
---

<objective>
Create a GDPR-compliant cookie consent banner for the Matrummet recipe app, covering functional cookies (login/session via `auth-token` httpOnly cookie) and payment cookies (Stripe checkout).

Purpose: Legal compliance with EU cookie regulations. The app sets cookies for authentication (functional, necessary for login) and uses Stripe for payments (third-party cookies). GDPR requires informed consent with granular control.

Output: A bottom-anchored cookie consent banner in Swedish that appears on first visit, allows granular consent, and persists the user's choice in localStorage.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@apps/frontend/app/layout.tsx
@apps/frontend/app/(main)/layout.tsx
@apps/frontend/components/ui/button.tsx
@apps/frontend/components/ui/card.tsx
@apps/frontend/components/ui/switch.tsx
@apps/frontend/components/footer.tsx
@apps/frontend/lib/auth.ts
@apps/frontend/lib/cookie-consent.ts
@apps/frontend/app/globals.css
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create cookie consent utilities and banner component</name>
  <files>
    apps/frontend/lib/cookie-consent.ts
    apps/frontend/components/cookie-consent-banner.tsx
  </files>
  <action>
**1. Create `apps/frontend/lib/cookie-consent.ts`** — consent state management utility.

Define a `CookieConsent` type:
```ts
export interface CookieConsent {
  necessary: true       // Always true, cannot be toggled off
  functional: boolean   // Login session cookies (auth-token)
  payment: boolean      // Stripe payment cookies
}
```

Constants:
- `CONSENT_KEY = "cookie-consent"` (localStorage key)
- `DEFAULT_CONSENT: CookieConsent = { necessary: true, functional: true, payment: false }` (functional on by default since login requires it, payment off by default)

Export these functions:
- `getConsent(): CookieConsent | null` — reads from localStorage, returns null if no consent stored (meaning banner should show). Parse JSON safely with try/catch.
- `setConsent(consent: CookieConsent): void` — writes to localStorage as JSON.
- `hasConsent(): boolean` — returns true if any consent has been stored (user has interacted with banner).
- `hasPaymentConsent(): boolean` — returns true only if consent exists AND `payment` is true.
- `resetConsent(): void` — removes the localStorage key (for "change preferences" flow).

**2. Create `apps/frontend/components/cookie-consent-banner.tsx`** — the banner component.

This is a `"use client"` component. It should:

- Use `useState` to track: `visible` (whether to show banner), `showDetails` (whether category toggles are expanded), and the current `consent` state.
- On mount (`useEffect` with `[]` deps), check `hasConsent()`. If false, show the banner. If true, hide it.
- Render a fixed bottom banner (`fixed bottom-0 left-0 right-0 z-50`) with:
  - Background: use `bg-card` with `border-t border-border shadow-lg` to match the app's card/warm aesthetic
  - Max width container centered (`container mx-auto max-w-4xl px-4 py-4`)
  - Content layout:
    - Heading: "Vi anvander cookies" (with a-ring: "Vi anvander cookies") — use text-base font-semibold
    - Description text (text-sm text-muted-foreground): "Den har webbplatsen anvander cookies for att sakerstalla att du far basta mojliga upplevelse. Nodvandiga cookies kravs for att webbplatsen ska fungera."
    - A "Visa detaljer" / "Dolj detaljer" toggle link (Button variant="link" size="sm") that expands the category section
    - When details are shown, display cookie categories using the existing Switch component:
      - "Nodvandiga cookies" — Switch always checked, disabled, with description "Kravs for att webbplatsen ska fungera korrekt"
      - "Funktionella cookies" — Switch togglable, default on, with description "Mojliggor inloggning och sessionshantering"
      - "Betalningscookies" — Switch togglable, default off, with description "Kravs for betalningar via Stripe"
    - Action buttons in a flex row (gap-2):
      - "Acceptera alla" — Button (default variant), calls acceptAll()
      - "Spara val" — Button (variant="outline"), saves current toggle states
      - "Avvisa alla" — Button (variant="ghost", text-sm), sets functional=true (can't disable login), payment=false

  - Important Swedish characters: Use proper Swedish with a-ring, a-umlaut, o-umlaut (a, a, o). The exact Swedish text:
    - Title: "Vi anvander cookies" -> "Vi använder cookies"
    - Description: "Den här webbplatsen använder cookies för att säkerställa att du får bästa möjliga upplevelse. Nödvändiga cookies krävs för att webbplatsen ska fungera."
    - Necessary: "Nödvändiga cookies" / "Krävs för att webbplatsen ska fungera korrekt"
    - Functional: "Funktionella cookies" / "Möjliggör inloggning och sessionshantering"
    - Payment: "Betalningscookies" / "Krävs för betalningar via Stripe"
    - Buttons: "Acceptera alla", "Spara val", "Avvisa icke nödvändiga"
    - Details toggle: "Visa detaljer" / "Dölj detaljer"

  - When any button is clicked: call `setConsent()` with the appropriate values, then set `visible` to false.
  - Add a slide-up animation: use Tailwind's `animate-in slide-in-from-bottom` (already available from the Dialog component's animation setup).

Use imports:
- `import { Button } from "@/components/ui/button"`
- `import { Switch } from "@/components/ui/switch"`
- `import { cn } from "@/lib/utils"`
- `import { getConsent, setConsent, hasConsent, type CookieConsent } from "@/lib/cookie-consent"`
- `import { Cookie } from "lucide-react"` for a cookie icon in the heading (check if available; if not, use `Shield` icon instead)

Do NOT use Dialog for this — it should be a non-modal banner (GDPR best practice: users should be able to browse while the banner is visible, not be blocked by a modal overlay).
  </action>
  <verify>
    Run `cd /Users/jonasstenberg/Development/Private/recept-cookie-consent && pnpm build` to verify TypeScript compiles without errors. Check that the component file exports `CookieConsentBanner` and the utility file exports all specified functions.
  </verify>
  <done>
    - `cookie-consent.ts` exports `getConsent`, `setConsent`, `hasConsent`, `hasPaymentConsent`, `resetConsent`, and `CookieConsent` type
    - `cookie-consent-banner.tsx` renders a fixed bottom banner with Swedish text, category toggles via Switch, and accept/save/reject buttons
    - No TypeScript or build errors
  </done>
</task>

<task type="auto">
  <name>Task 2: Mount banner in root layout and add footer preferences link</name>
  <files>
    apps/frontend/app/layout.tsx
    apps/frontend/components/footer.tsx
  </files>
  <action>
**1. Update `apps/frontend/app/layout.tsx`**

Import `CookieConsentBanner` from `@/components/cookie-consent-banner` and render it inside the body, after the `div.flex.min-h-screen` container but still inside `body`. It must be a sibling of the main container div, not nested inside it, so it renders at the viewport bottom regardless of page content.

The updated JSX should look like:
```tsx
<body className={`${inter.className} ${playfair.variable}`}>
  <div className="flex min-h-screen flex-col">
    {children}
  </div>
  <CookieConsentBanner />
</body>
```

**2. Update `apps/frontend/components/footer.tsx`**

Add a "Cookie-inställningar" (Cookie settings) button/link below the copyright text that allows users to re-open the cookie consent banner. This should:
- Import `resetConsent` from `@/lib/cookie-consent` — but since Footer is a server component, we need a different approach.
- Instead, make Footer accept an optional slot or simply add a client component `CookieSettingsButton` inline.
- The simplest approach: Create a small inline `"use client"` button component within the footer file OR create a separate tiny `cookie-settings-button.tsx` component.

Best approach for minimal files: Add a `CookieSettingsButton` as a named export from `cookie-consent-banner.tsx`. This client component renders a button with text "Cookie-inställningar" styled as `text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline cursor-pointer transition-colors`. When clicked, it calls `resetConsent()` and then `window.location.reload()` to re-show the banner.

Then in `footer.tsx`:
- Convert footer to include the client component: Import `CookieSettingsButton` from `@/components/cookie-consent-banner`
- Add it below the copyright paragraph, maintaining the centered flex layout
- The footer should show: copyright line, then a separator dot or pipe, then "Cookie-inställningar"

Updated footer layout:
```tsx
<div className="flex flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
  <p>&copy; {new Date().getFullYear()} Recept</p>
  <CookieSettingsButton />
</div>
```
  </action>
  <verify>
    Run `cd /Users/jonasstenberg/Development/Private/recept-cookie-consent && pnpm build` to verify no build errors. Then run `pnpm dev` and check in browser:
    1. On first visit (clear localStorage `cookie-consent` key), banner appears at bottom
    2. Clicking "Acceptera alla" hides the banner and it does not reappear on refresh
    3. Clicking "Cookie-inställningar" in footer resets consent and shows the banner again
  </verify>
  <done>
    - Root layout renders `CookieConsentBanner` as a sibling after the main content div
    - Footer includes "Cookie-inställningar" link that resets consent and re-shows the banner
    - Full app builds without errors
    - Banner appears on first visit and respects stored consent on subsequent visits
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Cookie consent banner with Swedish UI, granular consent controls for functional/payment cookies, localStorage persistence, and footer link to change preferences</what-built>
  <how-to-verify>
    1. Start dev server: `pnpm dev` and open http://localhost:3000
    2. Open DevTools > Application > Local Storage and delete the `cookie-consent` key if present
    3. Refresh the page — a cookie consent banner should appear at the bottom
    4. Verify the banner text is in Swedish with proper characters (a, a, o)
    5. Click "Visa detaljer" — three cookie categories should appear with Switch toggles
    6. Verify "Nodvandiga cookies" switch is always on and disabled
    7. Verify "Funktionella cookies" defaults to on, "Betalningscookies" defaults to off
    8. Click "Acceptera alla" — banner should disappear
    9. Refresh the page — banner should NOT reappear
    10. Check localStorage — `cookie-consent` key should have JSON with all values true
    11. Scroll to footer — click "Cookie-installningar"
    12. Banner should reappear, allowing preferences to be changed
    13. Test "Avvisa icke nodvandiga" button — should keep functional=true, set payment=false
    14. Verify banner styling matches the warm color theme of the app
  </how-to-verify>
  <resume-signal>Type "approved" or describe any issues with the banner</resume-signal>
</task>

</tasks>

<verification>
- `pnpm build` completes without errors
- Banner appears on first visit (no `cookie-consent` in localStorage)
- Banner does not appear when consent is already stored
- All three action buttons (accept all, save, reject) work correctly
- Cookie categories can be toggled independently
- Footer "Cookie-inställningar" link re-shows banner
- All text is in Swedish with correct characters
- Banner is non-modal (page content is accessible behind it)
- `hasPaymentConsent()` returns correct value based on stored consent
</verification>

<success_criteria>
- GDPR-compliant cookie consent banner with granular category controls
- Swedish language UI matching the app's existing warm design system
- Consent persisted in localStorage, checked on every page load
- Footer link allows users to change their preferences at any time
- `hasPaymentConsent()` utility available for Stripe checkout flow to check before initiating payment
- Full build passes with no TypeScript errors
</success_criteria>

<output>
After completion, create `.planning/quick/001-cookie-consent-popup/001-SUMMARY.md`
</output>
