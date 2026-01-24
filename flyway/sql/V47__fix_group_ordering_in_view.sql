-- V47: Fix group ordering in recipes_and_categories view
--
-- The previous view ordered ingredients and instructions by group_id (UUID),
-- which doesn't respect the group's sort_order. This migration fixes the
-- ordering to use the group's sort_order instead.

-- =============================================================================
-- 1. Drop dependent objects in correct order
-- =============================================================================

-- Drop functions that depend on recipes_and_categories type
DROP FUNCTION IF EXISTS search_recipes(TEXT, TEXT, TEXT, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS search_liked_recipes(TEXT, TEXT, INTEGER, INTEGER);

-- Drop views in dependency order
DROP VIEW IF EXISTS liked_recipes;
DROP VIEW IF EXISTS recipes_and_categories;

-- =============================================================================
-- 2. Recreate recipes_and_categories view with correct group ordering
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
  ) AS is_liked
FROM recipes
LEFT JOIN LATERAL (
  SELECT jsonb_agg(name) AS categories FROM (
    SELECT categories.name FROM categories, recipe_categories WHERE recipe_categories.category = categories.id AND recipe_categories.recipe = recipes.id
  ) AS rc_categories
) AS rc ON TRUE
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
        'unit_id', ingredient.unit_id
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

GRANT SELECT ON "recipes_and_categories" TO "anon";

-- =============================================================================
-- 3. Recreate liked_recipes view (depends on recipes_and_categories)
-- =============================================================================

CREATE OR REPLACE VIEW liked_recipes AS
SELECT
  rac.*,
  rl.date_published as liked_at
FROM recipe_likes rl
INNER JOIN recipes_and_categories rac ON rac.id = rl.recipe_id
WHERE rl.user_email = current_setting('request.jwt.claims', true)::jsonb->>'email';

GRANT SELECT ON liked_recipes TO "anon";

-- =============================================================================
-- 4. Recreate search_recipes function (with p_category parameter)
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
SET search_path = public
AS $$
  SELECT rac.*
  FROM recipes_and_categories rac
  JOIN recipes r ON r.id = rac.id
  WHERE
    -- Guard against NULL/empty query
    COALESCE(trim(p_query), '') != ''
    -- Trigram ILIKE uses GIN index for large tables
    -- escape_like_pattern prevents %, _, \ from being interpreted as wildcards
    AND r.search_text ILIKE '%' || escape_like_pattern(p_query) || '%'
    -- Optional filters
    AND (p_owner IS NULL OR rac.owner = p_owner)
    AND (p_category IS NULL OR p_category = ANY(rac.categories))
  ORDER BY
    -- Priority 1: Exact name match
    CASE WHEN rac.name ILIKE escape_like_pattern(p_query) THEN 0
    -- Priority 2: Name starts with query
         WHEN rac.name ILIKE escape_like_pattern(p_query) || '%' THEN 1
    -- Priority 3: Name contains query
         WHEN rac.name ILIKE '%' || escape_like_pattern(p_query) || '%' THEN 2
    -- Priority 4: Match in description/ingredients
         ELSE 3
    END,
    -- Secondary: word_similarity for better substring ranking
    -- word_similarity('lamm', 'Lammlåda') = 0.8 vs similarity = 0.18
    word_similarity(p_query, rac.name) DESC,
    -- Tertiary: newest first
    rac.date_published DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;

GRANT EXECUTE ON FUNCTION search_recipes(TEXT, TEXT, TEXT, INTEGER, INTEGER) TO "anon";

COMMENT ON FUNCTION search_recipes IS
  'Substring search for recipes using pg_trgm. Finds "sås" in "vaniljsås".
   Uses GIN trigram index for fast ILIKE matching at scale.
   Results ranked by: exact match > prefix > contains > word_similarity.
   Returns empty result set if query is NULL or empty.';

-- =============================================================================
-- 5. Recreate search_liked_recipes function (with p_category parameter)
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
  liked_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT lr.*
  FROM liked_recipes lr
  JOIN recipes r ON r.id = lr.id
  WHERE
    -- Guard against NULL/empty query
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

GRANT EXECUTE ON FUNCTION search_liked_recipes(TEXT, TEXT, INTEGER, INTEGER) TO "anon";
