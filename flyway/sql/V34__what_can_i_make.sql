-- V34: "Vad kan jag laga?" (What can I make?) feature
-- Implements user pantry and recipe ingredient matching
-- Allows users to find recipes based on ingredients they have at home

-- =============================================================================
-- 1. User Pantry Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_pantry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
  food_id UUID NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  quantity DECIMAL(10, 2),
  unit TEXT,
  added_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  expires_at DATE,
  UNIQUE(user_email, food_id)
);

CREATE INDEX user_pantry_user_email_idx ON user_pantry (user_email);
CREATE INDEX user_pantry_food_id_idx ON user_pantry (food_id);
CREATE INDEX user_pantry_expires_at_idx ON user_pantry (expires_at) WHERE expires_at IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON user_pantry TO "authenticated";

ALTER TABLE user_pantry ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_pantry FORCE ROW LEVEL SECURITY;

-- Users can only see their own pantry items
CREATE POLICY user_pantry_policy_select
  ON user_pantry
  FOR SELECT
  USING (user_email = current_setting('request.jwt.claims', true)::jsonb->>'email');

CREATE POLICY user_pantry_policy_insert
  ON user_pantry
  FOR INSERT
  WITH CHECK (user_email = current_setting('request.jwt.claims', true)::jsonb->>'email');

CREATE POLICY user_pantry_policy_update
  ON user_pantry
  FOR UPDATE
  USING (user_email = current_setting('request.jwt.claims', true)::jsonb->>'email');

CREATE POLICY user_pantry_policy_delete
  ON user_pantry
  FOR DELETE
  USING (user_email = current_setting('request.jwt.claims', true)::jsonb->>'email');

-- =============================================================================
-- 2. Recipe Ingredient Summary Materialized View
-- =============================================================================

CREATE MATERIALIZED VIEW recipe_ingredient_summary AS
SELECT
  r.id AS recipe_id,
  r.name AS title,
  r.owner,
  ARRAY_AGG(DISTINCT i.food_id) FILTER (WHERE i.food_id IS NOT NULL) AS food_ids,
  COUNT(DISTINCT i.food_id) FILTER (WHERE i.food_id IS NOT NULL) AS ingredient_count
FROM recipes r
LEFT JOIN ingredients i ON i.recipe_id = r.id
GROUP BY r.id, r.name, r.owner;

-- GIN index for fast array overlap/contains queries
CREATE INDEX recipe_ingredient_summary_food_ids_idx
  ON recipe_ingredient_summary USING GIN (food_ids);

CREATE INDEX recipe_ingredient_summary_recipe_id_idx
  ON recipe_ingredient_summary (recipe_id);

CREATE INDEX recipe_ingredient_summary_owner_idx
  ON recipe_ingredient_summary (owner);

-- Unique index required for REFRESH MATERIALIZED VIEW CONCURRENTLY
CREATE UNIQUE INDEX recipe_ingredient_summary_recipe_id_key
  ON recipe_ingredient_summary (recipe_id);

GRANT SELECT ON recipe_ingredient_summary TO "anon";
GRANT SELECT ON recipe_ingredient_summary TO "authenticated";

-- =============================================================================
-- 3. Function to Refresh Materialized View
-- =============================================================================

CREATE OR REPLACE FUNCTION refresh_recipe_ingredient_summary()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY recipe_ingredient_summary;
END;
$func$;

-- Only admin should be able to refresh (or call via cron/trigger)
-- For now, grant to authenticated for testing purposes
GRANT EXECUTE ON FUNCTION refresh_recipe_ingredient_summary() TO "authenticated";

-- =============================================================================
-- 4. Find Recipes by Ingredients Function
-- =============================================================================

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
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  -- Guard against NULL or empty input
  IF p_food_ids IS NULL OR array_length(p_food_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH matches AS (
    SELECT
      ris.recipe_id,
      ris.title,
      ris.owner,
      ris.ingredient_count::INTEGER AS total_ingredients,
      ris.food_ids,
      -- Count matching ingredients using subquery (& operator doesn't work with UUID[])
      (SELECT COUNT(*)::INTEGER FROM unnest(ris.food_ids) AS f WHERE f = ANY(p_food_ids)) AS matching_ingredients,
      -- Get missing food_ids
      COALESCE(
        ARRAY(SELECT unnest(ris.food_ids) EXCEPT SELECT unnest(p_food_ids)),
        ARRAY[]::UUID[]
      ) AS missing_ids
    FROM recipe_ingredient_summary ris
    WHERE ris.ingredient_count > 0
      AND (p_user_email IS NULL OR ris.owner = p_user_email)
  )
  SELECT
    m.recipe_id,
    r.name,
    r.description,
    r.image,
    -- Get categories for this recipe
    COALESCE(
      ARRAY(SELECT c.name FROM recipe_categories rc JOIN categories c ON c.id = rc.category WHERE rc.recipe = m.recipe_id ORDER BY c.name),
      ARRAY[]::TEXT[]
    ) AS categories,
    m.total_ingredients,
    m.matching_ingredients,
    CASE
      WHEN m.total_ingredients = 0 THEN 0
      ELSE (m.matching_ingredients * 100 / m.total_ingredients)::INTEGER
    END AS match_percentage,
    m.missing_ids AS missing_food_ids,
    -- Look up food names for missing ingredients
    COALESCE(
      ARRAY(SELECT f.name FROM unnest(m.missing_ids) AS mid JOIN foods f ON f.id = mid ORDER BY f.name),
      ARRAY[]::TEXT[]
    ) AS missing_food_names,
    m.owner,
    r.prep_time,
    r.cook_time,
    r.recipe_yield,
    r.recipe_yield_name
  FROM matches m
  JOIN recipes r ON r.id = m.recipe_id
  WHERE
    -- Must meet minimum match percentage
    CASE
      WHEN m.total_ingredients = 0 THEN FALSE
      ELSE (m.matching_ingredients * 100 / m.total_ingredients) >= p_min_match_percentage
    END
  ORDER BY
    -- Primary: match_percentage DESC
    (m.matching_ingredients * 100 / NULLIF(m.total_ingredients, 0)) DESC NULLS LAST,
    -- Secondary: matching_ingredients DESC (prefer recipes with more matches at same %)
    m.matching_ingredients DESC,
    -- Tertiary: fewer total ingredients (simpler recipes)
    m.total_ingredients ASC
  LIMIT p_limit;
END;
$func$;

GRANT EXECUTE ON FUNCTION find_recipes_by_ingredients(UUID[], TEXT, INTEGER, INTEGER) TO "anon";
GRANT EXECUTE ON FUNCTION find_recipes_by_ingredients(UUID[], TEXT, INTEGER, INTEGER) TO "authenticated";

COMMENT ON FUNCTION find_recipes_by_ingredients IS
  'Find recipes matching a list of food_ids.
   Returns recipes ordered by match percentage (highest first).
   p_food_ids: Array of food UUIDs to match against
   p_user_email: Optional filter by recipe owner
   p_min_match_percentage: Minimum % of ingredients that must match (default 50)
   p_limit: Maximum results to return (default 20)';

-- =============================================================================
-- 5. Pantry Management Functions
-- =============================================================================

-- Add or update pantry item (upsert)
CREATE OR REPLACE FUNCTION add_to_pantry(
  p_food_id UUID,
  p_quantity DECIMAL DEFAULT NULL,
  p_unit TEXT DEFAULT NULL,
  p_expires_at DATE DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user_email TEXT;
  v_pantry_id UUID;
BEGIN
  -- Get current user email from JWT
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  -- Validate food_id exists
  IF NOT EXISTS (SELECT 1 FROM foods WHERE id = p_food_id) THEN
    RAISE EXCEPTION 'food-not-found';
  END IF;

  -- Upsert into pantry
  INSERT INTO user_pantry (user_email, food_id, quantity, unit, expires_at)
  VALUES (v_user_email, p_food_id, p_quantity, p_unit, p_expires_at)
  ON CONFLICT (user_email, food_id) DO UPDATE SET
    quantity = EXCLUDED.quantity,
    unit = EXCLUDED.unit,
    expires_at = EXCLUDED.expires_at,
    added_at = NOW()
  RETURNING id INTO v_pantry_id;

  RETURN v_pantry_id;
END;
$func$;

GRANT EXECUTE ON FUNCTION add_to_pantry(UUID, DECIMAL, TEXT, DATE) TO "authenticated";

-- Remove item from pantry
CREATE OR REPLACE FUNCTION remove_from_pantry(p_food_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user_email TEXT;
  v_deleted INTEGER;
BEGIN
  -- Get current user email from JWT
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  DELETE FROM user_pantry
  WHERE user_email = v_user_email AND food_id = p_food_id;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN v_deleted > 0;
END;
$func$;

GRANT EXECUTE ON FUNCTION remove_from_pantry(UUID) TO "authenticated";

-- Get user's pantry with food names
CREATE OR REPLACE FUNCTION get_user_pantry()
RETURNS TABLE (
  id UUID,
  food_id UUID,
  food_name TEXT,
  quantity DECIMAL,
  unit TEXT,
  added_at TIMESTAMPTZ,
  expires_at DATE,
  is_expired BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user_email TEXT;
BEGIN
  -- Get current user email from JWT
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  RETURN QUERY
  SELECT
    up.id,
    up.food_id,
    f.name AS food_name,
    up.quantity,
    up.unit,
    up.added_at,
    up.expires_at,
    CASE
      WHEN up.expires_at IS NULL THEN FALSE
      ELSE up.expires_at < CURRENT_DATE
    END AS is_expired
  FROM user_pantry up
  JOIN foods f ON f.id = up.food_id
  WHERE up.user_email = v_user_email
  ORDER BY
    -- Expired items first (for attention)
    CASE WHEN up.expires_at IS NOT NULL AND up.expires_at < CURRENT_DATE THEN 0 ELSE 1 END,
    -- Then by expiration date (soonest first)
    up.expires_at NULLS LAST,
    -- Then alphabetically
    f.name;
END;
$func$;

GRANT EXECUTE ON FUNCTION get_user_pantry() TO "authenticated";

-- =============================================================================
-- 6. Trigger to refresh materialized view when recipes/ingredients change
-- =============================================================================

-- Note: For production, consider using a background job (pg_cron) instead
-- of triggers to avoid blocking operations on high-traffic tables.
-- This trigger-based approach is simpler but may slow down recipe modifications.

CREATE OR REPLACE FUNCTION trigger_refresh_recipe_ingredient_summary()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  -- Use non-concurrent refresh in trigger (concurrent requires unique index and takes longer)
  -- For production with many updates, consider queuing refresh requests instead
  REFRESH MATERIALIZED VIEW recipe_ingredient_summary;
  RETURN NULL;
END;
$func$;

-- Refresh when recipes are inserted or deleted
DROP TRIGGER IF EXISTS recipe_ingredient_summary_recipe_trigger ON recipes;
CREATE TRIGGER recipe_ingredient_summary_recipe_trigger
  AFTER INSERT OR DELETE ON recipes
  FOR EACH STATEMENT
  EXECUTE FUNCTION trigger_refresh_recipe_ingredient_summary();

-- Refresh when ingredients change (insert, update, delete)
DROP TRIGGER IF EXISTS recipe_ingredient_summary_ingredient_trigger ON ingredients;
CREATE TRIGGER recipe_ingredient_summary_ingredient_trigger
  AFTER INSERT OR UPDATE OR DELETE ON ingredients
  FOR EACH STATEMENT
  EXECUTE FUNCTION trigger_refresh_recipe_ingredient_summary();

-- =============================================================================
-- 7. Helper: Find recipes from pantry (convenience function)
-- =============================================================================

CREATE OR REPLACE FUNCTION find_recipes_from_pantry(
  p_min_match_percentage INTEGER DEFAULT 50,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  recipe_id UUID,
  title TEXT,
  total_ingredients INTEGER,
  matching_ingredients INTEGER,
  match_percentage INTEGER,
  missing_food_ids UUID[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user_email TEXT;
  v_pantry_food_ids UUID[];
BEGIN
  -- Get current user email from JWT
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  -- Get all food_ids from user's pantry
  SELECT ARRAY_AGG(up.food_id)
  INTO v_pantry_food_ids
  FROM user_pantry up
  WHERE up.user_email = v_user_email;

  -- If pantry is empty, return no results
  IF v_pantry_food_ids IS NULL OR array_length(v_pantry_food_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  -- Use the main function to find matching recipes
  RETURN QUERY
  SELECT *
  FROM find_recipes_by_ingredients(v_pantry_food_ids, NULL, p_min_match_percentage, p_limit);
END;
$func$;

GRANT EXECUTE ON FUNCTION find_recipes_from_pantry(INTEGER, INTEGER) TO "authenticated";

COMMENT ON FUNCTION find_recipes_from_pantry IS
  'Find recipes that can be made with ingredients in the user''s pantry.
   Convenience wrapper around find_recipes_by_ingredients that automatically
   uses the authenticated user''s pantry contents.';

-- =============================================================================
-- 8. Common Pantry Items (Quick-add suggestions)
-- =============================================================================

-- Add category column to foods for common pantry items
ALTER TABLE foods ADD COLUMN IF NOT EXISTS common_pantry_category TEXT;

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS foods_common_pantry_category_idx
  ON foods (common_pantry_category)
  WHERE common_pantry_category IS NOT NULL;

-- Mark common pantry items
-- Basics (most kitchens have these)
UPDATE foods SET common_pantry_category = 'basic' WHERE LOWER(name) IN (
  -- Water, fats, dairy basics
  'vatten', 'salt', 'olivolja', 'rapsolja', 'solrosolja', 'sesamolja', 'kokosolja', 'smör',
  'mjölk', 'ägg',
  -- Sugars
  'socker', 'strösocker', 'florsocker', 'farinsocker', 'muscovadosocker', 'honung', 'sirap',
  -- Dairy products
  'grädde', 'vispgrädde', 'matlagningsgrädde', 'crème fraiche', 'gräddfil', 'filmjölk',
  'kesella', 'kvarg', 'cream cheese', 'färskost',
  -- Cheese
  'ost', 'riven ost', 'parmesan', 'mozzarella', 'fetaost', 'cheddar',
  -- Flour and baking
  'vetemjöl', 'bakpulver', 'bikarbonat', 'maizena', 'potatismjöl',
  -- Bread products
  'ströbröd', 'panko', 'kornflakes',
  -- Vinegar
  'vinäger', 'vitvinsvinäger', 'balsamvinäger', 'äppelcidervinäger', 'rödvinsvinäger',
  -- Condiments
  'soja', 'senap', 'dijonsenap', 'grovkornig senap', 'ketchup', 'majonnäs',
  -- Tomato products
  'tomatpuré', 'krossade tomater', 'passerade tomater',
  -- Coconut products
  'kokosmjölk', 'kokosgrädde',
  -- Grains and cereals
  'ris', 'risgryn', 'pasta', 'spagetti', 'makaroner', 'nudlar', 'couscous', 'bulgur', 'quinoa',
  'havregryn', 'müsli',
  -- Legumes
  'bönor', 'kidneybönor', 'svarta bönor', 'vita bönor', 'kikärtor', 'linser', 'röda linser'
);

-- Herbs (fresh and dried)
UPDATE foods SET common_pantry_category = 'herb' WHERE LOWER(name) IN (
  'basilika', 'oregano', 'timjan', 'rosmarin', 'persilja', 'dill', 'gräslök',
  'koriander', 'mynta', 'salvia', 'dragon', 'lagerblad', 'citronmeliss',
  'mejram', 'körvel', 'citrongräs'
);

-- Spices (dried/ground - NOT vegetables like paprika/bell pepper)
UPDATE foods SET common_pantry_category = 'spice' WHERE LOWER(name) IN (
  -- Peppers
  'svartpeppar', 'vitpeppar', 'cayennepeppar',
  -- Paprika powder (NOT paprika which is a vegetable)
  'paprikapulver', 'rökt paprikapulver',
  -- Sweet spices
  'kanel', 'kardemumma', 'muskot', 'muskotnöt', 'nejlika', 'kryddnejlika',
  'vanilj', 'vaniljsocker', 'saffran', 'allkrydda', 'kryddpeppar',
  -- Seeds
  'anis', 'stjärnanis', 'fänkålsfrö', 'korianderfrö', 'senapsfrö',
  -- Ground spices
  'gurkmeja', 'spiskummin', 'kummin', 'chilipulver', 'chiliflingor',
  -- Spice blends
  'curry', 'currypulver', 'garam masala', 'tandoori', 'ras el hanout',
  -- Garlic/onion powders
  'vitlökspulver', 'lökpulver', 'krossad vitlök', 'vitlökspasta',
  -- Other
  'ingefära', 'pepparrot', 'jalapeño'
);

-- Seasonings (flavor enhancers, fresh aromatics, sauces)
UPDATE foods SET common_pantry_category = 'seasoning' WHERE LOWER(name) IN (
  -- Fresh alliums
  'vitlök', 'lök', 'gul lök', 'rödlök', 'röd lök', 'schalottenlök', 'purjolök',
  'salladslök', 'vårlök',
  -- Citrus
  'citron', 'lime', 'citronsaft', 'limesaft',
  -- Stocks and broths
  'buljong', 'hönsbuljong', 'grönsaksbuljong', 'köttbuljong', 'fond',
  'fiskbuljong',
  -- Hot sauces
  'sambal oelek', 'sriracha', 'tabasco', 'chipotle',
  -- Fermented/umami
  'worcestershiresås', 'fisksås', 'miso', 'misopasta',
  -- Asian sauces
  'hoisinsås', 'ostronsås', 'teriyakisås',
  -- Pastes and spreads
  'tahini', 'kapris',
  -- Olives
  'oliver', 'svarta oliver', 'gröna oliver',
  -- Preserved vegetables
  'soltorkade tomater'
);

-- Function to get common pantry items grouped by category
CREATE OR REPLACE FUNCTION get_common_pantry_items()
RETURNS TABLE (
  id UUID,
  name TEXT,
  category TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    f.id,
    f.name,
    f.common_pantry_category AS category
  FROM foods f
  WHERE f.common_pantry_category IS NOT NULL
  ORDER BY
    CASE f.common_pantry_category
      WHEN 'basic' THEN 1
      WHEN 'seasoning' THEN 2
      WHEN 'herb' THEN 3
      WHEN 'spice' THEN 4
      ELSE 5
    END,
    f.name;
$$;

GRANT EXECUTE ON FUNCTION get_common_pantry_items() TO "anon";
GRANT EXECUTE ON FUNCTION get_common_pantry_items() TO "authenticated";

COMMENT ON FUNCTION get_common_pantry_items IS
  'Returns common pantry items (basics, herbs, spices, seasonings) for quick-add suggestions.
   Items are ordered by category priority and then alphabetically.';
