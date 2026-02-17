-- Include category names in recipes.search_text so searching for
-- "Vegan" finds recipes with the category "Veganskt", etc.
--
-- Changes:
-- 1. rebuild_recipe_search_text() — add category names
-- 2. trigger_recipe_search_text() — add category names
-- 3. trigger_food_search_text() — add category names in inline rebuild
-- 4. New trigger on recipe_categories — rebuild search_text on category changes
-- 5. Backfill all existing recipes

-- 1. Update rebuild_recipe_search_text() to include categories
CREATE OR REPLACE FUNCTION public.rebuild_recipe_search_text(p_recipe_id uuid) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE recipes r SET
    search_text = concat_ws(' ',
      r.name,
      r.description,
      (SELECT string_agg(c.name, ' ')
       FROM recipe_categories rc
       JOIN categories c ON c.id = rc.category
       WHERE rc.recipe = p_recipe_id),
      (SELECT string_agg(COALESCE(f.name, i.name), ' ')
       FROM ingredients i
       LEFT JOIN foods f ON i.food_id = f.id AND f.status = 'approved'
       WHERE i.recipe_id = p_recipe_id),
      (SELECT string_agg(i.form, ' ')
       FROM ingredients i
       WHERE i.recipe_id = p_recipe_id AND i.form IS NOT NULL)
    )
  WHERE r.id = p_recipe_id;
END;
$$;

-- 2. Update trigger_recipe_search_text() to include categories
CREATE OR REPLACE FUNCTION public.trigger_recipe_search_text() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Build search_text inline for the NEW row
  -- Note: On INSERT, ingredients and categories don't exist yet, so only name+description are included.
  -- The ingredient trigger and category trigger will rebuild search_text when they are added.
  NEW.search_text := concat_ws(' ',
    NEW.name,
    NEW.description,
    (SELECT string_agg(c.name, ' ')
     FROM recipe_categories rc
     JOIN categories c ON c.id = rc.category
     WHERE rc.recipe = NEW.id),
    (SELECT string_agg(COALESCE(f.name, i.name), ' ')
     FROM ingredients i
     LEFT JOIN foods f ON i.food_id = f.id AND f.status = 'approved'
     WHERE i.recipe_id = NEW.id),
    (SELECT string_agg(i.form, ' ')
     FROM ingredients i
     WHERE i.recipe_id = NEW.id AND i.form IS NOT NULL)
  );
  RETURN NEW;
END;
$$;

-- 3. Update trigger_food_search_text() to include categories in inline rebuild
CREATE OR REPLACE FUNCTION public.trigger_food_search_text() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND
      (OLD.name IS DISTINCT FROM NEW.name OR OLD.status IS DISTINCT FROM NEW.status) AND
      (NEW.status = 'approved' OR OLD.status = 'approved')) THEN
    UPDATE recipes r SET
      search_text = concat_ws(' ',
        r.name,
        r.description,
        (SELECT string_agg(c.name, ' ')
         FROM recipe_categories rc
         JOIN categories c ON c.id = rc.category
         WHERE rc.recipe = r.id),
        (SELECT string_agg(COALESCE(f.name, i.name), ' ')
         FROM ingredients i
         LEFT JOIN foods f ON i.food_id = f.id AND f.status = 'approved'
         WHERE i.recipe_id = r.id),
        (SELECT string_agg(i.form, ' ')
         FROM ingredients i
         WHERE i.recipe_id = r.id AND i.form IS NOT NULL)
      )
    WHERE r.id IN (
      SELECT DISTINCT recipe_id FROM ingredients WHERE food_id = NEW.id
    );
  END IF;

  RETURN NULL;
END;
$$;

-- 4. New trigger on recipe_categories to rebuild search_text on category changes
CREATE OR REPLACE FUNCTION public.trigger_category_search_text() RETURNS trigger
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

  v_recipe_id := COALESCE(NEW.recipe, OLD.recipe);
  PERFORM rebuild_recipe_search_text(v_recipe_id);
  RETURN NULL;
END;
$$;

CREATE TRIGGER category_search_text_trigger
  AFTER INSERT OR DELETE OR UPDATE ON public.recipe_categories
  FOR EACH ROW EXECUTE FUNCTION public.trigger_category_search_text();

-- 5. Update insert_recipe() to set skip flag before categories too
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

  -- Skip per-row search_text triggers during bulk category + ingredient insert
  PERFORM set_config('app.skip_search_rebuild', 'true', true);

  IF p_categories IS NOT NULL THEN
    FOREACH cat IN ARRAY p_categories LOOP
      SELECT id INTO cat_id FROM categories WHERE categories.name = cat;
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

-- 6. Update update_recipe() to set skip flag before categories too
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

  -- Skip per-row search_text triggers during bulk category + ingredient operations
  PERFORM set_config('app.skip_search_rebuild', 'true', true);

  DELETE FROM recipe_categories WHERE recipe = p_recipe_id;
  IF p_categories IS NOT NULL THEN
    FOREACH cat IN ARRAY p_categories LOOP
      SELECT id INTO cat_id FROM categories WHERE categories.name = cat;
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

-- 7. Backfill: rebuild search_text for all existing recipes
UPDATE recipes r SET
  search_text = concat_ws(' ',
    r.name,
    r.description,
    (SELECT string_agg(c.name, ' ')
     FROM recipe_categories rc
     JOIN categories c ON c.id = rc.category
     WHERE rc.recipe = r.id),
    (SELECT string_agg(COALESCE(f.name, i.name), ' ')
     FROM ingredients i
     LEFT JOIN foods f ON i.food_id = f.id AND f.status = 'approved'
     WHERE i.recipe_id = r.id),
    (SELECT string_agg(i.form, ' ')
     FROM ingredients i
     WHERE i.recipe_id = r.id AND i.form IS NOT NULL)
  );
