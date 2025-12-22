-- V12: Food approval workflow with status management
-- Implements pending/approved/rejected workflow for foods with admin review
-- Prevents duplicate foods using trigram similarity matching

-- =============================================================================
-- Enable pg_trgm Extension for Similarity Matching
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =============================================================================
-- Create food_status Enum Type
-- =============================================================================

CREATE TYPE food_status AS ENUM ('pending', 'approved', 'rejected');

-- =============================================================================
-- Alter Foods Table - Add Status and Review Columns
-- =============================================================================

ALTER TABLE foods
  ADD COLUMN status food_status NOT NULL DEFAULT 'approved',
  ADD COLUMN created_by TEXT REFERENCES users(email) ON DELETE SET NULL,
  ADD COLUMN reviewed_by TEXT REFERENCES users(email) ON DELETE SET NULL,
  ADD COLUMN reviewed_at TIMESTAMPTZ;

-- Create indexes for performance
CREATE INDEX foods_status_idx ON foods (status);
CREATE INDEX foods_created_by_idx ON foods (created_by);
CREATE INDEX foods_name_trgm_idx ON foods USING GIN (name gin_trgm_ops);

-- =============================================================================
-- Update Foods RLS Policies
-- =============================================================================

-- Drop existing SELECT policy
DROP POLICY IF EXISTS foods_policy_select ON foods;

-- SELECT: Approved foods visible to all, pending only to creator OR admin
CREATE POLICY foods_policy_select
  ON foods
  FOR SELECT
  USING (
    status = 'approved'
    OR created_by = current_setting('request.jwt.claims', true)::jsonb->>'email'
    OR is_admin()
  );

-- Keep INSERT disabled - use get_or_create_food function only
-- (foods_policy_insert already exists with WITH CHECK (false))

-- UPDATE/DELETE remain admin-only (already set in V7)

-- =============================================================================
-- Update get_or_create_food Function
-- =============================================================================

CREATE OR REPLACE FUNCTION get_or_create_food(p_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_food_id UUID;
  v_normalized_name TEXT;
  v_current_user TEXT;
  v_similar_count INT;
BEGIN
  -- Return NULL for empty/null input
  IF p_name IS NULL OR trim(p_name) = '' THEN
    RETURN NULL;
  END IF;

  v_normalized_name := trim(p_name);
  v_current_user := current_setting('request.jwt.claims', true)::jsonb->>'email';

  -- First: Check for exact match in approved foods (case-insensitive)
  SELECT id INTO v_food_id
  FROM foods
  WHERE lower(name) = lower(v_normalized_name)
    AND status = 'approved';

  IF v_food_id IS NOT NULL THEN
    RETURN v_food_id;
  END IF;

  -- Second: Check if user already has a pending food with same name
  SELECT id INTO v_food_id
  FROM foods
  WHERE lower(name) = lower(v_normalized_name)
    AND status = 'pending'
    AND created_by = v_current_user;

  IF v_food_id IS NOT NULL THEN
    RETURN v_food_id;
  END IF;

  -- Third: Check for similar foods using trigram similarity > 0.7
  -- This prevents creation of duplicate/similar foods
  SELECT COUNT(*) INTO v_similar_count
  FROM foods
  WHERE similarity(name, v_normalized_name) > 0.7
    AND status = 'approved'
    AND lower(name) != lower(v_normalized_name);

  -- If similar foods found, return NULL to signal user should review existing foods
  IF v_similar_count > 0 THEN
    RETURN NULL;
  END IF;

  -- Fourth: Create new pending food
  INSERT INTO foods (name, status, created_by)
  VALUES (v_normalized_name, 'pending', v_current_user)
  ON CONFLICT (name) DO NOTHING
  RETURNING id INTO v_food_id;

  -- If INSERT returned NULL due to conflict, select again
  -- (Another user may have created it concurrently)
  IF v_food_id IS NULL THEN
    SELECT id INTO v_food_id
    FROM foods
    WHERE lower(name) = lower(v_normalized_name)
      AND (status = 'approved' OR created_by = v_current_user);
  END IF;

  RETURN v_food_id;
END;
$func$;

-- =============================================================================
-- Replace get_or_create_unit with get_unit (Lookup Only)
-- =============================================================================

DROP FUNCTION IF EXISTS get_or_create_unit(TEXT);

CREATE OR REPLACE FUNCTION get_unit(p_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $func$
DECLARE
  v_unit_id UUID;
  v_normalized_name TEXT;
BEGIN
  -- Return NULL for empty/null input
  IF p_name IS NULL OR trim(p_name) = '' THEN
    RETURN NULL;
  END IF;

  v_normalized_name := trim(p_name);

  -- Case-insensitive lookup by name OR abbreviation
  SELECT id INTO v_unit_id
  FROM units
  WHERE lower(name) = lower(v_normalized_name)
     OR lower(abbreviation) = lower(v_normalized_name);

  RETURN v_unit_id;
END;
$func$;

DO $$ BEGIN EXECUTE format('ALTER FUNCTION get_unit(TEXT) OWNER TO %I', current_user); END $$;
GRANT EXECUTE ON FUNCTION get_unit(TEXT) TO anon;

-- =============================================================================
-- Update Units RLS Policy - Admin Only INSERT
-- =============================================================================

-- Drop existing INSERT policy
DROP POLICY IF EXISTS units_policy_insert ON units;

-- INSERT: Admin only (no longer allow public creation)
CREATE POLICY units_policy_insert
  ON units
  FOR INSERT
  WITH CHECK (is_admin());

-- =============================================================================
-- Update insert_recipe Function
-- =============================================================================

CREATE OR REPLACE FUNCTION insert_recipe(
  p_name TEXT,
  p_author TEXT,
  p_url TEXT,
  p_recipe_yield INTEGER,
  p_recipe_yield_name TEXT,
  p_prep_time INTEGER,
  p_cook_time INTEGER,
  p_description TEXT,
  p_categories TEXT[],
  p_ingredients JSONB[],
  p_instructions JSONB[],
  p_cuisine TEXT DEFAULT NULL,
  p_image TEXT DEFAULT NULL,
  p_thumbnail TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  new_recipe_id UUID;
  cat TEXT;
  cat_id UUID;
  ing JSONB;
  instr JSONB;
  current_ingredient_group_id UUID;
  current_instruction_group_id UUID;
  ingredient_group_sort INTEGER := 0;
  ingredient_sort INTEGER := 0;
  instruction_group_sort INTEGER := 0;
  instruction_sort INTEGER := 0;
  v_food_id UUID;
  v_unit_id UUID;
BEGIN
  -- Insert into the recipes table
  INSERT INTO recipes(name, author, url, recipe_yield, recipe_yield_name, prep_time, cook_time, cuisine, description, image, thumbnail)
  VALUES(p_name, p_author, p_url, p_recipe_yield, p_recipe_yield_name, p_prep_time, p_cook_time, p_cuisine, p_description, p_image, p_thumbnail)
  RETURNING id INTO new_recipe_id;

  -- Handle categories
  IF p_categories IS NOT NULL THEN
    FOREACH cat IN ARRAY p_categories
    LOOP
      SELECT id INTO cat_id FROM categories WHERE categories.name = cat;
      IF cat_id IS NULL THEN
        INSERT INTO categories(name) VALUES(cat) RETURNING id INTO cat_id;
      END IF;
      INSERT INTO recipe_categories(recipe, category) VALUES(new_recipe_id, cat_id);
    END LOOP;
  END IF;

  -- Handle ingredients (with inline group markers)
  current_ingredient_group_id := NULL;
  IF p_ingredients IS NOT NULL THEN
    FOREACH ing IN ARRAY p_ingredients
    LOOP
      -- Check if this is a group marker
      IF ing ? 'group' THEN
        INSERT INTO ingredient_groups(recipe_id, name, sort_order)
        VALUES(new_recipe_id, ing->>'group', ingredient_group_sort)
        RETURNING id INTO current_ingredient_group_id;
        ingredient_group_sort := ingredient_group_sort + 1;
        ingredient_sort := 0;
      ELSE
        -- Regular ingredient - normalize food and unit
        v_food_id := get_or_create_food(ing->>'name');
        v_unit_id := get_unit(ing->>'measurement');

        INSERT INTO ingredients(recipe_id, name, measurement, quantity, group_id, sort_order, food_id, unit_id)
        VALUES(new_recipe_id, ing->>'name', ing->>'measurement', ing->>'quantity', current_ingredient_group_id, ingredient_sort, v_food_id, v_unit_id);
        ingredient_sort := ingredient_sort + 1;
      END IF;
    END LOOP;
  END IF;

  -- Handle instructions (with inline group markers)
  current_instruction_group_id := NULL;
  IF p_instructions IS NOT NULL THEN
    FOREACH instr IN ARRAY p_instructions
    LOOP
      -- Check if this is a group marker
      IF instr ? 'group' THEN
        INSERT INTO instruction_groups(recipe_id, name, sort_order)
        VALUES(new_recipe_id, instr->>'group', instruction_group_sort)
        RETURNING id INTO current_instruction_group_id;
        instruction_group_sort := instruction_group_sort + 1;
        instruction_sort := 0;
      ELSE
        -- Regular instruction
        INSERT INTO instructions(recipe_id, step, group_id, sort_order)
        VALUES(new_recipe_id, instr->>'step', current_instruction_group_id, instruction_sort);
        instruction_sort := instruction_sort + 1;
      END IF;
    END LOOP;
  END IF;

  RETURN new_recipe_id;
END;
$func$;

-- =============================================================================
-- Update update_recipe Function
-- =============================================================================

CREATE OR REPLACE FUNCTION update_recipe(
  p_recipe_id UUID,
  p_name TEXT,
  p_author TEXT,
  p_url TEXT,
  p_recipe_yield INTEGER,
  p_recipe_yield_name TEXT,
  p_prep_time INTEGER,
  p_cook_time INTEGER,
  p_description TEXT,
  p_categories TEXT[],
  p_ingredients JSONB[],
  p_instructions JSONB[],
  p_cuisine TEXT DEFAULT NULL,
  p_image TEXT DEFAULT NULL,
  p_thumbnail TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  cat TEXT;
  cat_id UUID;
  ing JSONB;
  instr JSONB;
  current_ingredient_group_id UUID;
  current_instruction_group_id UUID;
  ingredient_group_sort INTEGER := 0;
  ingredient_sort INTEGER := 0;
  instruction_group_sort INTEGER := 0;
  instruction_sort INTEGER := 0;
  v_food_id UUID;
  v_unit_id UUID;
BEGIN
  -- Update the recipes table
  UPDATE recipes SET
    name = p_name,
    author = p_author,
    url = p_url,
    recipe_yield = p_recipe_yield,
    recipe_yield_name = p_recipe_yield_name,
    prep_time = p_prep_time,
    cook_time = p_cook_time,
    cuisine = p_cuisine,
    description = p_description,
    image = p_image,
    thumbnail = p_thumbnail
  WHERE id = p_recipe_id;

  -- Handle categories: delete and recreate
  DELETE FROM recipe_categories WHERE recipe = p_recipe_id;

  IF p_categories IS NOT NULL THEN
    FOREACH cat IN ARRAY p_categories
    LOOP
      SELECT id INTO cat_id FROM categories WHERE categories.name = cat;
      IF cat_id IS NULL THEN
        INSERT INTO categories(name) VALUES(cat) RETURNING id INTO cat_id;
      END IF;
      INSERT INTO recipe_categories(recipe, category) VALUES(p_recipe_id, cat_id);
    END LOOP;
  END IF;

  -- Handle ingredients: delete groups and ingredients, then recreate
  -- (Deleting groups will cascade to set group_id to NULL, then we delete ingredients)
  DELETE FROM ingredient_groups WHERE recipe_id = p_recipe_id;
  DELETE FROM ingredients WHERE recipe_id = p_recipe_id;

  current_ingredient_group_id := NULL;
  IF p_ingredients IS NOT NULL THEN
    FOREACH ing IN ARRAY p_ingredients
    LOOP
      -- Check if this is a group marker
      IF ing ? 'group' THEN
        INSERT INTO ingredient_groups(recipe_id, name, sort_order)
        VALUES(p_recipe_id, ing->>'group', ingredient_group_sort)
        RETURNING id INTO current_ingredient_group_id;
        ingredient_group_sort := ingredient_group_sort + 1;
        ingredient_sort := 0;
      ELSE
        -- Regular ingredient - normalize food and unit
        v_food_id := get_or_create_food(ing->>'name');
        v_unit_id := get_unit(ing->>'measurement');

        INSERT INTO ingredients(recipe_id, name, measurement, quantity, group_id, sort_order, food_id, unit_id)
        VALUES(p_recipe_id, ing->>'name', ing->>'measurement', ing->>'quantity', current_ingredient_group_id, ingredient_sort, v_food_id, v_unit_id);
        ingredient_sort := ingredient_sort + 1;
      END IF;
    END LOOP;
  END IF;

  -- Handle instructions: delete groups and instructions, then recreate
  -- (Deleting groups will cascade to set group_id to NULL, then we delete instructions)
  DELETE FROM instruction_groups WHERE recipe_id = p_recipe_id;
  DELETE FROM instructions WHERE recipe_id = p_recipe_id;

  current_instruction_group_id := NULL;
  IF p_instructions IS NOT NULL THEN
    FOREACH instr IN ARRAY p_instructions
    LOOP
      -- Check if this is a group marker
      IF instr ? 'group' THEN
        INSERT INTO instruction_groups(recipe_id, name, sort_order)
        VALUES(p_recipe_id, instr->>'group', instruction_group_sort)
        RETURNING id INTO current_instruction_group_id;
        instruction_group_sort := instruction_group_sort + 1;
        instruction_sort := 0;
      ELSE
        -- Regular instruction
        INSERT INTO instructions(recipe_id, step, group_id, sort_order)
        VALUES(p_recipe_id, instr->>'step', current_instruction_group_id, instruction_sort);
        instruction_sort := instruction_sort + 1;
      END IF;
    END LOOP;
  END IF;
END;
$func$;

-- =============================================================================
-- Update search_foods Function
-- =============================================================================

-- Drop existing function due to return type change
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
  is_own_pending BOOLEAN
)
LANGUAGE sql
STABLE
AS $func$
  SELECT
    f.id,
    f.name,
    CASE
      WHEN lower(f.name) = lower(trim(p_query)) THEN 1.0
      WHEN lower(f.name) LIKE lower(trim(p_query)) || '%' THEN 0.9
      ELSE ts_rank(f.tsv, plainto_tsquery('swedish'::regconfig, p_query))
    END AS rank,
    f.status,
    f.status = 'pending' AND f.created_by = current_setting('request.jwt.claims', true)::jsonb->>'email' AS is_own_pending
  FROM foods f
  WHERE (
      -- Include approved foods for all users
      f.status = 'approved'
      -- Include user's own pending foods
      OR (f.status = 'pending' AND f.created_by = current_setting('request.jwt.claims', true)::jsonb->>'email')
    )
    AND (
      f.tsv @@ plainto_tsquery('swedish'::regconfig, p_query)
      OR f.name ILIKE trim(p_query) || '%'
    )
  ORDER BY
    -- Prioritize approved over pending
    CASE WHEN f.status = 'approved' THEN 0 ELSE 1 END,
    -- Then by relevance
    CASE
      WHEN lower(f.name) = lower(trim(p_query)) THEN 0
      WHEN lower(f.name) LIKE lower(trim(p_query)) || '%' THEN 1
      ELSE 2
    END,
    ts_rank(f.tsv, plainto_tsquery('swedish'::regconfig, p_query)) DESC,
    f.name
  LIMIT p_limit;
$func$;

GRANT EXECUTE ON FUNCTION search_foods(TEXT, INTEGER) TO anon;

-- =============================================================================
-- Admin Function: Approve Food
-- =============================================================================

CREATE OR REPLACE FUNCTION approve_food(p_food_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_reviewer TEXT;
BEGIN
  -- Check admin permission
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin privileges required';
  END IF;

  v_reviewer := current_setting('request.jwt.claims', true)::jsonb->>'email';

  -- Update food status
  UPDATE foods
  SET
    status = 'approved',
    reviewed_by = v_reviewer,
    reviewed_at = now()
  WHERE id = p_food_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Food with id % not found', p_food_id;
  END IF;
END;
$func$;

GRANT EXECUTE ON FUNCTION approve_food(UUID) TO anon;

-- =============================================================================
-- Admin Function: Reject Food
-- =============================================================================

CREATE OR REPLACE FUNCTION reject_food(p_food_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_reviewer TEXT;
BEGIN
  -- Check admin permission
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin privileges required';
  END IF;

  v_reviewer := current_setting('request.jwt.claims', true)::jsonb->>'email';

  -- Update food status
  UPDATE foods
  SET
    status = 'rejected',
    reviewed_by = v_reviewer,
    reviewed_at = now()
  WHERE id = p_food_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Food with id % not found', p_food_id;
  END IF;
END;
$func$;

GRANT EXECUTE ON FUNCTION reject_food(UUID) TO anon;

-- =============================================================================
-- Admin Function: Find Similar Foods
-- =============================================================================

CREATE OR REPLACE FUNCTION find_similar_foods(
  p_name TEXT,
  p_limit INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  status food_status,
  similarity_score REAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  -- Check admin permission
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin privileges required';
  END IF;

  -- Return similar foods using trigram similarity
  RETURN QUERY
  SELECT
    f.id,
    f.name,
    f.status,
    similarity(f.name, p_name) AS similarity_score
  FROM foods f
  WHERE similarity(f.name, p_name) > 0.3
    AND lower(f.name) != lower(trim(p_name))
  ORDER BY similarity(f.name, p_name) DESC, f.name
  LIMIT p_limit;
END;
$func$;

GRANT EXECUTE ON FUNCTION find_similar_foods(TEXT, INT) TO anon;

-- =============================================================================
-- Update admin_list_foods Function - Add Status Filter
-- =============================================================================

-- Drop existing function due to signature and return type changes
DROP FUNCTION IF EXISTS admin_list_foods(TEXT, INT, INT);

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
  ingredient_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  -- Check admin permission
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin privileges required';
  END IF;

  -- Return paginated results ordered by relevance
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
    COUNT(i.id) AS ingredient_count
  FROM foods f
  LEFT JOIN ingredients i ON i.food_id = f.id
  WHERE
    -- Status filter
    (p_status IS NULL OR f.status = p_status)
    AND (
      -- Handle NULL/empty search - return all
      p_search IS NULL
      OR trim(p_search) = ''
      -- Full-text search
      OR f.tsv @@ plainto_tsquery('swedish', p_search)
      -- Partial ILIKE match
      OR f.name ILIKE '%' || p_search || '%'
    )
  GROUP BY f.id, f.name, f.status, f.created_by, f.reviewed_by, f.reviewed_at, f.date_published, f.date_modified
  ORDER BY
    -- Relevance ranking using ts_rank
    CASE
      WHEN p_search IS NULL OR trim(p_search) = '' THEN 0
      -- Exact match (case-insensitive): highest priority
      WHEN lower(f.name) = lower(trim(p_search)) THEN 1.0
      -- Starts with search term: high priority
      WHEN lower(f.name) LIKE lower(trim(p_search)) || '%' THEN 0.9
      -- Full-text search rank
      ELSE ts_rank(f.tsv, plainto_tsquery('swedish', p_search))
    END DESC,
    f.name
  LIMIT p_limit
  OFFSET p_offset;
END;
$func$;

GRANT EXECUTE ON FUNCTION admin_list_foods(TEXT, food_status, INT, INT) TO anon;

-- =============================================================================
-- Update admin_count_foods Function - Add Status Filter
-- =============================================================================

CREATE OR REPLACE FUNCTION admin_count_foods(
  p_search TEXT DEFAULT NULL,
  p_status food_status DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_count BIGINT;
BEGIN
  -- Check admin permission
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin privileges required';
  END IF;

  -- Return total count
  SELECT COUNT(*) INTO v_count
  FROM foods f
  WHERE
    -- Status filter
    (p_status IS NULL OR f.status = p_status)
    AND (
      -- Handle NULL/empty search - return all
      p_search IS NULL
      OR trim(p_search) = ''
      -- Full-text search
      OR f.tsv @@ plainto_tsquery('swedish', p_search)
      -- Partial ILIKE match
      OR f.name ILIKE '%' || p_search || '%'
    );

  RETURN v_count;
END;
$func$;

GRANT EXECUTE ON FUNCTION admin_count_foods(TEXT, food_status) TO anon;

-- =============================================================================
-- Update recipes_and_categories View
-- Use COALESCE to prefer normalized food name over denormalized ingredient name
-- This allows admin edits to food names to automatically propagate to recipes
-- while preserving fallback to original text when food_id is NULL or rejected
-- =============================================================================

DROP VIEW IF EXISTS recipes_and_categories;

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
                        jsonb_path_query_array(rc.categories::jsonb, '$'::jsonpath),
                        ins.steps
                       )
             ) as full_tsv
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
        'measurement', COALESCE(unit.name, ingredient.measurement),
        'quantity', ingredient.quantity,
        'group_id', ingredient.group_id,
        'sort_order', ingredient.sort_order,
        'food_id', ingredient.food_id,
        'unit_id', ingredient.unit_id
      ) ORDER BY ingredient.group_id NULLS FIRST, ingredient.sort_order
    ) AS ingredients,
    string_agg(COALESCE(food.name, ingredient.name), ' ') AS names
  FROM ingredients ingredient
  LEFT JOIN foods food ON ingredient.food_id = food.id AND food.status = 'approved'
  LEFT JOIN units unit ON ingredient.unit_id = unit.id
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
      ) ORDER BY instruction.group_id NULLS FIRST, instruction.sort_order
    ) AS instructions,
    string_agg(instruction.step, ' ') AS steps
  FROM instructions instruction
  WHERE instruction.recipe_id = recipes.id
) AS ins ON TRUE;

GRANT SELECT ON "recipes_and_categories" TO "anon";
