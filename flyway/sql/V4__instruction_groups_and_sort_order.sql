-- V4: Add instruction groups and sort order support
-- Implements grouping and ordering for recipe instructions

-- =============================================================================
-- Modify Instructions Table - Add sort_order
-- =============================================================================

ALTER TABLE instructions
  ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;

-- =============================================================================
-- Instruction Groups Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS instruction_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date_published TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  date_modified TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL CHECK (length(name) >= 1),
  sort_order INTEGER NOT NULL DEFAULT 0,
  owner TEXT NOT NULL DEFAULT current_setting('request.jwt.claims', true)::jsonb->>'email'
);

CREATE INDEX instruction_groups_recipe_id_idx ON instruction_groups (recipe_id);
CREATE INDEX instruction_groups_owner_idx ON instruction_groups (owner);

GRANT ALL ON "instruction_groups" TO "anon";

DROP TRIGGER IF EXISTS set_timestamptz ON instruction_groups;
CREATE TRIGGER set_timestamptz
    BEFORE UPDATE ON instruction_groups
    FOR EACH ROW
    EXECUTE FUNCTION set_timestamptz();

ALTER TABLE instruction_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE instruction_groups FORCE ROW LEVEL SECURITY;

CREATE POLICY instruction_groups_policy_select
  ON instruction_groups
  FOR SELECT
  USING (true);

CREATE POLICY instruction_groups_policy_insert
  ON instruction_groups
  FOR INSERT
  WITH CHECK (owner = current_setting('request.jwt.claims', true)::jsonb->>'email');

CREATE POLICY instruction_groups_policy_update
  ON instruction_groups
  FOR UPDATE
  USING (owner = current_setting('request.jwt.claims', true)::jsonb->>'email');

CREATE POLICY instruction_groups_policy_delete
  ON instruction_groups
  FOR DELETE
  USING (owner = current_setting('request.jwt.claims', true)::jsonb->>'email');

-- =============================================================================
-- Add group_id to Instructions Table
-- =============================================================================

ALTER TABLE instructions
  ADD COLUMN group_id UUID REFERENCES instruction_groups(id) ON DELETE SET NULL;

CREATE INDEX instructions_group_id_idx ON instructions (group_id);

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
        -- Regular ingredient
        INSERT INTO ingredients(recipe_id, name, measurement, quantity, group_id, sort_order)
        VALUES(new_recipe_id, ing->>'name', ing->>'measurement', ing->>'quantity', current_ingredient_group_id, ingredient_sort);
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
        -- Regular ingredient
        INSERT INTO ingredients(recipe_id, name, measurement, quantity, group_id, sort_order)
        VALUES(p_recipe_id, ing->>'name', ing->>'measurement', ing->>'quantity', current_ingredient_group_id, ingredient_sort);
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
-- Update recipes_and_categories View
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
        'name', ingredient.name,
        'measurement', ingredient.measurement,
        'quantity', ingredient.quantity,
        'group_id', ingredient.group_id,
        'sort_order', ingredient.sort_order
      ) ORDER BY ingredient.group_id NULLS FIRST, ingredient.sort_order
    ) AS ingredients,
    string_agg(ingredient.name, ' ') AS names
  FROM (
    SELECT i.* FROM ingredients i WHERE i.recipe_id = recipes.id
  ) AS ingredient
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
  FROM (
    SELECT ins.* FROM instructions ins WHERE ins.recipe_id = recipes.id
  ) AS instruction
) AS ins ON TRUE;

GRANT SELECT ON "recipes_and_categories" TO "anon";
