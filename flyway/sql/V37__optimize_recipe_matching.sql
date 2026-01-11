-- V37: Optimize recipe matching performance
--
-- This migration:
-- 1. Creates a unified function to fetch recipes WITH match data in one query
-- 2. Optimizes find_recipes_by_ingredients with GIN index usage
-- 3. Adds a lightweight batch function for getting match stats

-- =============================================================================
-- 1. Unified function: Get recipes with pantry match data
-- =============================================================================
-- This is the key optimization: one query returns both recipes and match stats.
-- Use case: Frontend wants to show recipe grid with match percentages overlaid.

CREATE OR REPLACE FUNCTION get_recipes_with_pantry_match(
  p_food_ids UUID[],
  p_owner TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  -- Standard recipe fields from recipes_and_categories
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
  categories TEXT[],
  ingredients JSONB,
  instructions JSONB,
  is_liked BOOLEAN,
  -- Match data (NULL if p_food_ids is empty)
  total_ingredients INTEGER,
  matching_ingredients INTEGER,
  match_percentage INTEGER,
  missing_food_names TEXT[]
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $func$
DECLARE
  v_has_pantry BOOLEAN;
BEGIN
  v_has_pantry := p_food_ids IS NOT NULL AND array_length(p_food_ids, 1) > 0;

  RETURN QUERY
  SELECT
    rac.id,
    rac.date_published,
    rac.date_modified,
    rac.name,
    rac.author,
    rac.url,
    rac.recipe_yield,
    rac.recipe_yield_name,
    rac.prep_time,
    rac.cook_time,
    rac.cuisine,
    rac.description,
    rac.image,
    rac.thumbnail,
    rac.owner,
    rac.categories,
    rac.ingredients,
    rac.instructions,
    rac.is_liked,
    -- Match data: only computed if user has pantry items
    CASE WHEN v_has_pantry THEN ris.ingredient_count::INTEGER ELSE NULL END AS total_ingredients,
    CASE WHEN v_has_pantry THEN
      COALESCE(
        (SELECT COUNT(*)::INTEGER FROM unnest(ris.food_ids) AS f WHERE f = ANY(p_food_ids)),
        0
      )
    ELSE NULL END AS matching_ingredients,
    CASE WHEN v_has_pantry AND ris.ingredient_count > 0 THEN
      (
        (SELECT COUNT(*)::INTEGER FROM unnest(ris.food_ids) AS f WHERE f = ANY(p_food_ids))
        * 100 / ris.ingredient_count
      )::INTEGER
    ELSE NULL END AS match_percentage,
    CASE WHEN v_has_pantry THEN
      COALESCE(
        (
          SELECT array_agg(f.name ORDER BY f.name)
          FROM unnest(
            ARRAY(SELECT unnest(ris.food_ids) EXCEPT SELECT unnest(p_food_ids))
          ) AS mid(food_id)
          JOIN foods f ON f.id = mid.food_id
        ),
        ARRAY[]::TEXT[]
      )
    ELSE NULL END AS missing_food_names
  FROM recipes_and_categories rac
  LEFT JOIN recipe_ingredient_summary ris ON ris.recipe_id = rac.id
  WHERE
    (p_owner IS NULL OR rac.owner = p_owner)
    AND (p_category IS NULL OR p_category = ANY(rac.categories))
  ORDER BY rac.date_published DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$func$;

GRANT EXECUTE ON FUNCTION get_recipes_with_pantry_match(UUID[], TEXT, TEXT, INTEGER, INTEGER) TO "anon";
GRANT EXECUTE ON FUNCTION get_recipes_with_pantry_match(UUID[], TEXT, TEXT, INTEGER, INTEGER) TO "authenticated";

COMMENT ON FUNCTION get_recipes_with_pantry_match IS
  'Fetch recipes with embedded pantry match statistics in a single query.

   Returns all fields from recipes_and_categories plus:
   - total_ingredients: How many ingredients the recipe needs
   - matching_ingredients: How many the user has in pantry
   - match_percentage: Percentage of ingredients available
   - missing_food_names: Names of ingredients user is missing

   Match fields are NULL when p_food_ids is empty/null.

   p_food_ids: Array of food UUIDs from user pantry
   p_owner: Filter by recipe owner (NULL = all)
   p_category: Filter by category name (NULL = all)
   p_limit: Max results (default 50)
   p_offset: Pagination offset (default 0)';

-- =============================================================================
-- 2. Batch function for getting match stats for specific recipes
-- =============================================================================
-- Use case: Frontend fetched recipes via existing API, needs match data overlay.
-- Single call returns all match stats - no N+1 problem.

CREATE OR REPLACE FUNCTION get_recipe_match_stats(
  p_food_ids UUID[],
  p_recipe_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
  recipe_id UUID,
  total_ingredients INTEGER,
  matching_ingredients INTEGER,
  match_percentage INTEGER,
  missing_food_ids UUID[],
  missing_food_names TEXT[]
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $func$
BEGIN
  -- Guard against NULL or empty food_ids
  IF p_food_ids IS NULL OR array_length(p_food_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH stats AS (
    SELECT
      ris.recipe_id,
      ris.ingredient_count::INTEGER AS total_ings,
      ris.food_ids,
      -- Count matching ingredients
      COALESCE(
        (SELECT COUNT(*)::INTEGER FROM unnest(ris.food_ids) AS f WHERE f = ANY(p_food_ids)),
        0
      ) AS matching_ings,
      -- Get missing food_ids
      COALESCE(
        ARRAY(SELECT unnest(ris.food_ids) EXCEPT SELECT unnest(p_food_ids)),
        ARRAY[]::UUID[]
      ) AS missing_ids
    FROM recipe_ingredient_summary ris
    WHERE ris.ingredient_count > 0
      AND (p_recipe_ids IS NULL OR ris.recipe_id = ANY(p_recipe_ids))
  )
  SELECT
    s.recipe_id,
    s.total_ings AS total_ingredients,
    s.matching_ings AS matching_ingredients,
    CASE
      WHEN s.total_ings = 0 THEN 0
      ELSE (s.matching_ings * 100 / s.total_ings)::INTEGER
    END AS match_percentage,
    s.missing_ids AS missing_food_ids,
    -- Look up missing food names
    COALESCE(
      (
        SELECT array_agg(f.name ORDER BY f.name)
        FROM unnest(s.missing_ids) AS mid(food_id)
        JOIN foods f ON f.id = mid.food_id
      ),
      ARRAY[]::TEXT[]
    ) AS missing_food_names
  FROM stats s;
END;
$func$;

GRANT EXECUTE ON FUNCTION get_recipe_match_stats(UUID[], UUID[]) TO "anon";
GRANT EXECUTE ON FUNCTION get_recipe_match_stats(UUID[], UUID[]) TO "authenticated";

COMMENT ON FUNCTION get_recipe_match_stats IS
  'Batch function to get match statistics for multiple recipes.
   Returns all match data in a single query - no N+1 problem.

   p_food_ids: Array of food UUIDs the user has (e.g., pantry items)
   p_recipe_ids: Optional array of recipe IDs to check. NULL = all recipes.

   Returns: recipe_id, ingredient counts, match percentage, missing food info.';

-- =============================================================================
-- 3. Optimized find_recipes_by_ingredients function
-- =============================================================================
-- Uses GIN index with && operator for early filtering

CREATE OR REPLACE FUNCTION find_recipes_by_ingredients(
  p_food_ids UUID[],
  p_user_email TEXT DEFAULT NULL,
  p_min_match_percentage INTEGER DEFAULT 50,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  recipe_id UUID,
  name TEXT,
  description TEXT,
  image TEXT,
  categories TEXT[],
  total_ingredients INTEGER,
  matching_ingredients INTEGER,
  match_percentage INTEGER,
  missing_food_ids UUID[],
  missing_food_names TEXT[],
  owner TEXT,
  prep_time INTEGER,
  cook_time INTEGER,
  recipe_yield INTEGER,
  recipe_yield_name TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $func$
BEGIN
  -- Guard against NULL or empty input
  IF p_food_ids IS NULL OR array_length(p_food_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH
  -- Step 1: Pre-compute match stats, using GIN index for early filtering
  match_stats AS (
    SELECT
      ris.recipe_id,
      ris.owner,
      ris.ingredient_count::INTEGER AS total_ings,
      ris.food_ids,
      -- Count matching ingredients
      (
        SELECT COUNT(*)::INTEGER
        FROM unnest(ris.food_ids) AS f(food_id)
        WHERE f.food_id = ANY(p_food_ids)
      ) AS matching_ings
    FROM recipe_ingredient_summary ris
    WHERE ris.ingredient_count > 0
      AND (p_user_email IS NULL OR ris.owner = p_user_email)
      -- GIN index filter: recipe must have at least one matching ingredient
      AND ris.food_ids && p_food_ids
  ),
  -- Step 2: Calculate percentages and filter by minimum
  filtered AS (
    SELECT
      ms.*,
      (ms.matching_ings * 100 / ms.total_ings)::INTEGER AS match_pct,
      ARRAY(SELECT unnest(ms.food_ids) EXCEPT SELECT unnest(p_food_ids)) AS missing_ids
    FROM match_stats ms
    WHERE (ms.matching_ings * 100 / ms.total_ings) >= p_min_match_percentage
  )
  -- Step 3: Join with recipes and get names
  SELECT
    f.recipe_id,
    r.name,
    r.description,
    r.image,
    COALESCE(
      (SELECT array_agg(c.name ORDER BY c.name)
       FROM recipe_categories rc JOIN categories c ON c.id = rc.category
       WHERE rc.recipe = f.recipe_id),
      ARRAY[]::TEXT[]
    ) AS categories,
    f.total_ings AS total_ingredients,
    f.matching_ings AS matching_ingredients,
    f.match_pct AS match_percentage,
    f.missing_ids AS missing_food_ids,
    COALESCE(
      (SELECT array_agg(fd.name ORDER BY fd.name)
       FROM unnest(f.missing_ids) AS mid(food_id)
       JOIN foods fd ON fd.id = mid.food_id),
      ARRAY[]::TEXT[]
    ) AS missing_food_names,
    f.owner,
    r.prep_time,
    r.cook_time,
    r.recipe_yield,
    r.recipe_yield_name
  FROM filtered f
  JOIN recipes r ON r.id = f.recipe_id
  ORDER BY
    f.match_pct DESC,
    f.matching_ings DESC,
    f.total_ings ASC
  LIMIT p_limit;
END;
$func$;

COMMENT ON FUNCTION find_recipes_by_ingredients IS
  'Find recipes matching a list of food_ids.
   Returns recipes ordered by match percentage (highest first).

   Optimized in V37:
   - Uses GIN index (&&) for early filtering - only considers recipes with overlap
   - Pre-computes stats in CTE to avoid repeated calculations

   p_food_ids: Array of food UUIDs to match against
   p_user_email: Optional filter by recipe owner
   p_min_match_percentage: Minimum % match required (default 50)
   p_limit: Maximum results (default 20)';

-- =============================================================================
-- 4. Add composite index for category lookups
-- =============================================================================

CREATE INDEX IF NOT EXISTS recipe_categories_recipe_category_idx
  ON recipe_categories (recipe, category);
