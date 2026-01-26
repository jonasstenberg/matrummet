-- V52: Add pantry match data to recipes_and_categories view
--
-- Embeds per-ingredient in_pantry booleans and aggregate pantry match stats
-- (pantry_match_percentage, pantry_matching_count, pantry_total_count) directly
-- into the view. This eliminates the separate getRecipeMatchStats RPC round-trip
-- and keeps a single source of truth.
--
-- For anonymous users (no JWT), all pantry fields default to false/0.

-- =============================================================================
-- 1. Drop dependent objects (reverse dependency order)
-- =============================================================================

DROP FUNCTION IF EXISTS search_liked_recipes(TEXT, TEXT, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS search_recipes(TEXT, TEXT, TEXT, INTEGER, INTEGER);
DROP VIEW IF EXISTS liked_recipes;
DROP VIEW IF EXISTS recipes_and_categories;

-- =============================================================================
-- 2. Recreate recipes_and_categories with pantry match data
-- =============================================================================

CREATE OR REPLACE VIEW recipes_and_categories
AS
SELECT
  recipes.*,
  COALESCE(ARRAY(SELECT jsonb_array_elements_text(rc.categories)), ARRAY[]::text[]) AS categories,
  ing_grp.ingredient_groups,
  ing.ingredients,
  ins_grp.instruction_groups,
  ins.instructions,
  to_tsvector('pg_catalog.swedish',
              concat_ws(' ',
                        recipes.name,
                        recipes.description,
                        ing.names,
                        ing.forms,
                        jsonb_path_query_array(rc.categories::jsonb, '$'::jsonpath),
                        ins.steps
                       )
             ) as full_tsv,
  -- Check if current user has liked this recipe
  EXISTS (
    SELECT 1 FROM recipe_likes
    WHERE recipe_likes.recipe_id = recipes.id
    AND recipe_likes.user_email = current_setting('request.jwt.claims', true)::jsonb->>'email'
  ) AS is_liked,
  -- Pantry match stats
  COALESCE(pantry_stats.matching_count, 0) AS pantry_matching_count,
  COALESCE(pantry_stats.total_count, 0) AS pantry_total_count,
  CASE
    WHEN COALESCE(pantry_stats.total_count, 0) = 0 THEN 0
    ELSE (COALESCE(pantry_stats.matching_count, 0) * 100 / pantry_stats.total_count)::INTEGER
  END AS pantry_match_percentage
FROM recipes
LEFT JOIN LATERAL (
  SELECT jsonb_agg(name) AS categories FROM (
    SELECT categories.name FROM categories, recipe_categories WHERE recipe_categories.category = categories.id AND recipe_categories.recipe = recipes.id
  ) AS rc_categories
) AS rc ON TRUE
-- Fetch current user's pantry food_ids (empty array for anonymous users)
LEFT JOIN LATERAL (
  SELECT COALESCE(array_agg(up.food_id), ARRAY[]::UUID[]) AS food_ids
  FROM user_pantry up
  WHERE up.user_email = current_setting('request.jwt.claims', true)::jsonb->>'email'
) AS pantry ON TRUE
LEFT JOIN LATERAL (
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', ig.id,
      'name', ig.name,
      'sort_order', ig.sort_order
    ) ORDER BY ig.sort_order
  ) AS ingredient_groups
  FROM ingredient_groups ig
  WHERE ig.recipe_id = recipes.id
) AS ing_grp ON TRUE
LEFT JOIN LATERAL (
  SELECT
    jsonb_agg(
      jsonb_build_object(
        'id', ingredient.id,
        'name', COALESCE(food.name, ingredient.name),
        'measurement', COALESCE(
          NULLIF(unit.abbreviation, ''),
          unit.name,
          ingredient.measurement
        ),
        'quantity', ingredient.quantity,
        'form', ingredient.form,
        'group_id', ingredient.group_id,
        'sort_order', ingredient.sort_order,
        'food_id', ingredient.food_id,
        'unit_id', ingredient.unit_id,
        'in_pantry', ingredient.food_id IS NOT NULL AND ingredient.food_id = ANY(pantry.food_ids)
      ) ORDER BY ig.sort_order NULLS FIRST, ingredient.sort_order
    ) AS ingredients,
    string_agg(COALESCE(food.name, ingredient.name), ' ') AS names,
    string_agg(ingredient.form, ' ') FILTER (WHERE ingredient.form IS NOT NULL) AS forms
  FROM ingredients ingredient
  LEFT JOIN foods food ON ingredient.food_id = food.id AND food.status = 'approved'
  LEFT JOIN units unit ON ingredient.unit_id = unit.id
  LEFT JOIN ingredient_groups ig ON ingredient.group_id = ig.id
  WHERE ingredient.recipe_id = recipes.id
) AS ing ON TRUE
-- Aggregate pantry match counts (DISTINCT food_id to match recipe_ingredient_summary behavior)
LEFT JOIN LATERAL (
  SELECT
    COUNT(DISTINCT i.food_id) FILTER (WHERE i.food_id IS NOT NULL)::INTEGER AS total_count,
    COUNT(DISTINCT i.food_id) FILTER (
      WHERE i.food_id IS NOT NULL AND i.food_id = ANY(pantry.food_ids)
    )::INTEGER AS matching_count
  FROM ingredients i
  WHERE i.recipe_id = recipes.id
) AS pantry_stats ON TRUE
LEFT JOIN LATERAL (
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', instg.id,
      'name', instg.name,
      'sort_order', instg.sort_order
    ) ORDER BY instg.sort_order
  ) AS instruction_groups
  FROM instruction_groups instg
  WHERE instg.recipe_id = recipes.id
) AS ins_grp ON TRUE
LEFT JOIN LATERAL (
  SELECT
    jsonb_agg(
      jsonb_build_object(
        'id', instruction.id,
        'step', instruction.step,
        'group_id', instruction.group_id,
        'sort_order', instruction.sort_order
      ) ORDER BY instg.sort_order NULLS FIRST, instruction.sort_order
    ) AS instructions,
    string_agg(instruction.step, ' ') AS steps
  FROM instructions instruction
  LEFT JOIN instruction_groups instg ON instruction.group_id = instg.id
  WHERE instruction.recipe_id = recipes.id
) AS ins ON TRUE;

-- =============================================================================
-- 3. Recreate liked_recipes view
-- =============================================================================

CREATE OR REPLACE VIEW liked_recipes AS
SELECT
  rac.*,
  rl.date_published as liked_at
FROM recipe_likes rl
INNER JOIN recipes_and_categories rac ON rac.id = rl.recipe_id
WHERE rl.user_email = current_setting('request.jwt.claims', true)::jsonb->>'email';

-- =============================================================================
-- 4. Recreate search_recipes function
-- =============================================================================

CREATE OR REPLACE FUNCTION search_recipes(
  p_query TEXT,
  p_owner TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS SETOF recipes_and_categories
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, extensions
AS $$
  SELECT rac.*
  FROM recipes_and_categories rac
  JOIN recipes r ON r.id = rac.id
  WHERE
    COALESCE(trim(p_query), '') != ''
    AND r.search_text ILIKE '%' || escape_like_pattern(p_query) || '%'
    AND (p_owner IS NULL OR rac.owner = p_owner)
    AND (p_category IS NULL OR p_category = ANY(rac.categories))
  ORDER BY
    CASE WHEN rac.name ILIKE escape_like_pattern(p_query) THEN 0
         WHEN rac.name ILIKE escape_like_pattern(p_query) || '%' THEN 1
         WHEN rac.name ILIKE '%' || escape_like_pattern(p_query) || '%' THEN 2
         ELSE 3
    END,
    word_similarity(p_query, rac.name) DESC,
    rac.date_published DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;

-- =============================================================================
-- 5. Recreate search_liked_recipes function (with new pantry columns)
-- =============================================================================

CREATE OR REPLACE FUNCTION search_liked_recipes(
  p_query TEXT,
  p_category TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  date_published TIMESTAMPTZ,
  date_modified TIMESTAMPTZ,
  name TEXT,
  author TEXT,
  url TEXT,
  recipe_yield INTEGER,
  recipe_yield_name TEXT,
  prep_time INTEGER,
  cook_time INTEGER,
  cuisine TEXT,
  description TEXT,
  image TEXT,
  thumbnail TEXT,
  owner TEXT,
  tsv TSVECTOR,
  search_text TEXT,
  categories TEXT[],
  ingredient_groups JSONB,
  ingredients JSONB,
  instruction_groups JSONB,
  instructions JSONB,
  full_tsv TSVECTOR,
  is_liked BOOLEAN,
  pantry_matching_count INTEGER,
  pantry_total_count INTEGER,
  pantry_match_percentage INTEGER,
  liked_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, extensions
AS $$
  SELECT lr.*
  FROM liked_recipes lr
  JOIN recipes r ON r.id = lr.id
  WHERE
    COALESCE(trim(p_query), '') != ''
    AND r.search_text ILIKE '%' || escape_like_pattern(p_query) || '%'
    AND (p_category IS NULL OR p_category = ANY(lr.categories))
  ORDER BY
    CASE WHEN lr.name ILIKE escape_like_pattern(p_query) THEN 0
         WHEN lr.name ILIKE escape_like_pattern(p_query) || '%' THEN 1
         WHEN lr.name ILIKE '%' || escape_like_pattern(p_query) || '%' THEN 2
         ELSE 3
    END,
    word_similarity(p_query, lr.name) DESC,
    lr.liked_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;

-- =============================================================================
-- 6. Re-grant permissions lost by DROP/CREATE
--    (matches V49/V50 grant state)
-- =============================================================================

-- Views
GRANT SELECT ON recipes_and_categories TO anon;
GRANT SELECT ON recipes_and_categories TO authenticated;
GRANT SELECT ON liked_recipes TO authenticated;

-- Functions
GRANT EXECUTE ON FUNCTION search_recipes(TEXT, TEXT, TEXT, INTEGER, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION search_recipes(TEXT, TEXT, TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION search_liked_recipes(TEXT, TEXT, INTEGER, INTEGER) TO authenticated;
