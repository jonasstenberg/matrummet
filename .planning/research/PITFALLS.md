# Domain Pitfalls: Settings Page Redesign & Route Extraction

**Domain:** Settings page UI restructure (horizontal tabs → sidebar) + Home feature extraction
**Researched:** 2026-01-27
**Confidence:** HIGH (verified with Next.js 16 docs, Context7, multiple 2026 sources)

## Critical Pitfalls

Mistakes that cause rewrites, data loss, or major user impact.

### Pitfall 1: Breaking Existing Bookmarks and Direct Links

**What goes wrong:** Users have bookmarked `/installningar/hemmet` (Home settings). When you extract it to `/hemmet` as a standalone page, all existing bookmarks return 404 errors. Users lose access to saved links, shared URLs in documentation/support tickets break, and browser history becomes unreliable.

**Why it happens:** Teams focus on the new navigation structure without auditing existing entry points. URL changes are treated as implementation details rather than breaking changes for users.

**Consequences:**
- Support burden increases (users report "broken links")
- Loss of trust (saved bookmarks stop working)
- SEO impact (indexed URLs return 404s)
- Broken documentation/help articles referencing old URLs

**Prevention:**
1. **Audit before restructure:** Search codebase for hardcoded URLs, check analytics for direct URL access patterns
2. **Implement redirects:** Create permanent redirects (308) from old URLs to new ones
3. **Add redirect tests:** Verify all old URL patterns redirect correctly
4. **Communicate changes:** If URLs are public/documented, announce deprecation timeline

**Detection:**
- Analytics show 404 spike on old settings URLs
- Support tickets mention "settings page not found"
- Browser back button leads to 404s
- Shared links in Slack/email stop working

**Which phase:** Phase 1 (Route restructure) must include redirect implementation

**Next.js specifics:**
```typescript
// In middleware.ts or next.config.js
redirects: async () => [
  {
    source: '/installningar/hemmet',
    destination: '/hemmet',
    permanent: true, // 308 redirect
  },
]
```

---

### Pitfall 2: Losing Layout State on Navigation (Pre-Next.js 16)

**What goes wrong:** User fills out Home settings form, clicks to another settings tab, returns to Home - all form input is lost. This happens with tabs-in-sidebar navigation if not properly implemented.

**Why it happens:** Next.js App Router layouts preserve state **within the same layout tree**, but if you restructure routes incorrectly, navigation can remount components. In Next.js <16, this is common. Next.js 16 with `cacheComponents` uses React's `<Activity>` to preserve state during client navigation, but this requires proper configuration.

**Consequences:**
- Lost form data frustrates users (especially long forms)
- Users avoid navigating between settings sections
- Increased support requests about "forms not saving"
- Poor perception of app quality

**Prevention:**
1. **Use Next.js 16+ with cacheComponents flag:** Enables Activity component for automatic state preservation
2. **Test navigation patterns:** Fill form → navigate away → return → verify data persists
3. **Consider React Context or URL state:** For critical unsaved state, persist to URL params or use shared context
4. **Implement auto-save:** For complex forms, debounced auto-save prevents data loss
5. **Add unsaved changes warning:** Prompt user before navigating away from dirty forms

**Detection:**
- User testing reveals "data disappears" complaints
- Form fields reset unexpectedly during navigation
- Users complain about having to re-enter data
- Analytics show users rarely navigate between settings tabs

**Which phase:** Phase 2 (Navigation implementation) - must test state preservation before launch

**Next.js 16 solution:**
```typescript
// next.config.ts
const nextConfig = {
  experimental: {
    cacheComponents: true, // Enables Activity-based state preservation
  },
}
```

---

### Pitfall 3: Missing Mobile-Responsive Layout for Sidebar

**What goes wrong:** Sidebar navigation works beautifully on desktop but becomes unusable on mobile. Either the sidebar takes full screen width (hiding content), or text overflows, or touch targets are too small. Users on mobile cannot access settings sections effectively.

**Why it happens:** Desktop-first design where sidebar is added as an afterthought for mobile. 53% of users abandon mobile sites that take >3 seconds to load, and poor mobile UX is often worse than slow load times.

**Consequences:**
- Settings unusable on mobile (where >50% of traffic originates)
- Users switch to desktop just to change settings
- Poor app store ratings mentioning "settings broken on mobile"
- Accessibility complaints (touch targets too small)

**Prevention:**
1. **Mobile-first design:** Start with mobile layout, expand to desktop
2. **Collapsible sidebar on mobile:** Use hamburger menu or bottom sheet pattern
3. **Test on real devices:** Simulators miss touch-target and gesture issues
4. **Maintain 44x44px minimum touch targets:** Industry standard for touch interactions
5. **Consider mobile-specific navigation:** Bottom tab bar may work better than sidebar on mobile

**Detection:**
- Mobile analytics show high bounce rate on settings pages
- Touch events registered on wrong elements
- Users report "can't click buttons" on mobile
- Horizontal scrolling on mobile viewport

**Which phase:** Phase 2 (Navigation UI) - mobile layout must be complete before launch

**Implementation pattern:**
```tsx
// Responsive sidebar component
<aside className="
  fixed inset-y-0 left-0 z-50 w-64
  lg:translate-x-0
  -translate-x-full /* Hidden on mobile by default */
  transition-transform
">
  {/* Sidebar content */}
</aside>

{/* Mobile toggle button - 44x44px minimum */}
<button
  className="lg:hidden fixed top-4 left-4 w-11 h-11"
  onClick={toggleSidebar}
>
```

---

### Pitfall 4: Inadequate Accessibility for Sidebar Navigation

**What goes wrong:** Sidebar navigation lacks proper ARIA attributes. Screen readers can't distinguish navigation landmarks, keyboard users can't tab through menu items correctly, and `aria-current="page"` is missing so users don't know which page is active.

**Why it happens:** Accessibility is treated as final polish rather than a core requirement. ARIA attributes are added hastily or copied from examples without understanding.

**Consequences:**
- Legal compliance risk (WCAG 2.1 violations)
- Screen reader users cannot navigate settings effectively
- Keyboard-only users struggle with focus management
- Poor experience for users with disabilities
- Potential lawsuits or accessibility complaints

**Prevention:**
1. **Wrap sidebar in semantic HTML:**
   ```tsx
   <nav aria-label="Inställningar">
     <aside aria-label="Inställningsmeny">
   ```
2. **Use `aria-current="page"` on active link:**
   ```tsx
   <Link href="/sakerhet" aria-current={isActive ? "page" : undefined}>
   ```
3. **Ensure keyboard navigation:** Test tab order, focus indicators, escape to close
4. **Test with screen readers:** VoiceOver (Mac), NVDA (Windows), TalkBack (Android)
5. **Maintain focus on menu toggle:** When closing mobile menu, return focus to toggle button

**Detection:**
- Automated accessibility tools (axe, Lighthouse) flag missing ARIA
- Screen reader announces "navigation" without description
- Tab order jumps unexpectedly
- Active page not announced to screen readers

**Which phase:** Phase 2 (Navigation UI) - accessibility is not optional

**Correct implementation:**
```tsx
<nav aria-label="Inställningar">
  <ul role="list">
    <li>
      <Link
        href="/installningar"
        aria-current={activeView === "profil" ? "page" : undefined}
        className="focus:ring-2 focus:ring-offset-2" // Visible focus
      >
        Profil
      </Link>
    </li>
  </ul>
</nav>
```

---

## Moderate Pitfalls

Mistakes that cause delays, technical debt, or moderate user friction.

### Pitfall 5: Not Testing Route Parameter Access After Extraction

**What goes wrong:** When extracting `/installningar/hemmet` to `/hemmet`, you move from nested route to top-level route. If `/hemmet` needs to access parent layout params or shared route context, it breaks because layout parameter scoping changed.

**Why it happens:** Next.js layouts only receive params "from the root segment down to that layout". When you move a route up a level, you lose access to params from the old parent layout.

**Consequences:**
- Runtime errors accessing undefined params
- Features that worked in nested route break in standalone route
- Auth checks or layout logic fails
- Need to refactor param passing

**Prevention:**
1. **Audit param usage:** Search for `params.` in component to find dependencies
2. **Test extracted route in isolation:** Ensure it works without parent layout context
3. **Move shared logic to root layout:** If multiple routes need same params, lift logic up
4. **Use searchParams instead:** For non-route data, query params are more flexible than route params

**Detection:**
- Runtime error: "Cannot read property X of undefined" in extracted route
- Layout component throws errors after extraction
- Auth middleware doesn't recognize route structure

**Which phase:** Phase 1 (Route extraction) - verify param access before committing structure

---

### Pitfall 6: Inconsistent Navigation State Between Desktop and Mobile

**What goes wrong:** Desktop sidebar stays open and shows active state. Mobile hamburger menu closes after selection but active state doesn't update. Users on mobile don't know which page they're on.

**Why it happens:** Desktop and mobile use different navigation components with separate state management. Mobile menu state is managed differently (open/close logic) and active state gets lost.

**Consequences:**
- Confusing mobile experience (no visual feedback)
- Users navigate to wrong section repeatedly
- Inconsistent behavior between viewport sizes
- Poor mobile UX perception

**Prevention:**
1. **Share active state logic:** Single source of truth for "which page is active"
2. **Sync visual active state:** Both desktop sidebar and mobile menu should show active page
3. **Test responsive breakpoints:** Verify state consistency when resizing viewport
4. **Use URL as source of truth:** Derive active state from `pathname` not local state

**Detection:**
- Mobile menu doesn't highlight current page
- Desktop sidebar shows different active state than mobile
- Resizing browser shows inconsistent active states

**Which phase:** Phase 2 (Navigation UI) - test mobile/desktop parity

**Implementation pattern:**
```tsx
// Derive active state from URL (shared logic)
const pathname = usePathname()
const activeView = pathname.startsWith('/installningar/sakerhet')
  ? 'sakerhet'
  : pathname.startsWith('/hemmet')
  ? 'hemmet'
  : 'profil'
```

---

### Pitfall 7: Over-Complicating Settings Categories (Too Many Tabs)

**What goes wrong:** After creating sidebar, team adds more and more settings categories. Sidebar has 8+ items. Users are overwhelmed and can't find settings. Analytics dashboards, CMS-based sites with uncontrolled content, and feature-creep products commonly suffer from "tab overload".

**Why it happens:** Each feature team wants "their" settings section. No one enforces consolidation. "Just add another tab" is easier than rethinking information architecture.

**Consequences:**
- Settings become unusable (too many choices)
- Users can't find what they need
- Search becomes mandatory (but might not exist)
- Mobile sidebar becomes unusable (too long)

**Prevention:**
1. **Enforce maximum 5-7 top-level categories:** Cognitive load research supports 5±2 items
2. **Use nested sections within tabs:** Group related settings under expandable sections
3. **Conduct card sorting:** Let users group settings naturally
4. **Implement search:** For >5 categories, search becomes mandatory
5. **Regularly audit settings:** Remove unused, consolidate related

**Detection:**
- Analytics show users rarely access certain settings sections
- User testing reveals "I couldn't find X"
- Mobile sidebar requires scrolling
- Heatmaps show users don't explore all sections

**Which phase:** Phase 3+ (Feature additions) - enforce IA rules when adding new settings

---

### Pitfall 8: Form Validation Breaks After Component Extraction

**What goes wrong:** Settings form worked fine as single page. After extracting to sidebar navigation with client components, form validation state doesn't work correctly. Errors don't display, or validation runs on wrong form instance.

**Why it happens:** Form state management (React Hook Form, Zod validation) was tightly coupled to old component structure. Extracting components breaks the form context or validation schema references.

**Consequences:**
- Users submit invalid data (server rejects)
- Poor UX (no error messages)
- Lost user trust (form seems broken)
- Need to refactor form logic

**Prevention:**
1. **Use React Hook Form with proper context:** `FormProvider` wraps all form components
2. **Test each form in isolation:** Each settings section should validate independently
3. **Keep validation schema close to form:** Don't share validation logic that needs to diverge
4. **Add form state tests:** Unit test form validation logic separately from UI

**Detection:**
- Form submits invalid data
- Validation errors don't display
- Multiple forms on page interfere with each other
- Error messages appear on wrong form

**Which phase:** Phase 3 (Testing & polish) - regression test all forms

---

### Pitfall 9: Ignoring Household Multi-User Context

**What goes wrong:** Home settings (household management) is extracted to standalone page, but design assumes single user. In reality, multiple household members might have different permissions (admin vs member), and UI doesn't reflect this. Users accidentally modify settings they shouldn't access.

**Why it happens:** Swedish recipe app context: users belong to "Hem" (households) that share recipes. Design treats settings as single-user without considering role-based access.

**Consequences:**
- Permission escalation (members change admin settings)
- Household conflicts (members delete each other's data)
- Need to retrofit role-based UI later (technical debt)
- Legal/security implications (unauthorized access)

**Prevention:**
1. **Design for roles from the start:** Admin/member/owner distinction in UI
2. **Show/hide controls based on role:** Don't just disable, hide irrelevant controls
3. **Test with multiple household members:** Simulate different permission levels
4. **Add permission checks on both client and server:** Client for UX, server for security

**Detection:**
- Users report "I shouldn't be able to do this"
- Household admins complain members changed settings
- Audit logs show unauthorized actions
- Support tickets about "accidental deletions"

**Which phase:** Phase 1 (Route extraction) - Home page must respect household roles from day one

---

### Pitfall 10: Regression Testing Gaps After Restructure

**What goes wrong:** After extracting routes and changing navigation, team doesn't run full regression tests. Existing features break in subtle ways: old tests fail, integration tests don't cover new routes, E2E tests use old URLs.

**Why it happens:** Testing is seen as optional polish. Team assumes "we only changed navigation, logic is the same". Test suite isn't updated to reflect new route structure.

**Consequences:**
- Bugs in production (features that worked now broken)
- User reports of broken functionality
- Rollback required (delays launch)
- Loss of confidence in codebase

**Prevention:**
1. **Update all tests for new routes:** Change URLs in E2E tests, update route references
2. **Test navigation flows end-to-end:** User story: "Navigate from recipe → settings → home settings → back to recipe"
3. **Run full test suite before merge:** Vitest unit tests, API integration tests, E2E tests
4. **Add tests for redirects:** Verify old URLs redirect correctly
5. **Test with clean browser state:** Clear localStorage/cookies to catch auth issues

**Detection:**
- CI/CD pipeline failures after merge
- E2E tests can't find elements (wrong URLs)
- Integration tests fail with 404s
- Users report "feature X stopped working"

**Which phase:** Phase 3 (Testing) - mandatory full regression before launch

**Testing checklist:**
```bash
# Must pass before launch
pnpm test              # Unit tests
pnpm test:api          # API integration tests
pnpm test:e2e          # E2E navigation flows
pnpm lint              # Code quality
```

---

## Minor Pitfalls

Mistakes that cause annoyance but are fixable quickly.

### Pitfall 11: Missing Loading States During Navigation

**What goes wrong:** Clicking sidebar item shows no feedback. User clicks again (double submission), or thinks the app is frozen. In Next.js 16, prefetching makes this less noticeable, but slow connections still experience it.

**Why it happens:** Developers test on localhost (instant navigation) and don't simulate slow 3G. Loading states are seen as polish, not requirement.

**Prevention:**
1. **Use Next.js `useRouter()` with loading state:**
   ```tsx
   const router = useRouter()
   const [isNavigating, setIsNavigating] = useState(false)
   ```
2. **Show skeleton screens:** During navigation, show content skeleton
3. **Test on throttled connection:** Chrome DevTools → Network → Slow 3G
4. **Use Suspense boundaries:** Next.js App Router with streaming

**Detection:**
- Users report "app feels frozen"
- Double-clicks on navigation items
- Analytics show duplicate page views (user clicks twice)

**Which phase:** Phase 3 (Polish) - add loading states before launch

---

### Pitfall 12: Inconsistent Spacing in Sidebar vs Content

**What goes wrong:** Desktop sidebar has beautiful spacing. Content area has different spacing. Visual inconsistency makes design feel amateur.

**Why it happens:** Sidebar and content built by different developers, or copied from different examples. No design system tokens for spacing.

**Prevention:**
1. **Use Tailwind spacing scale consistently:** `space-y-4`, `gap-6`, etc.
2. **Create design tokens:** Define spacing values once, reuse everywhere
3. **Visual regression testing:** Percy, Chromatic, or screenshot diffs
4. **Design review before merge:** Designer approves spacing consistency

**Detection:**
- Sidebar padding doesn't match content padding
- Inconsistent gaps between elements
- Designer flags "spacing feels off"

**Which phase:** Phase 3 (Polish) - design review catches this

---

### Pitfall 13: Forgetting to Update Navigation in Mobile Menu

**What goes wrong:** Desktop sidebar shows "Hemmet" as standalone link. Mobile hamburger menu still shows old nested structure or doesn't include the new link at all.

**Why it happens:** Desktop and mobile navigation are separate components. Developer updates one, forgets the other.

**Prevention:**
1. **Share navigation data structure:** Single source of truth for nav items
2. **Component-driven design:** Desktop and mobile render from same data
3. **Test on mobile viewport:** Don't just resize browser, test on real device

**Detection:**
- Mobile menu doesn't match desktop sidebar
- Mobile users can't access new pages
- Inconsistent navigation across viewports

**Which phase:** Phase 2 (Navigation UI) - verify mobile/desktop parity

**Implementation pattern:**
```tsx
// Shared navigation data
const NAV_ITEMS = [
  { href: '/installningar', label: 'Profil' },
  { href: '/installningar/sakerhet', label: 'Säkerhet' },
  { href: '/hemmet', label: 'Hemmet' }, // Used by both desktop and mobile
]
```

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Route restructure (Phase 1) | Breaking bookmarks/URLs | Implement 308 redirects immediately |
| Route restructure (Phase 1) | Losing access to layout params | Audit param usage before extraction |
| Route restructure (Phase 1) | Multi-user permissions ignored | Design role-based UI from start |
| Navigation UI (Phase 2) | Layout state loss on navigation | Enable Next.js 16 `cacheComponents` |
| Navigation UI (Phase 2) | Unusable mobile sidebar | Mobile-first design, collapsible sidebar |
| Navigation UI (Phase 2) | Missing accessibility attributes | Add ARIA labels, test with screen readers |
| Navigation UI (Phase 2) | Mobile/desktop state inconsistency | Share active state logic, derive from URL |
| Navigation UI (Phase 2) | Mobile menu not updated | Share navigation data structure |
| Testing (Phase 3) | Regression test gaps | Run full test suite (unit, API, E2E) |
| Testing (Phase 3) | Form validation breaks | Test each form in isolation |
| Testing (Phase 3) | Missing loading states | Throttle network, add loading UI |
| Feature additions (Phase 3+) | Too many sidebar categories | Enforce 5-7 max, use nested sections |

---

## Next.js 16 Specific Gotchas

### Async Request APIs (Breaking Change)

**Issue:** Next.js 15 introduced Async Request APIs with temporary sync compatibility. Next.js 16 **fully removes synchronous access**. APIs like `params`, `searchParams`, `cookies()`, `headers()` must be awaited.

**Impact on settings redesign:** If settings pages use `params` or `searchParams` synchronously, they'll break.

**Fix:**
```tsx
// ❌ Old (breaks in Next.js 16)
export default function Page({ params }) {
  const id = params.id
}

// ✅ New (Next.js 16 required)
export default async function Page({ params }) {
  const resolvedParams = await params
  const id = resolvedParams.id
}
```

**Phase:** Phase 0 (Pre-work) - update all route handlers before restructure

---

### Layout Deduplication Changes Navigation Behavior

**Issue:** Next.js 16 overhauled navigation with layout deduplication. Shared layouts download once instead of separately for each link. This changes prefetch behavior and can affect how quickly navigation feels.

**Impact:** Navigation timing changes. Users might notice faster subsequent navigations but slower first navigation.

**Mitigation:** Test navigation performance on slow connections. Ensure loading states are present.

**Phase:** Phase 2 (Navigation implementation) - test performance

---

### State Preservation with Activity Component

**Issue:** Next.js 16 with `cacheComponents` uses React's `<Activity>` component. When you navigate away, route is set to `mode="hidden"` instead of unmounting. Effects clean up when hidden, recreate when visible.

**Impact:** `useEffect` cleanup logic must handle hidden state. If effects have side effects (API calls, timers), they'll be cleaned up and recreated.

**Mitigation:**
1. Enable `cacheComponents` intentionally (it's experimental)
2. Test effects that run on mount (do they handle repeated cleanup/setup?)
3. Consider `useEffectEvent` for non-reactive effect logic (React 19.2 feature)

**Phase:** Phase 2 (Navigation) - test effect behavior across navigations

---

## Sources

### Settings UX & Design Patterns
- [How to Improve App Settings UX | Toptal®](https://www.toptal.com/designers/ux/settings-ux)
- [Setting the stage: Designing settings screen UI - LogRocket](https://blog.logrocket.com/ux-design/designing-settings-screen-ui/)
- [11 Common UI/UX Design Mistakes (and How to Fix Them) — 2026](https://www.ideapeel.com/blogs/ui-ux-design-mistakes-how-to-fix-them)
- [13 UX Design Mistakes You Should Avoid in 2026](https://www.wearetenet.com/blog/ux-design-mistakes)

### Tabs to Standalone Pages
- [Tabs UX: Best Practices, Examples, and When to Avoid Them](https://www.eleken.co/blog-posts/tabs-ux)

### Next.js 16 Navigation & Routing
- [Next.js 16 Release Notes](https://nextjs.org/blog/next-16)
- [Next.js Dynamic Route Segments in the App Router (2026 Guide)](https://thelinuxcode.com/nextjs-dynamic-route-segments-in-the-app-router-2026-guide/)
- [Next.js 15 Upgrade Guide: App Router changes, caching gotchas](https://prateeksha.com/blog/nextjs-15-upgrade-guide-app-router-caching-migration)
- [Common mistakes with the Next.js App Router - Vercel](https://vercel.com/blog/common-mistakes-with-the-next-js-app-router-and-how-to-fix-them)
- [Mastering Next.js Routing: Dynamic Routes, Route Groups, and Parallel Routes](https://dev.to/devjordan/mastering-nextjs-routing-dynamic-routes-route-groups-and-parallel-routes-1m5h)
- [A guide to Next.js layouts and nested layouts - LogRocket](https://blog.logrocket.com/guide-next-js-layouts-nested-layouts/)

### Mobile Responsive Design
- [8 Common Website Design Mistakes to Avoid in 2026](https://www.zachsean.com/post/8-common-website-design-mistakes-to-avoid-in-2026-for-better-conversions-and-user-experience)
- [8 Common Responsive Design Mistakes - Practical Ecommerce](https://www.practicalecommerce.com/8-Common-Responsive-Design-Mistakes)
- [9 Common Responsive Web Design Mistakes and How to Avoid Them](https://parachutedesign.ca/blog/responsive-web-design-mistakes/)
- [Top 10 Mistakes to Avoid in Responsive Web Design Projects in 2024](https://medium.com/@uidesign0005/top-10-mistakes-to-avoid-in-responsive-web-design-projects-in-2024-0578d5304a58)

### SPA Navigation State
- [SPA Routing and Navigation: Best Practices](https://docsallover.com/blog/ui-ux/spa-routing-and-navigation-best-practices/)
- [Understanding single page apps & client-side routing](https://bholmes.dev/blog/spas-clientside-routing/)
- [Modern client-side routing: the Navigation API](https://developer.chrome.com/docs/web-platform/navigation-api)

### Accessibility (ARIA)
- [ARIA: navigation role - MDN](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/navigation_role)
- [Make Navigation Accessible with aria-current](https://www.a11y-collective.com/blog/aria-current/)
- [Accessibility Tips for Secondary Navigation](https://theadminbar.com/accessibility-weekly/secondary-nav-menus/)

### URL Structure & Bookmarks
- [Web UI breaking changes in 4.3 - GitHub Issue](https://github.com/gravitational/teleport/issues/3580)
- [Bookmarkable - W3C](https://www.w3.org/Provider/Style/Bookmarkable.html)

### State Management & Forms (2026)
- [State Management in 2026: Redux, Context API, and Modern Patterns](https://www.nucamp.co/blog/state-management-in-2026-redux-context-api-and-modern-patterns)
- [Essentials of Managing Form State with React Hook Form](https://refine.dev/blog/react-hook-form/)
- [The Ultimate UX Design of Form Validation](https://designmodo.com/ux-form-validation/)
- [7 Top React State Management Libraries in 2026](https://trio.dev/7-top-react-state-management-libraries/)

### Testing & Component Extraction
- [Common Sense Refactoring of a Messy React Component](https://alexkondov.com/refactoring-a-messy-react-component/)
- [Regression Testing: An In-Depth Guide for 2026](https://www.leapwork.com/blog/regression-testing)
- [How to get the text of an element using Playwright in 2026](https://www.browserstack.com/guide/playwright-get-text-of-element)

### Multi-User & Personalization
- [12 UI/UX Design Trends That Will Dominate 2026](https://www.index.dev/blog/ui-ux-design-trends)
- [B2B SaaS UX Design in 2026: Challenges & Patterns](https://www.onething.design/post/b2b-saas-ux-design)

### Next.js 16 Documentation (Context7 - HIGH confidence)
- [Next.js v16.1.5 - Layouts and State Preservation](https://github.com/vercel/next.js/blob/v16.1.5/docs/01-app/01-getting-started/03-layouts-and-pages.mdx)
- [Next.js v16.1.5 - Cache Components (Activity)](https://github.com/vercel/next.js/blob/v16.1.5/docs/01-app/01-getting-started/06-cache-components.mdx)

---

## Confidence Assessment

| Pitfall Category | Confidence | Reason |
|-----------------|------------|--------|
| Settings UX patterns | HIGH | Multiple authoritative sources (Toptal, LogRocket), consistent findings |
| Next.js 16 routing | HIGH | Verified with Context7 official docs, release notes, 2026 guides |
| Mobile responsive | HIGH | Consistent patterns across 5+ sources, industry standards |
| Accessibility | HIGH | MDN, W3C, established ARIA patterns |
| State management | MEDIUM | 2026 trends verified, but implementation-specific |
| Multi-user patterns | MEDIUM | General UX principles, less specific to household context |
| URL/bookmark impact | HIGH | GitHub issues, W3C standards, real-world examples |

---

## Research Methodology

**Sources used:**
- ✅ Context7 (Next.js v16.1.5 official docs) - HIGH confidence
- ✅ Official documentation (Next.js, MDN, W3C) - HIGH confidence
- ✅ WebSearch verified with multiple sources (2026 articles) - MEDIUM-HIGH confidence
- ✅ Real-world examples (GitHub issues, blog posts) - MEDIUM confidence

**Verification protocol:**
- All Next.js 16 claims verified against Context7 official docs
- UX patterns verified across 3+ independent sources
- 2026 search queries used to ensure current information
- Cross-referenced technical claims with official documentation

**What was NOT found:**
- Specific "household multi-user settings" patterns (generic multi-user patterns used instead)
- Direct "extracting route from tabs to standalone" case studies (inferred from general routing best practices)

**Gaps for phase-specific research:**
- Specific performance impact of sidebar vs tabs (needs benchmarking)
- Optimal number of settings categories for Swedish recipe app context (needs user research)
- Exact Next.js 16 `cacheComponents` stability (experimental flag, may change)
