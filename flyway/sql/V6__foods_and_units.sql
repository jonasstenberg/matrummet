-- V6: Add foods and units tables with full-text search
-- Implements normalized food and unit data with Swedish full-text search

-- =============================================================================
-- Foods Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS foods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date_published TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  date_modified TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  name TEXT UNIQUE NOT NULL CHECK (length(name) >= 1),
  tsv tsvector GENERATED ALWAYS AS (to_tsvector('swedish'::regconfig, name)) STORED
);

CREATE INDEX foods_name_idx ON foods (name);
CREATE INDEX foods_tsv_idx ON foods USING GIN (tsv);

GRANT SELECT ON "foods" TO "anon";

DROP TRIGGER IF EXISTS set_timestamptz ON foods;
CREATE TRIGGER set_timestamptz
    BEFORE UPDATE ON foods
    FOR EACH ROW
    EXECUTE FUNCTION set_timestamptz();

ALTER TABLE foods ENABLE ROW LEVEL SECURITY;
ALTER TABLE foods FORCE ROW LEVEL SECURITY;

-- Public read-only access
CREATE POLICY foods_policy_select
  ON foods
  FOR SELECT
  USING (true);

-- No direct INSERT/UPDATE/DELETE - use get_or_create_food function
CREATE POLICY foods_policy_insert
  ON foods
  FOR INSERT
  WITH CHECK (false);

CREATE POLICY foods_policy_update
  ON foods
  FOR UPDATE
  USING (false);

CREATE POLICY foods_policy_delete
  ON foods
  FOR DELETE
  USING (false);

-- =============================================================================
-- Units Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date_published TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  date_modified TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  name TEXT UNIQUE NOT NULL,
  plural TEXT NOT NULL,
  abbreviation TEXT NOT NULL DEFAULT '',
  tsv tsvector GENERATED ALWAYS AS (
    to_tsvector('swedish'::regconfig, name || ' ' || plural || ' ' || coalesce(abbreviation, ''))
  ) STORED
);

CREATE INDEX units_name_idx ON units (name);
CREATE INDEX units_abbreviation_idx ON units (abbreviation) WHERE abbreviation != '';
CREATE INDEX units_tsv_idx ON units USING GIN (tsv);

GRANT SELECT ON "units" TO "anon";

DROP TRIGGER IF EXISTS set_timestamptz ON units;
CREATE TRIGGER set_timestamptz
    BEFORE UPDATE ON units
    FOR EACH ROW
    EXECUTE FUNCTION set_timestamptz();

ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE units FORCE ROW LEVEL SECURITY;

-- Public read-only access
CREATE POLICY units_policy_select
  ON units
  FOR SELECT
  USING (true);

-- No direct INSERT/UPDATE/DELETE - use get_or_create_unit function
CREATE POLICY units_policy_insert
  ON units
  FOR INSERT
  WITH CHECK (false);

CREATE POLICY units_policy_update
  ON units
  FOR UPDATE
  USING (false);

CREATE POLICY units_policy_delete
  ON units
  FOR DELETE
  USING (false);

-- =============================================================================
-- Alter Ingredients Table - Add Foreign Keys
-- =============================================================================

ALTER TABLE ingredients
  ADD COLUMN food_id UUID REFERENCES foods(id) ON DELETE SET NULL,
  ADD COLUMN unit_id UUID REFERENCES units(id) ON DELETE SET NULL;

CREATE INDEX ingredients_food_id_idx ON ingredients (food_id);
CREATE INDEX ingredients_unit_id_idx ON ingredients (unit_id);

-- =============================================================================
-- Get or Create Food Function
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
BEGIN
  -- Return NULL for empty/null input
  IF p_name IS NULL OR trim(p_name) = '' THEN
    RETURN NULL;
  END IF;

  v_normalized_name := trim(p_name);

  -- Case-insensitive lookup
  SELECT id INTO v_food_id
  FROM foods
  WHERE lower(name) = lower(v_normalized_name);

  IF v_food_id IS NOT NULL THEN
    RETURN v_food_id;
  END IF;

  -- Try to insert, handle race condition with ON CONFLICT
  INSERT INTO foods (name)
  VALUES (v_normalized_name)
  ON CONFLICT (name) DO NOTHING
  RETURNING id INTO v_food_id;

  -- If INSERT returned NULL due to conflict, select again
  IF v_food_id IS NULL THEN
    SELECT id INTO v_food_id
    FROM foods
    WHERE lower(name) = lower(v_normalized_name);
  END IF;

  RETURN v_food_id;
END;
$func$;

DO $$ BEGIN EXECUTE format('ALTER FUNCTION get_or_create_food(TEXT) OWNER TO %I', current_user); END $$;
GRANT EXECUTE ON FUNCTION get_or_create_food(TEXT) TO anon;

-- =============================================================================
-- Get or Create Unit Function
-- =============================================================================

CREATE OR REPLACE FUNCTION get_or_create_unit(p_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
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

  IF v_unit_id IS NOT NULL THEN
    RETURN v_unit_id;
  END IF;

  -- Try to insert with name=plural=normalized_name, abbreviation=''
  -- Handle race condition with ON CONFLICT
  INSERT INTO units (name, plural, abbreviation)
  VALUES (v_normalized_name, v_normalized_name, '')
  ON CONFLICT (name) DO NOTHING
  RETURNING id INTO v_unit_id;

  -- If INSERT returned NULL due to conflict, select again
  IF v_unit_id IS NULL THEN
    SELECT id INTO v_unit_id
    FROM units
    WHERE lower(name) = lower(v_normalized_name)
       OR lower(abbreviation) = lower(v_normalized_name);
  END IF;

  RETURN v_unit_id;
END;
$func$;

DO $$ BEGIN EXECUTE format('ALTER FUNCTION get_or_create_unit(TEXT) OWNER TO %I', current_user); END $$;
GRANT EXECUTE ON FUNCTION get_or_create_unit(TEXT) TO anon;

-- =============================================================================
-- Search Foods Function
-- =============================================================================

CREATE OR REPLACE FUNCTION search_foods(
  p_query TEXT,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  rank REAL
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
    END AS rank
  FROM foods f
  WHERE f.tsv @@ plainto_tsquery('swedish'::regconfig, p_query)
     OR f.name ILIKE trim(p_query) || '%'
  ORDER BY
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
-- Search Units Function
-- =============================================================================

CREATE OR REPLACE FUNCTION search_units(
  p_query TEXT,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  plural TEXT,
  abbreviation TEXT,
  rank REAL
)
LANGUAGE sql
STABLE
AS $func$
  SELECT
    u.id,
    u.name,
    u.plural,
    u.abbreviation,
    CASE
      WHEN lower(u.name) = lower(trim(p_query)) THEN 1.0
      WHEN lower(u.abbreviation) = lower(trim(p_query)) THEN 0.95
      WHEN lower(u.name) LIKE lower(trim(p_query)) || '%' THEN 0.9
      WHEN lower(u.abbreviation) LIKE lower(trim(p_query)) || '%' THEN 0.85
      ELSE ts_rank(u.tsv, plainto_tsquery('swedish'::regconfig, p_query))
    END AS rank
  FROM units u
  WHERE u.tsv @@ plainto_tsquery('swedish'::regconfig, p_query)
     OR u.name ILIKE trim(p_query) || '%'
     OR u.abbreviation ILIKE trim(p_query) || '%'
  ORDER BY
    CASE
      WHEN lower(u.name) = lower(trim(p_query)) THEN 0
      WHEN lower(u.abbreviation) = lower(trim(p_query)) THEN 1
      WHEN lower(u.name) LIKE lower(trim(p_query)) || '%' THEN 2
      WHEN lower(u.abbreviation) LIKE lower(trim(p_query)) || '%' THEN 3
      ELSE 4
    END,
    ts_rank(u.tsv, plainto_tsquery('swedish'::regconfig, p_query)) DESC,
    u.name
  LIMIT p_limit;
$func$;

GRANT EXECUTE ON FUNCTION search_units(TEXT, INTEGER) TO anon;

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
        v_unit_id := get_or_create_unit(ing->>'measurement');

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
        v_unit_id := get_or_create_unit(ing->>'measurement');

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
