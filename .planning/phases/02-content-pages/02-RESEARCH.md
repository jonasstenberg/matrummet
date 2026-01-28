# Phase 2: Content Pages - Research

**Researched:** 2026-01-28
**Domain:** Next.js 16 static content pages with Tailwind v4 typography
**Confidence:** HIGH

## Summary

This phase creates three Swedish content pages (About, Privacy Policy, Terms of Service) using Next.js 16 App Router's file-system routing with static metadata. The existing project already has @tailwindcss/typography installed but not enabled. Content pages will use route groups to inherit the existing (main) layout (Header + Footer) while applying typography-specific styling through the prose utility classes.

The standard approach is to create page.tsx files at the app root or within route groups, use the typography plugin's prose classes for reading-optimized layout, and export static metadata for SEO. Swedish GDPR compliance requires plain language privacy policies, and terms of service should address user-generated content ownership.

**Primary recommendation:** Create pages in (main) route group to inherit existing layout, enable @tailwindcss/typography with @plugin directive, use prose classes with max-width constraints for reading-optimized content.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.1.1 | App Router static pages | Project's framework, file-system routing, built-in metadata API |
| @tailwindcss/typography | 0.5.16 | Prose styling | Already installed, official Tailwind plugin for content-heavy pages |
| Tailwind CSS | 4.1.8 | Utility styling | Project's CSS framework, v4 requires @plugin directive |
| React | 19.2.3 | UI rendering | Next.js dependency, Server Components default |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| next/font | 16.1.1 | Font optimization | Already configured with Inter + Playfair Display |
| Metadata API | 16.1.1 | SEO optimization | Export metadata object from page.tsx for title/description |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| prose classes | Custom CSS | Typography plugin provides tested, accessible defaults vs manual styling |
| (main) route group | Root app/ folder | Route groups inherit existing layout (Header + Footer) vs needing separate layout |
| Static pages | MDX | MDX adds build complexity for simple prose pages |

**Installation:**
```bash
# Typography plugin already installed, just needs enabling
# No additional packages required
```

## Architecture Patterns

### Recommended Project Structure
```
app/
├── (main)/                # Existing route group with Header + Footer layout
│   ├── om/               # About page
│   │   └── page.tsx     # Static content with prose wrapper
│   ├── integritetspolicy/ # Privacy Policy page
│   │   └── page.tsx     # Static content with sections
│   └── villkor/          # Terms of Service page
│       └── page.tsx     # Static content with sections
└── globals.css           # Add @plugin '@tailwindcss/typography'
```

### Pattern 1: Static Content Page with Typography
**What:** Simple page.tsx with exported metadata and prose-wrapped content
**When to use:** All three content pages (About, Privacy, Terms)
**Example:**
```typescript
// Source: Context7 /vercel/next.js/v16.1.1
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Om Recept',
  description: 'Din digitala kokbok för att hantera favoritrecept',
}

export default function OmPage() {
  return (
    <div className="mx-auto max-w-prose">
      <article className="prose prose-neutral">
        <h1>Om Recept</h1>
        <p>Content here...</p>
      </article>
    </div>
  )
}
```

### Pattern 2: Enabling Typography Plugin in Tailwind v4
**What:** Use @plugin directive in CSS instead of tailwind.config
**When to use:** One-time setup in globals.css
**Example:**
```css
// Source: https://github.com/tailwindlabs/tailwindcss/discussions/14120
@import "tailwindcss";
@plugin '@tailwindcss/typography';
```

### Pattern 3: Prose Classes with Reading-Optimized Width
**What:** Combine prose utilities with max-width constraints
**When to use:** All content sections that need reading optimization
**Example:**
```typescript
// Source: Context7 /websites/tailwindcss + project requirements
<div className="mx-auto max-w-prose"> {/* ~65ch = ~650px */}
  <article className="prose prose-neutral">
    {/* Content inherits typography styles */}
  </article>
</div>
```

### Pattern 4: Sectioned Content with Headings
**What:** Semantic HTML structure with h2/h3 hierarchy for Privacy/Terms
**When to use:** Privacy Policy and Terms of Service pages
**Example:**
```typescript
<article className="prose prose-neutral">
  <h1>Integritetspolicy</h1>

  <section>
    <h2>Vilken data vi samlar in</h2>
    <p>...</p>
  </section>

  <section>
    <h2>Hur vi använder din data</h2>
    <p>...</p>
  </section>

  <p className="text-sm text-muted-foreground">
    Senast uppdaterad: 2026-01-28
  </p>
</article>
```

### Anti-Patterns to Avoid
- **Creating separate layout.tsx in content pages:** Route groups already inherit (main) layout with Header + Footer
- **Using custom typography CSS:** Typography plugin provides accessible, tested defaults
- **Skipping metadata export:** SEO requires title/description for search engines
- **Wide content columns:** Research shows 45-75 characters per line optimal for reading (prose classes handle this)
- **Styling headings with Tailwind classes inside prose:** Prose styles are overridden by direct classes, breaking consistency

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Typography styling | Custom line-height, font-size, spacing | @tailwindcss/typography prose classes | Handles vertical rhythm, accessible contrast ratios, responsive scaling |
| Reading width | Manual max-width calculations | max-w-prose utility | Pre-optimized to 65ch (~650px) for optimal reading |
| Heading hierarchy | Custom h1-h6 styles | prose-headings: modifiers | Maintains consistent visual hierarchy |
| SEO metadata | Custom <head> tags | Next.js Metadata API | Type-safe, prevents duplication, supports dynamic generation |
| Last updated date | JavaScript Date formatting | Swedish date format string | Avoids client-side hydration, simpler for static content |

**Key insight:** Typography is deceptively complex—line length, vertical rhythm, contrast ratios, and responsive scaling interact in non-obvious ways. The typography plugin encodes years of typographic best practices.

## Common Pitfalls

### Pitfall 1: Forgetting to Enable Typography Plugin
**What goes wrong:** prose classes have no effect, content appears unstyled
**Why it happens:** Tailwind v4 requires @plugin directive in CSS, not tailwind.config
**How to avoid:** Add `@plugin '@tailwindcss/typography'` to globals.css immediately after `@import "tailwindcss"`
**Warning signs:** Running dev server and prose classes don't apply any styling

### Pitfall 2: Prose Classes Inside Tailwind Utility Classes
**What goes wrong:** Direct Tailwind classes override prose styles unpredictably
**Why it happens:** Specificity rules favor direct classes over prose plugin styles
**How to avoid:** Use prose-{element}: modifiers or wrap content in unstyled divs with Tailwind classes
**Warning signs:** Some elements styled correctly, others lose typography plugin styles

### Pitfall 3: Placing Content Pages Outside Route Group
**What goes wrong:** Pages don't inherit Header + Footer, user sees inconsistent layout
**Why it happens:** Route group layouts only apply to children within the group
**How to avoid:** Create pages inside app/(main)/ folder structure
**Warning signs:** Footer links work but clicking them shows page without header/footer

### Pitfall 4: Skipping Heading Levels
**What goes wrong:** Screen readers announce confusing document structure
**Why it happens:** Visual styling temptation (h3 looks right, so skip h2)
**How to avoid:** Always maintain h1 → h2 → h3 hierarchy, use prose-h{n}: modifiers for styling
**Warning signs:** Accessibility audits flag heading structure issues

### Pitfall 5: Too-Wide Content on Desktop
**What goes wrong:** Line length exceeds 75 characters, readability suffers
**Why it happens:** Using container or max-w-7xl instead of max-w-prose
**How to avoid:** Use max-w-prose (65ch) for all reading content
**Warning signs:** Content feels hard to read on wide screens, eyes track too far

### Pitfall 6: Inconsistent Swedish Language Attributes
**What goes wrong:** Screen readers use wrong pronunciation, search engines misindex
**Why it happens:** Root layout sets lang="sv" but not verified for content pages
**How to avoid:** Verify root layout.tsx has lang="sv" (already present in project)
**Warning signs:** Browser translation prompts appear for Swedish content

## Code Examples

Verified patterns from official sources and project context:

### Complete About Page
```typescript
// app/(main)/om/page.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Om Recept',
  description: 'En enkel och personlig app för att hantera dina favoritrecept',
}

export default function OmPage() {
  return (
    <div className="mx-auto max-w-prose">
      <article className="prose prose-neutral">
        <h1>Om Recept</h1>
        <p>
          Recept är en digital kokbok för att samla, organisera och
          dela dina favoritrecept.
        </p>
        {/* Additional paragraphs */}
        <p className="text-sm text-muted-foreground">
          Senast uppdaterad: 2026-01-28
        </p>
      </article>
    </div>
  )
}
```

### Privacy Policy with Sections
```typescript
// app/(main)/integritetspolicy/page.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Integritetspolicy - Recept',
  description: 'Hur Recept hanterar din personliga data',
}

export default function IntegritetspolicyPage() {
  return (
    <div className="mx-auto max-w-prose">
      <article className="prose prose-neutral">
        <h1>Integritetspolicy</h1>

        <section>
          <h2>Vilken data vi samlar in</h2>
          <p>Vi samlar in följande data:</p>
          <ul>
            <li>E-postadress och lösenord (hashad)</li>
            <li>Receptdata som du skapar</li>
            <li>Stripe-kund-ID (inte kortuppgifter)</li>
          </ul>
        </section>

        <section>
          <h2>Vad vi INTE gör</h2>
          <p>
            Vi använder ingen analys eller spårning. Inga Google Analytics,
            ingen Plausible, inga tracking pixels.
          </p>
        </section>

        {/* More sections */}

        <p className="text-sm text-muted-foreground">
          Senast uppdaterad: 2026-01-28
        </p>
      </article>
    </div>
  )
}
```

### Enable Typography Plugin
```css
/* app/globals.css */
@import "tailwindcss";
@plugin '@tailwindcss/typography';

/* Existing @theme and styles continue below */
```

### Prose Color Customization (Optional)
```typescript
// If project's warm colors need prose integration
<article className="prose prose-neutral prose-headings:text-foreground prose-a:text-primary">
  {/* Content with project color scheme */}
</article>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| tailwind.config plugins array | @plugin directive in CSS | Tailwind v4 (2024) | Simpler configuration, CSS-based plugin loading |
| next/head component | Metadata API export | Next.js 13 App Router | Type-safe, prevents metadata duplication |
| Manual responsive typography | prose-sm/lg/xl modifiers | @tailwindcss/typography v0.5+ | Responsive typography with no media queries |
| Custom reading width | max-w-prose utility | Tailwind v3.0+ | 65ch default, optimal reading experience |

**Deprecated/outdated:**
- pages/ directory for new projects: App Router (app/) is standard for Next.js 13+
- require() in tailwind.config.js for v4: Use @plugin directive in CSS instead
- <Head> component from next/head: Use Metadata API in App Router

## Open Questions

Things that couldn't be fully resolved:

1. **Exact prose color theme to use**
   - What we know: Project uses custom warm color palette (--color-foreground, --color-primary)
   - What's unclear: Whether prose-neutral matches project colors or needs customization
   - Recommendation: Start with prose-neutral, test against design, add prose-{element}: modifiers if needed

2. **Privacy policy legal completeness**
   - What we know: Swedish GDPR requires plain language, must document data collection (auth, recipes, Stripe)
   - What's unclear: Whether Stripe integration requires additional GDPR disclosures beyond customer ID
   - Recommendation: Document what's stored (Stripe customer ID), clarify no card details stored, mention users can delete accounts

3. **Terms of service user content licensing scope**
   - What we know: Users own recipes, Matrummet needs license to display content
   - What's unclear: Extent of license needed (display only, or also derivative works for features like AI suggestions)
   - Recommendation: Standard display license, avoid overreach, keep aligned with "straightforward and minimal" tone

## Sources

### Primary (HIGH confidence)
- Context7 /vercel/next.js/v16.1.1 - App Router pages, layouts, metadata API
- Context7 /websites/tailwindcss - Typography utilities, max-width, prose classes
- GitHub @tailwindcss/typography repository - Plugin installation and usage
- https://github.com/tailwindlabs/tailwindcss/discussions/14120 - Tailwind v4 @plugin directive

### Secondary (MEDIUM confidence)
- W3C WAI Headings Tutorial (https://www.w3.org/WAI/tutorials/page-structure/headings/) - Heading hierarchy best practices
- A11Y Project Heading Structure (https://www.a11yproject.com/posts/how-to-accessible-heading-structure/) - Accessibility guidelines
- Swedish GDPR resources (Chambers Practice Guides 2025) - Plain language requirements

### Tertiary (LOW confidence)
- WebSearch SaaS terms templates - General patterns, needs customization for Swedish context
- WebSearch Swedish about page examples - No specific templates found

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in project, official Next.js patterns verified
- Architecture: HIGH - Route groups and prose classes verified in official docs
- Pitfalls: MEDIUM - Typography plugin pitfalls from experience, heading hierarchy from WCAG 2.2

**Research date:** 2026-01-28
**Valid until:** 2026-02-28 (30 days - stable stack, no breaking changes expected)
