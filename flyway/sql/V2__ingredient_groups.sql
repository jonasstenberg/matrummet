-- V2: Add ingredient groups support
-- Moves from "#" prefix convention to proper database structure

-- =============================================================================
-- Ingredient Groups Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS ingredient_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date_published TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  date_modified TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL CHECK (length(name) >= 1),
  sort_order INTEGER NOT NULL DEFAULT 0,
  owner TEXT NOT NULL DEFAULT current_setting('request.jwt.claims', true)::jsonb->>'email'
);

CREATE INDEX ingredient_groups_recipe_id_idx ON ingredient_groups (recipe_id);
CREATE INDEX ingredient_groups_owner_idx ON ingredient_groups (owner);

GRANT ALL ON "ingredient_groups" TO "anon";

DROP TRIGGER IF EXISTS set_timestamptz ON ingredient_groups;
CREATE TRIGGER set_timestamptz
    BEFORE UPDATE ON ingredient_groups
    FOR EACH ROW
    EXECUTE FUNCTION set_timestamptz();

ALTER TABLE ingredient_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredient_groups FORCE ROW LEVEL SECURITY;

CREATE POLICY ingredient_groups_policy_select
  ON ingredient_groups
  FOR SELECT
  USING (true);

CREATE POLICY ingredient_groups_policy_insert
  ON ingredient_groups
  FOR INSERT
  WITH CHECK (owner = current_setting('request.jwt.claims', true)::jsonb->>'email');

CREATE POLICY ingredient_groups_policy_update
  ON ingredient_groups
  FOR UPDATE
  USING (owner = current_setting('request.jwt.claims', true)::jsonb->>'email');

CREATE POLICY ingredient_groups_policy_delete
  ON ingredient_groups
  FOR DELETE
  USING (owner = current_setting('request.jwt.claims', true)::jsonb->>'email');

-- =============================================================================
-- Modify Ingredients Table
-- =============================================================================

ALTER TABLE ingredients
  ADD COLUMN group_id UUID REFERENCES ingredient_groups(id) ON DELETE SET NULL,
  ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;

CREATE INDEX ingredients_group_id_idx ON ingredients (group_id);

-- =============================================================================
-- Migrate Existing Data
-- =============================================================================

DO $$
DECLARE
  rec RECORD;
  current_group_id UUID;
  current_recipe_id UUID;
  group_sort INTEGER;
  ingredient_sort INTEGER;
BEGIN
  current_recipe_id := NULL;
  current_group_id := NULL;
  group_sort := 0;
  ingredient_sort := 0;

  -- Process ingredients ordered by recipe and date_published to maintain order
  FOR rec IN
    SELECT id, recipe_id, name, owner, date_published
    FROM ingredients
    ORDER BY recipe_id, date_published
  LOOP
    -- Reset counters when recipe changes
    IF current_recipe_id IS NULL OR current_recipe_id <> rec.recipe_id THEN
      current_recipe_id := rec.recipe_id;
      current_group_id := NULL;
      group_sort := 0;
      ingredient_sort := 0;
    END IF;

    -- Check if this is a group header (starts with #)
    IF rec.name LIKE '#%' THEN
      -- Create new group
      INSERT INTO ingredient_groups (recipe_id, name, sort_order, owner)
      VALUES (
        rec.recipe_id,
        TRIM(SUBSTRING(rec.name FROM 2)),  -- Remove # prefix and trim
        group_sort,
        rec.owner
      )
      RETURNING id INTO current_group_id;

      group_sort := group_sort + 1;
      ingredient_sort := 0;

      -- Delete the placeholder ingredient row
      DELETE FROM ingredients WHERE id = rec.id;
    ELSE
      -- Regular ingredient - assign to current group and set sort order
      UPDATE ingredients
      SET group_id = current_group_id, sort_order = ingredient_sort
      WHERE id = rec.id;

      ingredient_sort := ingredient_sort + 1;
    END IF;
  END LOOP;
END $$;

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
RETURNS UUID LANGUAGE plpgsql AS $func$
DECLARE
  new_recipe_id UUID;
  cat TEXT;
  cat_id UUID;
  ing JSONB;
  instr JSONB;
  current_group_id UUID;
  group_sort INTEGER := 0;
  ingredient_sort INTEGER := 0;
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
  current_group_id := NULL;
  IF p_ingredients IS NOT NULL THEN
    FOREACH ing IN ARRAY p_ingredients
    LOOP
      -- Check if this is a group marker
      IF ing ? 'group' THEN
        INSERT INTO ingredient_groups(recipe_id, name, sort_order)
        VALUES(new_recipe_id, ing->>'group', group_sort)
        RETURNING id INTO current_group_id;
        group_sort := group_sort + 1;
        ingredient_sort := 0;
      ELSE
        -- Regular ingredient
        INSERT INTO ingredients(recipe_id, name, measurement, quantity, group_id, sort_order)
        VALUES(new_recipe_id, ing->>'name', ing->>'measurement', ing->>'quantity', current_group_id, ingredient_sort);
        ingredient_sort := ingredient_sort + 1;
      END IF;
    END LOOP;
  END IF;

  -- Handle instructions
  IF p_instructions IS NOT NULL THEN
    FOREACH instr IN ARRAY p_instructions
    LOOP
      INSERT INTO instructions(recipe_id, step)
      VALUES(new_recipe_id, instr->>'step');
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
RETURNS void LANGUAGE plpgsql AS $func$
DECLARE
  cat TEXT;
  cat_id UUID;
  ing JSONB;
  instr JSONB;
  current_group_id UUID;
  group_sort INTEGER := 0;
  ingredient_sort INTEGER := 0;
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

  current_group_id := NULL;
  IF p_ingredients IS NOT NULL THEN
    FOREACH ing IN ARRAY p_ingredients
    LOOP
      -- Check if this is a group marker
      IF ing ? 'group' THEN
        INSERT INTO ingredient_groups(recipe_id, name, sort_order)
        VALUES(p_recipe_id, ing->>'group', group_sort)
        RETURNING id INTO current_group_id;
        group_sort := group_sort + 1;
        ingredient_sort := 0;
      ELSE
        -- Regular ingredient
        INSERT INTO ingredients(recipe_id, name, measurement, quantity, group_id, sort_order)
        VALUES(p_recipe_id, ing->>'name', ing->>'measurement', ing->>'quantity', current_group_id, ingredient_sort);
        ingredient_sort := ingredient_sort + 1;
      END IF;
    END LOOP;
  END IF;

  -- Handle instructions: delete and recreate
  DELETE FROM instructions WHERE recipe_id = p_recipe_id;

  IF p_instructions IS NOT NULL THEN
    FOREACH instr IN ARRAY p_instructions
    LOOP
      INSERT INTO instructions(recipe_id, step)
      VALUES(p_recipe_id, instr->>'step');
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
  grp.ingredient_groups,
  ing.ingredients,
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
) AS grp ON TRUE
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
  SELECT
    jsonb_agg(instruction.*) AS instructions,
    string_agg(instruction.step, ' ') AS steps
  FROM (
    SELECT instructions.* FROM instructions WHERE instructions.recipe_id = recipes.id
  ) AS instruction
) AS ins ON TRUE;

GRANT SELECT ON "recipes_and_categories" TO "anon";
