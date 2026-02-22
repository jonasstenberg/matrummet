---
name: base-recipes
version: 1.0.0
description: Scrape, load, and manage the base recipe pool for the meal planner. Handles scraping Swedish recipe sites, loading into database, and verifying integration. Use when user says "scrape recipes", "load base recipes", "base recipe pool", or "update base recipes".
allowed-tools: Bash, Read, Glob, Grep, Edit, Write, TaskOutput
context: fork
---

# Base Recipes

> Manage the ~200 curated Swedish recipe pool that the meal planner uses as suggestions for users (especially new users with zero recipes).

<when_to_use>

## When to Use

Invoke when user says:

- "scrape recipes" / "scrape base recipes"
- "load base recipes"
- "update base recipes"
- "base recipe pool"
- "check base recipes"
</when_to_use>

<architecture>

## Architecture

Scraper scripts live **outside the main repo** at `../recept-scraper/` (sibling directory) to avoid committing scraping code to the open source project.

```
../recept-scraper/               # EXTERNAL — not in this repo
├── index.ts          # Main orchestrator (discover → fetch → parse → save JSON)
├── classify.ts       # Diet type classification (vegan/vegetarian/pescetarian/meat)
├── load-base-recipes.ts  # Upsert data/base-recipes.json → base_recipes table
├── progress.json     # Checkpoint file (auto-generated)
└── sites/
    ├── types.ts      # SiteCrawler interface
    ├── ica.ts        # ICA.se crawler (recipe URLs end with numeric ID)
    ├── koket.ts      # Koket.se crawler (root-level recipe URLs)
    └── arla.ts       # Arla.se crawler (/recept/{slug}/ format)

data/base-recipes.json              # Scraped recipe data (output, in this repo)
flyway/sql/V39__base_recipes.sql    # Migration: table + RPC + RLS
```

### Data Flow

```
Site category pages → Playwright URL discovery → Playwright fetch recipe page
  → extractJsonLdRecipe() (cheerio JSON-LD parser from lib/recipe-import)
  → mapJsonLdToRecipeInput() (maps to internal format)
  → flat-to-grouped transform (ingredient_groups / instruction_groups)
  → classifyDiet() (keyword matching on ingredient names)
  → data/base-recipes.json
  → load-base-recipes.ts → base_recipes table (upsert on source_url)
```

### Meal Planner Integration

- `apps/web/app/api/ai/meal-plan/route.ts` — fetches base recipes via `get_base_recipes` RPC, passes to prompt
- `apps/web/lib/meal-plan/prompt.ts` — lists base recipes as `[BASE:uuid]` in "BASRECEPT" section
- When AI picks `BASE:uuid`, route converts to `suggested_recipe` entry with full data + `source_url`/`source_site` attribution
- Frontend shows "Basrecept" badge + source link instead of "AI-förslag"

</architecture>

<commands>

## Commands

All scraper commands run from `../recept-scraper/` (the sibling directory).

### Scrape recipes

```bash
cd ../recept-scraper

# Full run (~200 recipes, takes 30-60 min with polite delays)
npx tsx index.ts

# Test with a few recipes
npx tsx index.ts --limit 5

# Resume from checkpoint after interruption
npx tsx index.ts --resume
```

**Output**: `data/base-recipes.json` (in the main repo)
**Checkpoint**: `../recept-scraper/progress.json`

### Load into database

```bash
cd ../recept-scraper

# Dry run (show what would be inserted)
npx tsx load-base-recipes.ts --dry-run

# Load/upsert into base_recipes table
npx tsx load-base-recipes.ts

# Custom database URL
DATABASE_URL=postgresql://user:pass@host:5432/db npx tsx load-base-recipes.ts
```

Default connection: `postgresql://matrummet:matrummet@localhost:5432/matrummet`

### Apply migration

```bash
./flyway/run-flyway.sh migrate  # Applies V39__base_recipes.sql
```

### Verify

```bash
# Check recipe count and distribution
psql -h localhost -U matrummet -d matrummet -c "
  SELECT diet_type, count(*) FROM base_recipes GROUP BY diet_type ORDER BY count DESC;
"

# Check RPC works
curl -s http://localhost:4444/rpc/get_base_recipes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"p_limit": 3}' | jq '.[].name'
```

</commands>

<site_patterns>

## Site URL Patterns

| Site | Recipe URL Pattern | Discovery Method |
|------|-------------------|-----------------|
| ICA.se | `/recept/{slug}-{numericId}/` | Category pages + "Visa fler" button |
| Koket.se | `/{slug}` (root level) | Homepage + tag pages, filter non-recipes |
| Arla.se | `/recept/{slug}/` (2 path parts) | Category listing pages |

All three sites provide JSON-LD `Recipe` schema data that the scraper extracts.

</site_patterns>

<diet_classification>

## Diet Classification

Order of precedence:
1. Source category contains "vegan" → `vegan`
2. Ingredient names match meat keywords → `meat`
3. Ingredient names match fish keywords → `pescetarian`
4. Source category contains "vegetari" → `vegetarian`
5. Ingredient names match dairy/egg keywords → `vegetarian`
6. No matches → `vegan`

Uses word-boundary matching to avoid false positives (e.g., "färsk" ≠ "färs").

</diet_classification>

<database>

## Database Schema

```sql
-- Table: base_recipes
-- Indexes: diet_type (btree), categories (GIN)
-- RLS: SELECT only for authenticated role
-- Key constraint: source_url UNIQUE

-- RPC: get_base_recipes(p_diet_types text[], p_categories text[], p_limit int)
--   Returns random recipes matching optional diet/category filters
```

### JSONB Formats

**ingredients** (matches SuggestedRecipe):
```json
[{"group_name": "", "ingredients": [{"name": "pasta", "measurement": "g", "quantity": "400"}]}]
```

**instructions** (matches SuggestedRecipe):
```json
[{"group_name": "", "instructions": [{"step": "Koka pastan..."}]}]
```

</database>

<troubleshooting>

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Scraper finds 0 URLs | Site redesigned HTML | Inspect with Playwright MCP, update crawler |
| JSON-LD not found | Site uses client-side rendering | Increase wait time in `fetchRecipePage()` |
| Wrong diet classification | Keyword mismatch | Add/fix keywords in `classify.ts` |
| Load fails on upsert | Missing migration | Run `./flyway/run-flyway.sh migrate` |
| Meal planner ignores base recipes | RPC returns empty | Check `base_recipes` table has data, RLS grants SELECT |
| `BASE:uuid` not resolved | AI returned wrong ID format | Check prompt formatting in `prompt.ts` |

</troubleshooting>

<adding_sites>

## Adding a New Site

1. Create `../recept-scraper/sites/{site}.ts` implementing `SiteCrawler`
2. Inspect the site's recipe listing pages with Playwright MCP to find:
   - URL pattern for individual recipes vs categories
   - Pagination mechanism
   - Whether JSON-LD `Recipe` schema is present
3. Add the crawler to the `crawlers` array in `index.ts`
4. Test with `--limit 5`

</adding_sites>
