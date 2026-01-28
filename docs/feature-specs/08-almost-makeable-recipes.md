# Almost Makeable Recipes (Pantry Enhancement)

## Overview

Extend the existing pantry-matching feature to show recipes where the user is missing only 1-2 ingredients. Displays a badge like "saknar 2 varor" and lets users add missing items to their shopping list in one tap.

**Value Proposition:**
- Makes the pantry feature significantly more useful for meal decisions
- Drives recipe discovery beyond exact matches
- Bridges pantry and shopping list features into a natural workflow
- Reduces food waste by encouraging use of available ingredients

## User Stories

1. See recipes sorted by how many ingredients I already have
2. See a clear badge showing how many ingredients are missing
3. Filter to show only recipes missing 1, 2, or 3 ingredients
4. View which specific ingredients are missing for a recipe
5. Add all missing ingredients to shopping list in one tap
6. Exclude common pantry staples (salt, pepper, water) from missing counts

## Database

### View/Function for Pantry Match Scoring

```sql
CREATE OR REPLACE FUNCTION recipes_by_pantry_match(p_email TEXT)
RETURNS TABLE (
  recipe_id INTEGER,
  total_ingredients INTEGER,
  matched_ingredients INTEGER,
  missing_count INTEGER,
  match_percentage NUMERIC,
  missing_ingredient_names TEXT[]
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $func$
  WITH user_pantry AS (
    SELECT food_id
    FROM pantry_items pi
    JOIN homes h ON h.id = pi.home_id
    JOIN home_members hm ON hm.home_id = h.id
    WHERE hm.user_email = p_email
  ),
  recipe_match AS (
    SELECT
      i.recipe_id,
      COUNT(*) AS total_ingredients,
      COUNT(CASE WHEN up.food_id IS NOT NULL THEN 1 END) AS matched_ingredients,
      COUNT(CASE WHEN up.food_id IS NULL THEN 1 END) AS missing_count,
      ARRAY_AGG(
        CASE WHEN up.food_id IS NULL THEN f.name END
        ORDER BY i.sort_order
      ) FILTER (WHERE up.food_id IS NULL) AS missing_ingredient_names
    FROM ingredients i
    JOIN foods f ON f.id = i.food_id
    LEFT JOIN user_pantry up ON up.food_id = i.food_id
    WHERE i.food_id IS NOT NULL
      AND f.is_pantry_staple = false  -- exclude salt, pepper, water, etc.
    GROUP BY i.recipe_id
  )
  SELECT
    recipe_id,
    total_ingredients::INTEGER,
    matched_ingredients::INTEGER,
    missing_count::INTEGER,
    ROUND(matched_ingredients::NUMERIC / NULLIF(total_ingredients, 0) * 100, 0) AS match_percentage,
    missing_ingredient_names
  FROM recipe_match
  ORDER BY missing_count ASC, match_percentage DESC;
$func$;
```

### Pantry Staple Flag
```sql
ALTER TABLE foods ADD COLUMN is_pantry_staple BOOLEAN DEFAULT false;

-- Seed common staples
UPDATE foods SET is_pantry_staple = true
WHERE name IN ('salt', 'svartpeppar', 'vatten', 'olivolja', 'smör', 'socker', 'vetemjöl');
```

## API Endpoints

### Get Recipes by Pantry Match
`GET /rpc/recipes_by_pantry_match`

Query with PostgREST:
```
GET /rpc/recipes_by_pantry_match?p_email=user@example.com&missing_count=lte.3
```

### Add Missing Ingredients to Shopping List
Uses existing shopping list endpoints. Frontend composes the request from the `missing_ingredient_names` data.

## UI/UX

### Recipe Card Badge
```
┌─────────────────────┐
│  [Recipe Image]      │
│  Pasta Carbonara     │
│  ██████████░░ 80%    │  ← match bar
│  Saknar 2 varor      │  ← missing count badge
└─────────────────────┘
```

### Filter Controls
```
[Alla] [Kan lagas ✓] [Saknar 1] [Saknar 2-3] [Saknar 4+]
```

### Missing Ingredients Expandable
When tapped, show:
```
Saknar 2 varor:
• guanciale
• pecorino romano
[+ Lägg till i inköpslistan]
```

## Edge Cases

1. **No pantry items**: Show all recipes without match scoring, prompt to set up pantry
2. **Recipe with no linked foods**: Exclude from matching, show normally
3. **All ingredients are staples**: Recipe shows as fully matchable
4. **Empty food_id on ingredients**: Skip unlinked ingredients in match calculation
5. **Large recipe collections**: Paginate results, index on food_id

## Success Metrics

- Engagement: % of pantry users who use the "almost makeable" filter
- Conversion: % of "almost makeable" views that result in shopping list additions
- Discovery: Increase in distinct recipes cooked per user per week
