-- V56: Food Alias Support
--
-- Adds canonical_food_id to the foods table so synonym foods (e.g. "vitkål"/"kål",
-- "vispgrädde"/"grädde") are treated as equivalent in pantry matching, shopping
-- list merging, and search.
--
-- Design principle: Resolve to canonical at query time, not write time.
-- Original food names are preserved in ingredients and pantry. The materialized
-- view stores canonical food_ids for GIN index efficiency.

-- =============================================================================
-- 1a. Schema changes
-- =============================================================================

ALTER TABLE foods
  ADD COLUMN canonical_food_id UUID REFERENCES foods(id) ON DELETE SET NULL;

-- Self-reference constraint: a food cannot be its own alias
ALTER TABLE foods
  ADD CONSTRAINT foods_no_self_alias CHECK (canonical_food_id IS DISTINCT FROM id);

-- Partial index for efficient lookup of alias foods
CREATE INDEX foods_canonical_food_id_idx
  ON foods (canonical_food_id)
  WHERE canonical_food_id IS NOT NULL;

-- Trigger to prevent chains: the canonical target must itself be canonical (no canonical_food_id)
CREATE OR REPLACE FUNCTION check_no_alias_chain()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $func$
DECLARE
  v_target_canonical UUID;
BEGIN
  IF NEW.canonical_food_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if the target food itself has a canonical_food_id (would create a chain)
  SELECT canonical_food_id INTO v_target_canonical
  FROM foods
  WHERE id = NEW.canonical_food_id;

  IF v_target_canonical IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot create alias chain: target food "%" is itself an alias. Set canonical to its canonical food instead.', NEW.canonical_food_id
      USING HINT = 'The target food must be a canonical (non-alias) food.';
  END IF;

  RETURN NEW;
END;
$func$;

-- NOTE: The foods_no_alias_chain trigger is created AFTER seed data (section 1i)
-- to avoid unnecessary validation overhead during migration.

-- =============================================================================
-- 1b. Helper functions
-- =============================================================================

-- Resolve a single food_id to its canonical form
CREATE OR REPLACE FUNCTION resolve_canonical(p_food_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(f.canonical_food_id, f.id)
  FROM foods f
  WHERE f.id = p_food_id;
$$;

GRANT EXECUTE ON FUNCTION resolve_canonical(UUID) TO anon;
GRANT EXECUTE ON FUNCTION resolve_canonical(UUID) TO authenticated;

-- Resolve an array of food_ids to their canonical forms (deduped)
CREATE OR REPLACE FUNCTION resolve_food_ids_to_canonical(p_food_ids UUID[])
RETURNS UUID[]
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    array_agg(DISTINCT COALESCE(f.canonical_food_id, fid.food_id)),
    ARRAY[]::UUID[]
  )
  FROM unnest(p_food_ids) AS fid(food_id)
  LEFT JOIN foods f ON f.id = fid.food_id;
$$;

GRANT EXECUTE ON FUNCTION resolve_food_ids_to_canonical(UUID[]) TO anon;
GRANT EXECUTE ON FUNCTION resolve_food_ids_to_canonical(UUID[]) TO authenticated;

-- =============================================================================
-- 1c. Materialized view recipe_ingredient_summary
-- =============================================================================

-- Drop and recreate with canonical resolution
DROP MATERIALIZED VIEW IF EXISTS recipe_ingredient_summary CASCADE;

CREATE MATERIALIZED VIEW recipe_ingredient_summary AS
SELECT
  r.id AS recipe_id,
  r.name AS title,
  r.owner,
  ARRAY_AGG(DISTINCT COALESCE(f.canonical_food_id, i.food_id))
    FILTER (WHERE i.food_id IS NOT NULL) AS food_ids,
  COUNT(DISTINCT COALESCE(f.canonical_food_id, i.food_id))
    FILTER (WHERE i.food_id IS NOT NULL) AS ingredient_count
FROM recipes r
LEFT JOIN ingredients i ON i.recipe_id = r.id
LEFT JOIN foods f ON f.id = i.food_id
GROUP BY r.id, r.name, r.owner;

-- Re-create all indexes
CREATE INDEX recipe_ingredient_summary_food_ids_idx
  ON recipe_ingredient_summary USING GIN (food_ids);

CREATE INDEX recipe_ingredient_summary_recipe_id_idx
  ON recipe_ingredient_summary (recipe_id);

CREATE INDEX recipe_ingredient_summary_owner_idx
  ON recipe_ingredient_summary (owner);

CREATE UNIQUE INDEX recipe_ingredient_summary_recipe_id_key
  ON recipe_ingredient_summary (recipe_id);

GRANT SELECT ON recipe_ingredient_summary TO anon;
GRANT SELECT ON recipe_ingredient_summary TO authenticated;

-- Re-create refresh triggers on ingredients and recipes
DROP TRIGGER IF EXISTS recipe_ingredient_summary_recipe_trigger ON recipes;
CREATE TRIGGER recipe_ingredient_summary_recipe_trigger
  AFTER INSERT OR DELETE ON recipes
  FOR EACH STATEMENT
  EXECUTE FUNCTION trigger_refresh_recipe_ingredient_summary();

DROP TRIGGER IF EXISTS recipe_ingredient_summary_ingredient_trigger ON ingredients;
CREATE TRIGGER recipe_ingredient_summary_ingredient_trigger
  AFTER INSERT OR UPDATE OR DELETE ON ingredients
  FOR EACH STATEMENT
  EXECUTE FUNCTION trigger_refresh_recipe_ingredient_summary();

-- New trigger: refresh materialized view when canonical_food_id changes
CREATE OR REPLACE FUNCTION trigger_refresh_ris_on_canonical_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  -- Only refresh if canonical_food_id actually changed
  IF OLD.canonical_food_id IS DISTINCT FROM NEW.canonical_food_id THEN
    REFRESH MATERIALIZED VIEW recipe_ingredient_summary;
  END IF;
  RETURN NULL;
END;
$func$;

CREATE TRIGGER recipe_ingredient_summary_canonical_trigger
  AFTER UPDATE OF canonical_food_id ON foods
  FOR EACH ROW
  EXECUTE FUNCTION trigger_refresh_ris_on_canonical_change();

-- =============================================================================
-- 1d. View recipes_and_categories (+ dependent objects)
-- =============================================================================

-- Drop dependent objects in reverse order
DROP FUNCTION IF EXISTS search_liked_recipes(TEXT, TEXT, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS search_recipes(TEXT, TEXT, TEXT, INTEGER, INTEGER);
DROP VIEW IF EXISTS liked_recipes;
DROP VIEW IF EXISTS recipes_and_categories;

-- Re-create view with canonical resolution in pantry matching
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
  -- Pantry match stats (using canonical resolution)
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
-- Fetch current user's pantry food_ids, resolved to canonical
LEFT JOIN LATERAL (
  SELECT COALESCE(
    array_agg(DISTINCT COALESCE(f.canonical_food_id, up.food_id)),
    ARRAY[]::UUID[]
  ) AS food_ids
  FROM user_pantry up
  LEFT JOIN foods f ON f.id = up.food_id
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
        'in_pantry', ingredient.food_id IS NOT NULL
          AND COALESCE(food.canonical_food_id, ingredient.food_id) = ANY(pantry.food_ids)
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
-- Aggregate pantry match counts using canonical resolution
LEFT JOIN LATERAL (
  SELECT
    COUNT(DISTINCT COALESCE(fa.canonical_food_id, i.food_id))
      FILTER (WHERE i.food_id IS NOT NULL)::INTEGER AS total_count,
    COUNT(DISTINCT COALESCE(fa.canonical_food_id, i.food_id))
      FILTER (
        WHERE i.food_id IS NOT NULL
          AND COALESCE(fa.canonical_food_id, i.food_id) = ANY(pantry.food_ids)
      )::INTEGER AS matching_count
  FROM ingredients i
  LEFT JOIN foods fa ON fa.id = i.food_id
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

-- Re-create liked_recipes view
CREATE OR REPLACE VIEW liked_recipes AS
SELECT
  rac.*,
  rl.date_published as liked_at
FROM recipe_likes rl
INNER JOIN recipes_and_categories rac ON rac.id = rl.recipe_id
WHERE rl.user_email = current_setting('request.jwt.claims', true)::jsonb->>'email';

-- Re-create search_recipes function
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

-- Re-create search_liked_recipes function
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

-- Re-grant all permissions
GRANT SELECT ON recipes_and_categories TO anon;
GRANT SELECT ON recipes_and_categories TO authenticated;
GRANT SELECT ON liked_recipes TO authenticated;
GRANT EXECUTE ON FUNCTION search_recipes(TEXT, TEXT, TEXT, INTEGER, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION search_recipes(TEXT, TEXT, TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION search_liked_recipes(TEXT, TEXT, INTEGER, INTEGER) TO authenticated;

-- =============================================================================
-- 1e. Update matching functions
-- =============================================================================

-- find_recipes_by_ingredients: resolve p_food_ids to canonical at start
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
DECLARE
  v_canonical_ids UUID[];
BEGIN
  -- Guard against NULL or empty input
  IF p_food_ids IS NULL OR array_length(p_food_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  -- Resolve input food_ids to canonical
  v_canonical_ids := resolve_food_ids_to_canonical(p_food_ids);

  IF v_canonical_ids IS NULL OR array_length(v_canonical_ids, 1) IS NULL THEN
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
      -- Count matching ingredients (both sides are canonical)
      (
        SELECT COUNT(*)::INTEGER
        FROM unnest(ris.food_ids) AS f(food_id)
        WHERE f.food_id = ANY(v_canonical_ids)
      ) AS matching_ings
    FROM recipe_ingredient_summary ris
    WHERE ris.ingredient_count > 0
      AND (p_user_email IS NULL OR ris.owner = p_user_email)
      -- GIN index filter: recipe must have at least one matching canonical ingredient
      AND ris.food_ids && v_canonical_ids
  ),
  -- Step 2: Calculate percentages and filter by minimum
  filtered AS (
    SELECT
      ms.*,
      (ms.matching_ings * 100 / ms.total_ings)::INTEGER AS match_pct,
      ARRAY(SELECT unnest(ms.food_ids) EXCEPT SELECT unnest(v_canonical_ids)) AS missing_ids
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

-- get_recipes_with_pantry_match: resolve p_food_ids to canonical
CREATE OR REPLACE FUNCTION get_recipes_with_pantry_match(
  p_food_ids UUID[],
  p_owner TEXT DEFAULT NULL,
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
  categories TEXT[],
  ingredients JSONB,
  instructions JSONB,
  is_liked BOOLEAN,
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
  v_canonical_ids UUID[];
BEGIN
  v_has_pantry := p_food_ids IS NOT NULL AND array_length(p_food_ids, 1) > 0;

  -- Resolve to canonical if pantry has items
  IF v_has_pantry THEN
    v_canonical_ids := resolve_food_ids_to_canonical(p_food_ids);
    v_has_pantry := v_canonical_ids IS NOT NULL AND array_length(v_canonical_ids, 1) > 0;
  END IF;

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
    -- Match data: only computed if user has pantry items (using canonical)
    CASE WHEN v_has_pantry THEN ris.ingredient_count::INTEGER ELSE NULL END AS total_ingredients,
    CASE WHEN v_has_pantry THEN
      COALESCE(
        (SELECT COUNT(*)::INTEGER FROM unnest(ris.food_ids) AS f WHERE f = ANY(v_canonical_ids)),
        0
      )
    ELSE NULL END AS matching_ingredients,
    CASE WHEN v_has_pantry AND ris.ingredient_count > 0 THEN
      (
        (SELECT COUNT(*)::INTEGER FROM unnest(ris.food_ids) AS f WHERE f = ANY(v_canonical_ids))
        * 100 / ris.ingredient_count
      )::INTEGER
    ELSE NULL END AS match_percentage,
    CASE WHEN v_has_pantry THEN
      COALESCE(
        (
          SELECT array_agg(f.name ORDER BY f.name)
          FROM unnest(
            ARRAY(SELECT unnest(ris.food_ids) EXCEPT SELECT unnest(v_canonical_ids))
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

-- get_recipe_match_stats: resolve p_food_ids to canonical
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
DECLARE
  v_canonical_ids UUID[];
BEGIN
  -- Guard against NULL or empty food_ids
  IF p_food_ids IS NULL OR array_length(p_food_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  -- Resolve to canonical
  v_canonical_ids := resolve_food_ids_to_canonical(p_food_ids);

  IF v_canonical_ids IS NULL OR array_length(v_canonical_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH stats AS (
    SELECT
      ris.recipe_id,
      ris.ingredient_count::INTEGER AS total_ings,
      ris.food_ids,
      COALESCE(
        (SELECT COUNT(*)::INTEGER FROM unnest(ris.food_ids) AS f WHERE f = ANY(v_canonical_ids)),
        0
      ) AS matching_ings,
      COALESCE(
        ARRAY(SELECT unnest(ris.food_ids) EXCEPT SELECT unnest(v_canonical_ids)),
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

-- =============================================================================
-- 1f. Update shopping list merging
-- =============================================================================

CREATE OR REPLACE FUNCTION add_recipe_to_shopping_list(
  p_recipe_id UUID,
  p_shopping_list_id UUID DEFAULT NULL,
  p_servings INTEGER DEFAULT NULL,
  p_ingredient_ids UUID[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user_email TEXT;
  v_home_id UUID;
  v_list_id UUID;
  v_recipe_name TEXT;
  v_recipe_yield INTEGER;
  v_scale_factor NUMERIC;
  v_added_count INTEGER := 0;
  v_ingredient RECORD;
  v_existing_item_id UUID;
  v_new_item_id UUID;
  v_ingredient_quantity NUMERIC;
  v_scaled_quantity NUMERIC;
  v_canonical_food_id UUID;
BEGIN
  -- Get current user email from JWT
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  -- Get user's home_id
  SELECT home_id INTO v_home_id
  FROM users
  WHERE email = v_user_email;

  IF v_home_id IS NULL THEN
    RAISE EXCEPTION 'user-has-no-home';
  END IF;

  -- Get recipe details
  SELECT name, recipe_yield INTO v_recipe_name, v_recipe_yield
  FROM recipes
  WHERE id = p_recipe_id;

  IF v_recipe_name IS NULL THEN
    RAISE EXCEPTION 'recipe-not-found';
  END IF;

  -- Get or create shopping list
  IF p_shopping_list_id IS NOT NULL THEN
    -- Verify the list exists and belongs to the home
    SELECT id INTO v_list_id
    FROM shopping_lists
    WHERE id = p_shopping_list_id AND home_id = v_home_id;

    IF v_list_id IS NULL THEN
      RAISE EXCEPTION 'shopping-list-not-found';
    END IF;
  ELSE
    v_list_id := get_or_create_default_shopping_list();
  END IF;

  -- Calculate scale factor
  IF p_servings IS NOT NULL AND v_recipe_yield IS NOT NULL AND v_recipe_yield > 0 THEN
    v_scale_factor := p_servings::NUMERIC / v_recipe_yield::NUMERIC;
  ELSE
    v_scale_factor := 1.0;
  END IF;

  -- Process each ingredient
  FOR v_ingredient IN
    SELECT
      i.id,
      i.name,
      i.measurement,
      i.quantity,
      i.food_id,
      i.unit_id
    FROM ingredients i
    WHERE i.recipe_id = p_recipe_id
      AND (p_ingredient_ids IS NULL OR i.id = ANY(p_ingredient_ids))
  LOOP
    -- Parse quantity
    BEGIN
      v_ingredient_quantity := v_ingredient.quantity::NUMERIC;
    EXCEPTION WHEN OTHERS THEN
      v_ingredient_quantity := 1;
    END;

    v_scaled_quantity := v_ingredient_quantity * v_scale_factor;

    -- Resolve ingredient food_id to canonical for merge check
    IF v_ingredient.food_id IS NOT NULL THEN
      v_canonical_food_id := resolve_canonical(v_ingredient.food_id);

      -- Check for existing unchecked item with same canonical food_id AND unit_id
      SELECT sli.id INTO v_existing_item_id
      FROM shopping_list_items sli
      LEFT JOIN foods f ON f.id = sli.food_id
      WHERE sli.shopping_list_id = v_list_id
        AND COALESCE(f.canonical_food_id, sli.food_id) = v_canonical_food_id
        AND sli.unit_id IS NOT DISTINCT FROM v_ingredient.unit_id
        AND sli.is_checked = false;
    ELSE
      v_existing_item_id := NULL;
    END IF;

    IF v_existing_item_id IS NOT NULL THEN
      -- Add quantity to existing item
      UPDATE shopping_list_items
      SET quantity = quantity + v_scaled_quantity
      WHERE id = v_existing_item_id;

      v_new_item_id := v_existing_item_id;
    ELSE
      -- Insert new item
      INSERT INTO shopping_list_items (
        shopping_list_id,
        home_id,
        food_id,
        unit_id,
        display_name,
        display_unit,
        quantity,
        user_email,
        sort_order
      )
      VALUES (
        v_list_id,
        v_home_id,
        v_ingredient.food_id,
        v_ingredient.unit_id,
        v_ingredient.name,
        COALESCE(v_ingredient.measurement, ''),
        v_scaled_quantity,
        v_user_email,
        (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM shopping_list_items WHERE shopping_list_id = v_list_id)
      )
      RETURNING id INTO v_new_item_id;
    END IF;

    -- Insert source tracking record
    INSERT INTO shopping_list_item_sources (
      shopping_list_item_id,
      recipe_id,
      recipe_name,
      quantity_added,
      servings_used,
      user_email
    )
    VALUES (
      v_new_item_id,
      p_recipe_id,
      v_recipe_name,
      v_scaled_quantity,
      p_servings,
      v_user_email
    );

    v_added_count := v_added_count + 1;
  END LOOP;

  -- Update shopping list modified timestamp
  UPDATE shopping_lists SET date_modified = now() WHERE id = v_list_id;

  RETURN jsonb_build_object(
    'added_count', v_added_count,
    'list_id', v_list_id
  );
END;
$func$;

-- =============================================================================
-- 1g. Update search_foods
-- =============================================================================

-- Drop and re-create with canonical columns
DROP FUNCTION IF EXISTS search_foods(TEXT, INTEGER);

CREATE OR REPLACE FUNCTION search_foods(
  p_query TEXT,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  rank REAL,
  status food_status,
  is_own_pending BOOLEAN,
  canonical_food_id UUID,
  canonical_food_name TEXT
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $func$
DECLARE
  v_sanitized_query TEXT;
  v_tsquery tsquery;
BEGIN
  -- Handle NULL, empty, or whitespace-only queries
  IF p_query IS NULL OR trim(p_query) = '' THEN
    RETURN;
  END IF;

  v_sanitized_query := left(trim(p_query), 200);
  v_sanitized_query := replace(v_sanitized_query, '\', '\\');
  v_sanitized_query := replace(v_sanitized_query, '%', '\%');
  v_sanitized_query := replace(v_sanitized_query, '_', '\_');

  BEGIN
    v_tsquery := plainto_tsquery('swedish'::regconfig, v_sanitized_query);
  EXCEPTION WHEN OTHERS THEN
    v_tsquery := NULL;
  END;

  -- If tsquery is empty, fall back to ILIKE-only matching
  IF v_tsquery IS NULL OR v_tsquery = ''::tsquery THEN
    RETURN QUERY
    SELECT
      f.id,
      f.name,
      0.5::REAL AS rank,
      f.status,
      f.status = 'pending' AND f.created_by = current_setting('request.jwt.claims', true)::jsonb->>'email' AS is_own_pending,
      f.canonical_food_id,
      cf.name AS canonical_food_name
    FROM foods f
    LEFT JOIN foods cf ON cf.id = f.canonical_food_id
    WHERE (
        f.status = 'approved'
        OR (f.status = 'pending' AND f.created_by = current_setting('request.jwt.claims', true)::jsonb->>'email')
      )
      AND f.name ILIKE v_sanitized_query || '%' ESCAPE '\'
    ORDER BY
      CASE WHEN f.status = 'approved' THEN 0 ELSE 1 END,
      CASE
        WHEN lower(f.name) = lower(v_sanitized_query) THEN 0
        WHEN lower(f.name) LIKE lower(v_sanitized_query) || '%' ESCAPE '\' THEN 1
        ELSE 2
      END,
      f.name
    LIMIT p_limit;
    RETURN;
  END IF;

  -- Full search with both tsquery and ILIKE
  RETURN QUERY
  SELECT
    f.id,
    f.name,
    CASE
      WHEN lower(f.name) = lower(v_sanitized_query) THEN 1.0
      WHEN lower(f.name) LIKE lower(v_sanitized_query) || '%' ESCAPE '\' THEN 0.9
      ELSE ts_rank(f.tsv, v_tsquery)
    END AS rank,
    f.status,
    f.status = 'pending' AND f.created_by = current_setting('request.jwt.claims', true)::jsonb->>'email' AS is_own_pending,
    f.canonical_food_id,
    cf.name AS canonical_food_name
  FROM foods f
  LEFT JOIN foods cf ON cf.id = f.canonical_food_id
  WHERE (
      f.status = 'approved'
      OR (f.status = 'pending' AND f.created_by = current_setting('request.jwt.claims', true)::jsonb->>'email')
    )
    AND (
      f.tsv @@ v_tsquery
      OR f.name ILIKE v_sanitized_query || '%' ESCAPE '\'
    )
  ORDER BY
    CASE WHEN f.status = 'approved' THEN 0 ELSE 1 END,
    CASE
      WHEN lower(f.name) = lower(v_sanitized_query) THEN 0
      WHEN lower(f.name) LIKE lower(v_sanitized_query) || '%' ESCAPE '\' THEN 1
      ELSE 2
    END,
    ts_rank(f.tsv, v_tsquery) DESC,
    f.name
  LIMIT p_limit;
END;
$func$;

GRANT EXECUTE ON FUNCTION search_foods(TEXT, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION search_foods(TEXT, INTEGER) TO authenticated;

-- =============================================================================
-- 1h. Admin functions
-- =============================================================================

-- Approve a pending food as an alias of an existing canonical food
CREATE OR REPLACE FUNCTION approve_food_as_alias(
  p_food_id UUID,
  p_canonical_food_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_reviewer TEXT;
  v_target_canonical UUID;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin privileges required';
  END IF;

  v_reviewer := current_setting('request.jwt.claims', true)::jsonb->>'email';

  -- Validate that the food exists
  IF NOT EXISTS (SELECT 1 FROM foods WHERE id = p_food_id) THEN
    RAISE EXCEPTION 'Food with id % not found', p_food_id;
  END IF;

  -- Validate that the canonical target exists
  IF NOT EXISTS (SELECT 1 FROM foods WHERE id = p_canonical_food_id) THEN
    RAISE EXCEPTION 'Canonical food with id % not found', p_canonical_food_id;
  END IF;

  -- Cannot alias to self
  IF p_food_id = p_canonical_food_id THEN
    RAISE EXCEPTION 'A food cannot be an alias of itself';
  END IF;

  -- Target must be canonical (not itself an alias)
  SELECT canonical_food_id INTO v_target_canonical
  FROM foods WHERE id = p_canonical_food_id;

  IF v_target_canonical IS NOT NULL THEN
    RAISE EXCEPTION 'Target food is itself an alias. Use its canonical food instead: %', v_target_canonical;
  END IF;

  -- Approve and set canonical in one operation
  UPDATE foods
  SET
    status = 'approved',
    canonical_food_id = p_canonical_food_id,
    reviewed_by = v_reviewer,
    reviewed_at = now()
  WHERE id = p_food_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Food with id % not found', p_food_id;
  END IF;
END;
$func$;

GRANT EXECUTE ON FUNCTION approve_food_as_alias(UUID, UUID) TO anon;
GRANT EXECUTE ON FUNCTION approve_food_as_alias(UUID, UUID) TO authenticated;

-- Set or clear canonical_food_id on an existing food
CREATE OR REPLACE FUNCTION set_food_canonical(
  p_food_id UUID,
  p_canonical_food_id UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin privileges required';
  END IF;

  -- Validate food exists
  IF NOT EXISTS (SELECT 1 FROM foods WHERE id = p_food_id) THEN
    RAISE EXCEPTION 'Food with id % not found', p_food_id;
  END IF;

  -- If setting (not clearing), validate target
  IF p_canonical_food_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM foods WHERE id = p_canonical_food_id) THEN
      RAISE EXCEPTION 'Canonical food with id % not found', p_canonical_food_id;
    END IF;

    IF p_food_id = p_canonical_food_id THEN
      RAISE EXCEPTION 'A food cannot be an alias of itself';
    END IF;
  END IF;

  -- The chain prevention trigger will handle validation
  UPDATE foods
  SET canonical_food_id = p_canonical_food_id
  WHERE id = p_food_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Food with id % not found', p_food_id;
  END IF;
END;
$func$;

GRANT EXECUTE ON FUNCTION set_food_canonical(UUID, UUID) TO anon;
GRANT EXECUTE ON FUNCTION set_food_canonical(UUID, UUID) TO authenticated;

-- Update admin_list_foods to return canonical info
DROP FUNCTION IF EXISTS admin_list_foods(TEXT, food_status, INT, INT);

CREATE OR REPLACE FUNCTION admin_list_foods(
  p_search TEXT DEFAULT NULL,
  p_status food_status DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  status food_status,
  created_by TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  date_published TIMESTAMPTZ,
  date_modified TIMESTAMPTZ,
  ingredient_count BIGINT,
  canonical_food_id UUID,
  canonical_food_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin privileges required';
  END IF;

  RETURN QUERY
  SELECT
    f.id,
    f.name,
    f.status,
    f.created_by,
    f.reviewed_by,
    f.reviewed_at,
    f.date_published,
    f.date_modified,
    COUNT(i.id) AS ingredient_count,
    f.canonical_food_id,
    cf.name AS canonical_food_name
  FROM foods f
  LEFT JOIN ingredients i ON i.food_id = f.id
  LEFT JOIN foods cf ON cf.id = f.canonical_food_id
  WHERE
    (p_status IS NULL OR f.status = p_status)
    AND (
      p_search IS NULL
      OR trim(p_search) = ''
      OR f.tsv @@ plainto_tsquery('swedish', p_search)
      OR f.name ILIKE '%' || escape_like_pattern(p_search) || '%'
    )
  GROUP BY f.id, f.name, f.status, f.created_by, f.reviewed_by, f.reviewed_at,
           f.date_published, f.date_modified, f.canonical_food_id, cf.name
  ORDER BY
    CASE
      WHEN p_search IS NULL OR trim(p_search) = '' THEN 0
      WHEN lower(f.name) = lower(trim(p_search)) THEN 1.0
      WHEN lower(f.name) LIKE lower(escape_like_pattern(trim(p_search))) || '%' THEN 0.9
      ELSE ts_rank(f.tsv, plainto_tsquery('swedish', p_search))
    END DESC,
    f.name
  LIMIT p_limit
  OFFSET p_offset;
END;
$func$;

GRANT EXECUTE ON FUNCTION admin_list_foods(TEXT, food_status, INT, INT) TO anon;
GRANT EXECUTE ON FUNCTION admin_list_foods(TEXT, food_status, INT, INT) TO authenticated;

-- =============================================================================
-- 1i. Seed known food alias data
-- =============================================================================
-- Sets canonical_food_id for known Swedish food synonym groups.
-- Each UPDATE is safe: if either food doesn't exist, it affects 0 rows.
-- Only sets canonical_food_id if not already set (AND canonical_food_id IS NULL).

-- Sugar: strösocker → socker
UPDATE foods SET canonical_food_id = (SELECT id FROM foods WHERE name = 'socker')
  WHERE name = 'strösocker' AND canonical_food_id IS NULL
  AND EXISTS (SELECT 1 FROM foods WHERE name = 'socker');

-- Rice: risgryn → ris
UPDATE foods SET canonical_food_id = (SELECT id FROM foods WHERE name = 'ris')
  WHERE name = 'risgryn' AND canonical_food_id IS NULL
  AND EXISTS (SELECT 1 FROM foods WHERE name = 'ris');

-- Cream: vispgrädde → grädde, matlagningsgrädde → grädde
UPDATE foods SET canonical_food_id = (SELECT id FROM foods WHERE name = 'grädde')
  WHERE name = 'vispgrädde' AND canonical_food_id IS NULL
  AND EXISTS (SELECT 1 FROM foods WHERE name = 'grädde');

UPDATE foods SET canonical_food_id = (SELECT id FROM foods WHERE name = 'grädde')
  WHERE name = 'matlagningsgrädde' AND canonical_food_id IS NULL
  AND EXISTS (SELECT 1 FROM foods WHERE name = 'grädde');

-- Cabbage: vitkål → kål
UPDATE foods SET canonical_food_id = (SELECT id FROM foods WHERE name = 'kål')
  WHERE name = 'vitkål' AND canonical_food_id IS NULL
  AND EXISTS (SELECT 1 FROM foods WHERE name = 'kål');

-- Onion: gul lök → lök
UPDATE foods SET canonical_food_id = (SELECT id FROM foods WHERE name = 'lök')
  WHERE name = 'gul lök' AND canonical_food_id IS NULL
  AND EXISTS (SELECT 1 FROM foods WHERE name = 'lök');

-- Pepper: svartpeppar → peppar, vitpeppar → peppar
UPDATE foods SET canonical_food_id = (SELECT id FROM foods WHERE name = 'peppar')
  WHERE name = 'svartpeppar' AND canonical_food_id IS NULL
  AND EXISTS (SELECT 1 FROM foods WHERE name = 'peppar');

UPDATE foods SET canonical_food_id = (SELECT id FROM foods WHERE name = 'peppar')
  WHERE name = 'vitpeppar' AND canonical_food_id IS NULL
  AND EXISTS (SELECT 1 FROM foods WHERE name = 'peppar');

-- Oil: matolja → rapsolja
UPDATE foods SET canonical_food_id = (SELECT id FROM foods WHERE name = 'rapsolja')
  WHERE name = 'matolja' AND canonical_food_id IS NULL
  AND EXISTS (SELECT 1 FROM foods WHERE name = 'rapsolja');

-- Flour: mjöl → vetemjöl
UPDATE foods SET canonical_food_id = (SELECT id FROM foods WHERE name = 'vetemjöl')
  WHERE name = 'mjöl' AND canonical_food_id IS NULL
  AND EXISTS (SELECT 1 FROM foods WHERE name = 'vetemjöl');

-- Soy sauce: sojasås → soja
UPDATE foods SET canonical_food_id = (SELECT id FROM foods WHERE name = 'soja')
  WHERE name = 'sojasås' AND canonical_food_id IS NULL
  AND EXISTS (SELECT 1 FROM foods WHERE name = 'soja');

-- Spices: kryddnejlika → nejlika
UPDATE foods SET canonical_food_id = (SELECT id FROM foods WHERE name = 'nejlika')
  WHERE name = 'kryddnejlika' AND canonical_food_id IS NULL
  AND EXISTS (SELECT 1 FROM foods WHERE name = 'nejlika');

-- Nutmeg: muskotnöt → muskot
UPDATE foods SET canonical_food_id = (SELECT id FROM foods WHERE name = 'muskot')
  WHERE name = 'muskotnöt' AND canonical_food_id IS NULL
  AND EXISTS (SELECT 1 FROM foods WHERE name = 'muskot');

-- Cumin: spiskummin → kummin
UPDATE foods SET canonical_food_id = (SELECT id FROM foods WHERE name = 'kummin')
  WHERE name = 'spiskummin' AND canonical_food_id IS NULL
  AND EXISTS (SELECT 1 FROM foods WHERE name = 'kummin');

-- Curry: currypulver → curry
UPDATE foods SET canonical_food_id = (SELECT id FROM foods WHERE name = 'curry')
  WHERE name = 'currypulver' AND canonical_food_id IS NULL
  AND EXISTS (SELECT 1 FROM foods WHERE name = 'curry');

-- Chili: chiliflingor → chili, chilipulver → chili
UPDATE foods SET canonical_food_id = (SELECT id FROM foods WHERE name = 'chili')
  WHERE name = 'chiliflingor' AND canonical_food_id IS NULL
  AND EXISTS (SELECT 1 FROM foods WHERE name = 'chili');

UPDATE foods SET canonical_food_id = (SELECT id FROM foods WHERE name = 'chili')
  WHERE name = 'chilipulver' AND canonical_food_id IS NULL
  AND EXISTS (SELECT 1 FROM foods WHERE name = 'chili');

-- =============================================================================
-- 1j. Chain prevention trigger (after seed data to avoid overhead during migration)
-- =============================================================================

CREATE TRIGGER foods_no_alias_chain
  BEFORE INSERT OR UPDATE OF canonical_food_id ON foods
  FOR EACH ROW
  EXECUTE FUNCTION check_no_alias_chain();

-- =============================================================================
-- 1k. Final refresh
-- =============================================================================

REFRESH MATERIALIZED VIEW recipe_ingredient_summary;
