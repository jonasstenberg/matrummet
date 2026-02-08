-- Migration: Predefined categories
-- Adds a fixed set of Swedish categories, remaps old categories to new ones,
-- and removes the ability to auto-create categories from insert/update_recipe.

-- =============================================================================
-- 1. Insert predefined categories (skip if already exists)
-- =============================================================================

INSERT INTO categories (name, owner) VALUES
  ('Frukost', 'system'),
  ('Lunch', 'system'),
  ('Middag', 'system'),
  ('Förrätt', 'system'),
  ('Efterrätt', 'system'),
  ('Mellanmål', 'system'),
  ('Fika', 'system'),
  ('Brunch', 'system'),
  ('Buffé', 'system'),
  ('Plockmat', 'system'),
  ('Huvudrätt', 'system'),
  ('Soppa', 'system'),
  ('Sallad', 'system'),
  ('Bakverk', 'system'),
  ('Bröd', 'system'),
  ('Dryck', 'system'),
  ('Sås & tillbehör', 'system'),
  ('Smoothie', 'system'),
  ('Svenskt', 'system'),
  ('Asiatiskt', 'system'),
  ('Italienskt', 'system'),
  ('Indiskt', 'system'),
  ('Mellanöstern', 'system'),
  ('Amerikanskt', 'system'),
  ('Franskt', 'system'),
  ('Grekiskt', 'system'),
  ('Mexikanskt', 'system'),
  ('Spanskt', 'system'),
  ('Vegetariskt', 'system'),
  ('Veganskt', 'system'),
  ('Glutenfritt', 'system'),
  ('Laktosfritt', 'system'),
  ('LCHF/Keto', 'system'),
  ('Billigt', 'system'),
  ('Snabbt', 'system'),
  ('Enkelt', 'system'),
  ('Barnvänligt', 'system'),
  ('Mealprep', 'system'),
  ('Klimatsmart', 'system'),
  ('Nyckelhålsmärkt', 'system'),
  ('Festligt', 'system'),
  ('Grillat', 'system'),
  ('Kyckling', 'system'),
  ('Nötkött', 'system'),
  ('Fläsk', 'system'),
  ('Fisk & skaldjur', 'system'),
  ('Pasta', 'system'),
  ('Ris', 'system'),
  ('Baljväxter', 'system'),
  ('Potatis', 'system'),
  ('Ägg', 'system'),
  ('Midsommar', 'system'),
  ('Jul', 'system'),
  ('Påsk', 'system'),
  ('Kräftskiva', 'system'),
  ('Sommar', 'system')
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- 2. Remap old categories to new ones
-- =============================================================================

-- Helper: remap recipe_categories from old category to new category.
-- Handles duplicates (a recipe may already have the target category).
DO $$
DECLARE
  v_old_id UUID;
  v_new_id UUID;
  v_mappings TEXT[][] := ARRAY[
    ['Fest', 'Festligt'],
    ['Högtid', 'Festligt'],
    ['Dessert', 'Efterrätt'],
    ['Bakelse', 'Bakverk'],
    ['Tillbehör', 'Sås & tillbehör'],
    ['Matbröd', 'Bröd']
  ];
  v_mapping TEXT[];
BEGIN
  FOREACH v_mapping SLICE 1 IN ARRAY v_mappings LOOP
    SELECT id INTO v_old_id FROM categories WHERE name = v_mapping[1];
    SELECT id INTO v_new_id FROM categories WHERE name = v_mapping[2];

    IF v_old_id IS NOT NULL AND v_new_id IS NOT NULL THEN
      -- Update recipe_categories, skip if the recipe already has the new category
      UPDATE recipe_categories
      SET category = v_new_id
      WHERE category = v_old_id
        AND recipe NOT IN (
          SELECT recipe FROM recipe_categories WHERE category = v_new_id
        );

      -- Delete any remaining old associations (duplicates that couldn't be updated)
      DELETE FROM recipe_categories WHERE category = v_old_id;

      -- Delete the old category
      DELETE FROM categories WHERE id = v_old_id;
    END IF;
  END LOOP;

  -- Delete Vickning (no mapping, just remove)
  SELECT id INTO v_old_id FROM categories WHERE name = 'Vickning';
  IF v_old_id IS NOT NULL THEN
    DELETE FROM recipe_categories WHERE category = v_old_id;
    DELETE FROM categories WHERE id = v_old_id;
  END IF;
END;
$$;

-- =============================================================================
-- 3. Update insert_recipe — skip unknown categories instead of creating them
-- =============================================================================

CREATE OR REPLACE FUNCTION public.insert_recipe(
  p_name text, p_author text, p_url text, p_recipe_yield integer,
  p_recipe_yield_name text, p_prep_time integer, p_cook_time integer,
  p_description text, p_categories text[], p_ingredients jsonb[],
  p_instructions jsonb[], p_cuisine text DEFAULT NULL::text,
  p_image text DEFAULT NULL::text, p_thumbnail text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current_user TEXT;
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
  v_current_user := current_setting('request.jwt.claims', true)::jsonb->>'email';
  IF v_current_user IS NULL OR v_current_user = '' THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_categories IS NOT NULL AND array_length(p_categories, 1) > 20 THEN
    RAISE EXCEPTION 'Too many categories (max 20)';
  END IF;

  IF p_ingredients IS NOT NULL AND array_length(p_ingredients, 1) > 100 THEN
    RAISE EXCEPTION 'Too many ingredients (max 100)';
  END IF;

  IF p_instructions IS NOT NULL AND array_length(p_instructions, 1) > 100 THEN
    RAISE EXCEPTION 'Too many instructions (max 100)';
  END IF;

  INSERT INTO recipes(name, author, url, recipe_yield, recipe_yield_name, prep_time, cook_time, cuisine, description, image, thumbnail)
  VALUES(p_name, p_author, p_url, p_recipe_yield, p_recipe_yield_name, p_prep_time, p_cook_time, p_cuisine, p_description, p_image, p_thumbnail)
  RETURNING id INTO new_recipe_id;

  IF p_categories IS NOT NULL THEN
    FOREACH cat IN ARRAY p_categories LOOP
      SELECT id INTO cat_id FROM categories WHERE categories.name = cat;
      -- Skip unknown categories (only predefined categories are allowed)
      IF cat_id IS NOT NULL THEN
        INSERT INTO recipe_categories(recipe, category) VALUES(new_recipe_id, cat_id);
      END IF;
    END LOOP;
  END IF;

  current_ingredient_group_id := NULL;
  IF p_ingredients IS NOT NULL THEN
    FOREACH ing IN ARRAY p_ingredients LOOP
      IF ing ? 'group' THEN
        INSERT INTO ingredient_groups(recipe_id, name, sort_order)
        VALUES(new_recipe_id, ing->>'group', ingredient_group_sort)
        RETURNING id INTO current_ingredient_group_id;
        ingredient_group_sort := ingredient_group_sort + 1;
        ingredient_sort := 0;
      ELSE
        v_food_id := get_or_create_food(ing->>'name');
        v_unit_id := get_unit(ing->>'measurement');
        INSERT INTO ingredients(recipe_id, name, measurement, quantity, form, group_id, sort_order, food_id, unit_id)
        VALUES(new_recipe_id, ing->>'name', ing->>'measurement', ing->>'quantity', ing->>'form', current_ingredient_group_id, ingredient_sort, v_food_id, v_unit_id);
        ingredient_sort := ingredient_sort + 1;
      END IF;
    END LOOP;
  END IF;

  current_instruction_group_id := NULL;
  IF p_instructions IS NOT NULL THEN
    FOREACH instr IN ARRAY p_instructions LOOP
      IF instr ? 'group' THEN
        INSERT INTO instruction_groups(recipe_id, name, sort_order)
        VALUES(new_recipe_id, instr->>'group', instruction_group_sort)
        RETURNING id INTO current_instruction_group_id;
        instruction_group_sort := instruction_group_sort + 1;
        instruction_sort := 0;
      ELSE
        INSERT INTO instructions(recipe_id, step, group_id, sort_order)
        VALUES(new_recipe_id, instr->>'step', current_instruction_group_id, instruction_sort);
        instruction_sort := instruction_sort + 1;
      END IF;
    END LOOP;
  END IF;

  -- Compute instruction-ingredient matches for the new recipe
  PERFORM compute_instruction_ingredient_matches(new_recipe_id);

  RETURN new_recipe_id;
END;
$$;

-- =============================================================================
-- 4. Update update_recipe — skip unknown categories instead of creating them
-- =============================================================================

CREATE OR REPLACE FUNCTION public.update_recipe(
  p_recipe_id uuid, p_name text, p_author text, p_url text,
  p_recipe_yield integer, p_recipe_yield_name text, p_prep_time integer,
  p_cook_time integer, p_description text, p_categories text[],
  p_ingredients jsonb[], p_instructions jsonb[],
  p_cuisine text DEFAULT NULL::text, p_image text DEFAULT NULL::text,
  p_thumbnail text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current_user TEXT;
  v_recipe_owner TEXT;
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
  v_current_user := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_current_user IS NULL OR v_current_user = '' THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT owner INTO v_recipe_owner FROM recipes WHERE id = p_recipe_id;

  IF v_recipe_owner IS NULL THEN
    RAISE EXCEPTION 'Recipe not found';
  END IF;

  IF v_recipe_owner != v_current_user THEN
    RAISE EXCEPTION 'Access denied: you do not own this recipe';
  END IF;

  IF p_categories IS NOT NULL AND array_length(p_categories, 1) > 20 THEN
    RAISE EXCEPTION 'Too many categories (max 20)';
  END IF;

  IF p_ingredients IS NOT NULL AND array_length(p_ingredients, 1) > 100 THEN
    RAISE EXCEPTION 'Too many ingredients (max 100)';
  END IF;

  IF p_instructions IS NOT NULL AND array_length(p_instructions, 1) > 100 THEN
    RAISE EXCEPTION 'Too many instructions (max 100)';
  END IF;

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

  DELETE FROM recipe_categories WHERE recipe = p_recipe_id;
  IF p_categories IS NOT NULL THEN
    FOREACH cat IN ARRAY p_categories LOOP
      SELECT id INTO cat_id FROM categories WHERE categories.name = cat;
      -- Skip unknown categories (only predefined categories are allowed)
      IF cat_id IS NOT NULL THEN
        INSERT INTO recipe_categories(recipe, category) VALUES(p_recipe_id, cat_id);
      END IF;
    END LOOP;
  END IF;

  DELETE FROM ingredient_groups WHERE recipe_id = p_recipe_id;
  DELETE FROM ingredients WHERE recipe_id = p_recipe_id;

  current_ingredient_group_id := NULL;
  IF p_ingredients IS NOT NULL THEN
    FOREACH ing IN ARRAY p_ingredients LOOP
      IF ing ? 'group' THEN
        INSERT INTO ingredient_groups(recipe_id, name, sort_order)
        VALUES(p_recipe_id, ing->>'group', ingredient_group_sort)
        RETURNING id INTO current_ingredient_group_id;
        ingredient_group_sort := ingredient_group_sort + 1;
        ingredient_sort := 0;
      ELSE
        v_food_id := get_or_create_food(ing->>'name');
        v_unit_id := get_unit(ing->>'measurement');
        INSERT INTO ingredients(recipe_id, name, measurement, quantity, form, group_id, sort_order, food_id, unit_id)
        VALUES(p_recipe_id, ing->>'name', ing->>'measurement', ing->>'quantity', ing->>'form', current_ingredient_group_id, ingredient_sort, v_food_id, v_unit_id);
        ingredient_sort := ingredient_sort + 1;
      END IF;
    END LOOP;
  END IF;

  DELETE FROM instruction_groups WHERE recipe_id = p_recipe_id;
  DELETE FROM instructions WHERE recipe_id = p_recipe_id;

  current_instruction_group_id := NULL;
  IF p_instructions IS NOT NULL THEN
    FOREACH instr IN ARRAY p_instructions LOOP
      IF instr ? 'group' THEN
        INSERT INTO instruction_groups(recipe_id, name, sort_order)
        VALUES(p_recipe_id, instr->>'group', instruction_group_sort)
        RETURNING id INTO current_instruction_group_id;
        instruction_group_sort := instruction_group_sort + 1;
        instruction_sort := 0;
      ELSE
        INSERT INTO instructions(recipe_id, step, group_id, sort_order)
        VALUES(p_recipe_id, instr->>'step', current_instruction_group_id, instruction_sort);
        instruction_sort := instruction_sort + 1;
      END IF;
    END LOOP;
  END IF;

  -- Compute instruction-ingredient matches for the updated recipe
  PERFORM compute_instruction_ingredient_matches(p_recipe_id);
END;
$$;
