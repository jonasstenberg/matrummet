# Recipe Import from URL

## Overview

Paste a link from a recipe website and auto-extract structured recipe data (title, ingredients, instructions, image). Most Swedish food sites use `schema.org/Recipe` JSON-LD, making reliable parsing possible.

**Value Proposition:**
- Eliminates the biggest friction point: manual recipe entry
- Enables users to quickly migrate existing collections from other sites
- Leverages widely adopted structured data standards

## User Stories

1. Paste a URL and see a preview of the extracted recipe
2. Edit extracted fields before saving
3. Auto-map extracted ingredients to existing foods in the database
4. Handle sites without structured data via AI fallback
5. Import recipe image from source URL

## Supported Sources

### Tier 1: JSON-LD (schema.org/Recipe)
Most reliable. Sites include:
- ICA (ica.se/recept)
- Köket (koket.se)
- Arla (arla.se/recept)
- Coop (coop.se/recept)
- Tasteline (tasteline.com)
- International: AllRecipes, BBC Good Food, Serious Eats

### Tier 2: AI Extraction Fallback
For pages without structured data, send the page text to AI for extraction.

## Architecture

```
┌──────────┐     ┌──────────────┐     ┌───────────────┐
│  Client   │────>│  Next.js API  │────>│  Fetch URL    │
│  (paste)  │     │  /api/import  │     │  + Parse HTML │
└──────────┘     └──────────────┘     └───────────────┘
                        │                      │
                        │              ┌───────────────┐
                        │              │ Extract JSON-LD│
                        │              │ or AI fallback │
                        │              └───────────────┘
                        ▼
                 ┌──────────────┐
                 │ Return parsed │
                 │ recipe draft  │
                 └──────────────┘
```

## API Endpoints

### Extract Recipe from URL
`POST /api/recipes/import`
```json
{
  "url": "https://www.ica.se/recept/pasta-carbonara-12345/"
}
```

### Response
```json
{
  "source_url": "https://www.ica.se/recept/pasta-carbonara-12345/",
  "extraction_method": "json-ld",
  "name": "Pasta Carbonara",
  "description": "Klassisk italiensk pasta...",
  "yield": "4 portioner",
  "ingredients": [
    { "original": "400 g spaghetti", "quantity": 400, "unit": "g", "food": "spaghetti", "food_id": "uuid-or-null" },
    { "original": "200 g guanciale", "quantity": 200, "unit": "g", "food": "guanciale", "food_id": null }
  ],
  "instructions": [
    { "step": 1, "text": "Koka pastan enligt förpackning." },
    { "step": 2, "text": "Stek guancialen knaprig." }
  ],
  "image_url": "https://...",
  "categories": ["Pasta", "Italienskt"],
  "prep_time_minutes": 15,
  "cook_time_minutes": 20
}
```

## Parsing Logic

### Step 1: Fetch and Parse HTML
```typescript
async function extractRecipe(url: string): Promise<RecipeDraft> {
  const html = await fetch(url).then(r => r.text());

  // Try JSON-LD first
  const jsonLd = extractJsonLd(html);
  if (jsonLd) return parseSchemaOrgRecipe(jsonLd);

  // Try microdata
  const microdata = extractMicrodata(html);
  if (microdata) return parseMicrodata(microdata);

  // Fallback: AI extraction
  return extractWithAI(html, url);
}
```

### Step 2: Map Ingredients to Foods
For each extracted ingredient string:
1. Parse quantity + unit + food name
2. Exact match against `foods` table
3. Trigram similarity match (> 0.7)
4. Leave unmatched for user to resolve

### Step 3: Map Categories
Match extracted category strings against existing `categories` table using case-insensitive comparison.

## AI Fallback Prompt

```
Du extraherar receptdata från en webbsida. Returnera JSON med:
- name: receptnamn
- description: kort beskrivning
- yield: antal portioner
- ingredients: [{ original, quantity, unit, food }]
- instructions: [{ step, text }]
- categories: [string]

Webbsidans text:
{pageText}
```

## UI/UX

### Import Flow
```
1. [Klistra in URL] ─── input field + "Importera" button
        │
2. [Laddar...] ─── spinner with site favicon
        │
3. [Förhandsgranska] ─── editable preview
   ├── Namn (editable)
   ├── Bild (preview + option to remove)
   ├── Ingredienser (editable, food matching indicators)
   │   ├── ✅ spaghetti (matched)
   │   ├── ⚠️ guanciale (new food, will be created)
   │   └── Edit each row
   ├── Instruktioner (editable, reorderable)
   └── Kategorier (editable, autocomplete)
        │
4. [Spara recept] ─── creates recipe via existing insert_recipe()
```

### Placement
- Button/link on recipe list page: "+ Importera från URL"
- Also accessible from the create recipe page as an alternative to manual entry

## Edge Cases

1. **No structured data, AI fails**: Show error, offer manual entry with URL pre-filled as source
2. **Paywall/login-required pages**: Detect common patterns, show "Kunde inte nå receptet"
3. **Duplicate recipe**: Check if URL already imported, warn user
4. **Missing fields**: Allow partial import, mark missing fields for user to complete
5. **Non-recipe URL**: Detect and show "Ingen receptdata hittades"
6. **Rate limiting**: Limit imports per user (e.g., 10/hour for free tier)
7. **Image download fails**: Save recipe without image, allow manual upload later

## Database

```sql
-- Track import source on recipes
ALTER TABLE recipes ADD COLUMN source_url TEXT;
```

No new tables needed. The import endpoint returns a draft; saving uses the existing `insert_recipe()` function.

## Success Metrics

- Adoption: % of new recipes created via import vs manual
- Extraction accuracy: % of imports that don't require field edits
- Source coverage: % of submitted URLs that yield successful extraction
