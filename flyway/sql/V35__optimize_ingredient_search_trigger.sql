-- Optimize ingredient search_text trigger to avoid N redundant rebuilds
--
-- Problem: ingredient_search_text_trigger fires FOR EACH ROW. During
-- insert_recipe() with 20 ingredients, rebuild_recipe_search_text() runs
-- 20 times — each time re-querying ALL ingredients for the recipe.
-- During update_recipe(), DELETE + re-INSERT causes 20 DELETE triggers
-- plus 20 INSERT triggers = 40 redundant rebuilds.
--
-- Fix: Use a session variable 'app.skip_search_rebuild' as a flag.
-- insert_recipe() and update_recipe() set this flag before bulk
-- ingredient operations, then call rebuild_recipe_search_text() once.
-- The trigger checks the flag and skips when set.
-- Standalone ingredient modifications (outside these functions) work as before.

-- 1. Update trigger function to check skip flag
CREATE OR REPLACE FUNCTION public.trigger_ingredient_search_text() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  v_recipe_id UUID;
BEGIN
  -- Skip if bulk operation is in progress (insert_recipe/update_recipe handle rebuild)
  IF current_setting('app.skip_search_rebuild', true) = 'true' THEN
    RETURN NULL;
  END IF;

  v_recipe_id := COALESCE(NEW.recipe_id, OLD.recipe_id);
  PERFORM rebuild_recipe_search_text(v_recipe_id);
  RETURN NULL;
END;
$$;

-- 2. Update insert_recipe() to skip per-row triggers and rebuild once
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
      IF cat_id IS NOT NULL THEN
        INSERT INTO recipe_categories(recipe, category) VALUES(new_recipe_id, cat_id);
      END IF;
    END LOOP;
  END IF;

  -- Skip per-row search_text trigger during bulk ingredient insert
  PERFORM set_config('app.skip_search_rebuild', 'true', true);

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

  -- Clear skip flag and rebuild search_text once
  PERFORM set_config('app.skip_search_rebuild', '', true);
  PERFORM rebuild_recipe_search_text(new_recipe_id);

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

  PERFORM compute_instruction_ingredient_matches(new_recipe_id);

  RETURN new_recipe_id;
END;
$$;

-- 3. Update update_recipe() to skip per-row triggers and rebuild once
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
      IF cat_id IS NOT NULL THEN
        INSERT INTO recipe_categories(recipe, category) VALUES(p_recipe_id, cat_id);
      END IF;
    END LOOP;
  END IF;

  -- Skip per-row search_text trigger during bulk ingredient delete + re-insert
  PERFORM set_config('app.skip_search_rebuild', 'true', true);

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

  -- Clear skip flag and rebuild search_text once
  PERFORM set_config('app.skip_search_rebuild', '', true);
  PERFORM rebuild_recipe_search_text(p_recipe_id);

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

  PERFORM compute_instruction_ingredient_matches(p_recipe_id);
END;
$$;
