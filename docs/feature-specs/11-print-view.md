# Print View

## Overview

A clean, print-optimized recipe layout. One page per recipe with ingredients and instructions formatted for paper. No images, navigation, or interactive elements.

**Value Proposition:**
- Many people prefer cooking from paper
- Useful for sharing recipes with non-digital family members
- Low implementation effort (CSS only, no backend work)

## User Stories

1. Click "Skriv ut" on a recipe page to get a print-friendly view
2. Recipe fits on 1-2 pages with clean formatting
3. Ingredients and instructions are clearly separated
4. Source URL included at the bottom for reference
5. No images, ads, or navigation in print output

## Implementation

### Approach: CSS @media print
No new route needed. Add print styles to the existing recipe page.

```css
@media print {
  /* Hide non-recipe elements */
  nav, footer, .sidebar, .like-button,
  .cooking-mode-btn, .print-btn,
  .notes-section, .related-recipes {
    display: none !important;
  }

  /* Reset layout */
  body {
    font-size: 12pt;
    color: black;
    background: white;
  }

  /* Recipe title */
  .recipe-title {
    font-size: 18pt;
    margin-bottom: 0.5em;
  }

  /* Two-column layout for ingredients + instructions */
  .recipe-content {
    display: grid;
    grid-template-columns: 1fr 2fr;
    gap: 2em;
  }

  /* Ingredients */
  .ingredients-list {
    border-right: 1px solid #ccc;
    padding-right: 1em;
  }

  .ingredient-item {
    padding: 2px 0;
  }

  /* Instructions */
  .instruction-step {
    margin-bottom: 0.75em;
    line-height: 1.5;
  }

  /* Footer with source */
  .recipe-source::after {
    content: attr(href);
    display: block;
    font-size: 9pt;
    color: #666;
    margin-top: 2em;
  }

  /* Page break control */
  .recipe-header { page-break-after: avoid; }
  .instruction-step { page-break-inside: avoid; }
}
```

### Print Button
```tsx
<button onClick={() => window.print()} className="print:hidden">
  Skriv ut
</button>
```

## Print Layout

```
┌─────────────────────────────────────────┐
│  Pasta Carbonara                        │
│  4 portioner                            │
├──────────────┬──────────────────────────┤
│ Ingredienser │ Instruktioner            │
│              │                          │
│ 400 g spag.  │ 1. Koka pastan enligt   │
│ 200 g guan.  │    förpackning.         │
│ 4 äggulor    │                          │
│ 1 dl pecor.  │ 2. Stek guancialen i en │
│ Svartpeppar  │    torr panna.          │
│              │                          │
│              │ 3. Blanda äggulor och   │
│              │    pecorino.            │
│              │                          │
│              │ 4. Häll av pastavattnet │
│              │    och blanda ihop.     │
├──────────────┴──────────────────────────┤
│  recept.example.com/pasta-carbonara     │
└─────────────────────────────────────────┘
```

## Edge Cases

1. **Very long recipes**: Allow page breaks between instruction groups, never mid-step
2. **No ingredients or instructions**: Print whatever is available
3. **Mobile print**: Single column layout when page width < 500pt
4. **Scaled recipe**: Print the currently scaled quantities if scaling is active

## Success Metrics

- Usage: Print button clicks per month
- Minimal — this is a utility feature, not a growth lever
