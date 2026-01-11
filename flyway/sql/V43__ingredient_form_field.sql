-- V43: Add form field to ingredients table
--
-- The form field stores the form/cut/preparation of an ingredient:
-- - "klyftor" (cloves) for garlic
-- - "zest" for lemon
-- - "strimlad" (shredded) for cabbage
-- - "tärnad" (diced) for onion
--
-- This is nullable since not all ingredients need a form specified.

-- =============================================================================
-- 1. Add form column to ingredients table
-- =============================================================================

ALTER TABLE ingredients
  ADD COLUMN form TEXT;

-- =============================================================================
-- 2. Drop dependent objects in correct order
-- =============================================================================

-- Drop functions that depend on recipes_and_categories type
DROP FUNCTION IF EXISTS search_recipes(TEXT, TEXT, TEXT, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS search_liked_recipes(TEXT, TEXT, INTEGER, INTEGER);

-- Drop views in dependency order
DROP VIEW IF EXISTS liked_recipes;
DROP VIEW IF EXISTS recipes_and_categories;

-- =============================================================================
-- 3. Recreate recipes_and_categories view with form field and search support
-- =============================================================================

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
                        ing.forms,  -- Include ingredient forms in full-text search
                        jsonb_path_query_array(rc.categories::jsonb, '$'::jsonpath),
                        ins.steps
                       )
             ) as full_tsv,
  -- Check if current user has liked this recipe
  EXISTS (
    SELECT 1 FROM recipe_likes
    WHERE recipe_likes.recipe_id = recipes.id
    AND recipe_likes.user_email = current_setting('request.jwt.claims', true)::jsonb->>'email'
  ) AS is_liked
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
        'unit_id', ingredient.unit_id
      ) ORDER BY ingredient.group_id NULLS FIRST, ingredient.sort_order
    ) AS ingredients,
    string_agg(COALESCE(food.name, ingredient.name), ' ') AS names,
    string_agg(ingredient.form, ' ') FILTER (WHERE ingredient.form IS NOT NULL) AS forms
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

-- =============================================================================
-- 4. Recreate liked_recipes view (depends on recipes_and_categories)
-- =============================================================================

CREATE OR REPLACE VIEW liked_recipes AS
SELECT
  rac.*,
  rl.date_published as liked_at
FROM recipe_likes rl
INNER JOIN recipes_and_categories rac ON rac.id = rl.recipe_id
WHERE rl.user_email = current_setting('request.jwt.claims', true)::jsonb->>'email';

GRANT SELECT ON liked_recipes TO "anon";

-- =============================================================================
-- 5. Recreate search_recipes function (depends on recipes_and_categories type)
-- =============================================================================

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
SET search_path = public
AS $$
  SELECT rac.*
  FROM recipes_and_categories rac
  JOIN recipes r ON r.id = rac.id
  WHERE
    -- Guard against NULL/empty query
    COALESCE(trim(p_query), '') != ''
    -- Trigram ILIKE uses GIN index for large tables
    -- escape_like_pattern prevents %, _, \ from being interpreted as wildcards
    AND r.search_text ILIKE '%' || escape_like_pattern(p_query) || '%'
    -- Optional filters
    AND (p_owner IS NULL OR rac.owner = p_owner)
    AND (p_category IS NULL OR p_category = ANY(rac.categories))
  ORDER BY
    -- Priority 1: Exact name match
    CASE WHEN rac.name ILIKE escape_like_pattern(p_query) THEN 0
    -- Priority 2: Name starts with query
         WHEN rac.name ILIKE escape_like_pattern(p_query) || '%' THEN 1
    -- Priority 3: Name contains query
         WHEN rac.name ILIKE '%' || escape_like_pattern(p_query) || '%' THEN 2
    -- Priority 4: Match in description/ingredients
         ELSE 3
    END,
    -- Secondary: word_similarity for better substring ranking
    -- word_similarity('lamm', 'Lammlåda') = 0.8 vs similarity = 0.18
    word_similarity(p_query, rac.name) DESC,
    -- Tertiary: newest first
    rac.date_published DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;

GRANT EXECUTE ON FUNCTION search_recipes(TEXT, TEXT, TEXT, INTEGER, INTEGER) TO "anon";

COMMENT ON FUNCTION search_recipes IS
  'Substring search for recipes using pg_trgm. Finds "sås" in "vaniljsås".
   Uses GIN trigram index for fast ILIKE matching at scale.
   Results ranked by: exact match > prefix > contains > word_similarity.
   Returns empty result set if query is NULL or empty.';

-- =============================================================================
-- 6. Recreate search_liked_recipes function
-- =============================================================================

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
  liked_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT lr.*
  FROM liked_recipes lr
  JOIN recipes r ON r.id = lr.id
  WHERE
    -- Guard against NULL/empty query
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

GRANT EXECUTE ON FUNCTION search_liked_recipes(TEXT, TEXT, INTEGER, INTEGER) TO "anon";

-- =============================================================================
-- 7. Update insert_recipe function to handle form field
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
  v_new_category_count INTEGER := 0;
  v_is_rate_limited BOOLEAN;
BEGIN
  -- SECURITY FIX: Verify caller is authenticated
  v_current_user := current_setting('request.jwt.claims', true)::jsonb->>'email';
  IF v_current_user IS NULL OR v_current_user = '' THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- SECURITY FIX: Validate array sizes to prevent DoS
  IF p_categories IS NOT NULL AND array_length(p_categories, 1) > 20 THEN
    RAISE EXCEPTION 'Too many categories (max 20)';
  END IF;

  IF p_ingredients IS NOT NULL AND array_length(p_ingredients, 1) > 100 THEN
    RAISE EXCEPTION 'Too many ingredients (max 100)';
  END IF;

  IF p_instructions IS NOT NULL AND array_length(p_instructions, 1) > 100 THEN
    RAISE EXCEPTION 'Too many instructions (max 100)';
  END IF;

  -- Insert into the recipes table
  INSERT INTO recipes(name, author, url, recipe_yield, recipe_yield_name, prep_time, cook_time, cuisine, description, image, thumbnail)
  VALUES(p_name, p_author, p_url, p_recipe_yield, p_recipe_yield_name, p_prep_time, p_cook_time, p_cuisine, p_description, p_image, p_thumbnail)
  RETURNING id INTO new_recipe_id;

  -- Handle categories with rate limiting for new category creation
  IF p_categories IS NOT NULL THEN
    -- Check rate limit before processing categories
    v_is_rate_limited := check_rate_limit(v_current_user, 'category_creation', 10, 60, 60);

    FOREACH cat IN ARRAY p_categories
    LOOP
      SELECT id INTO cat_id FROM categories WHERE categories.name = cat;
      IF cat_id IS NULL THEN
        -- New category - check rate limit
        IF v_is_rate_limited THEN
          RAISE EXCEPTION 'Too many new categories created. Please wait before creating more.';
        END IF;

        INSERT INTO categories(name) VALUES(cat) RETURNING id INTO cat_id;
        v_new_category_count := v_new_category_count + 1;

        -- Record each new category creation for rate limiting
        PERFORM record_failed_attempt(v_current_user, 'category_creation', 60);
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

        INSERT INTO ingredients(recipe_id, name, measurement, quantity, form, group_id, sort_order, food_id, unit_id)
        VALUES(new_recipe_id, ing->>'name', ing->>'measurement', ing->>'quantity', ing->>'form', current_ingredient_group_id, ingredient_sort, v_food_id, v_unit_id);
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
-- 8. Update update_recipe function to handle form field
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
  v_new_category_count INTEGER := 0;
  v_is_rate_limited BOOLEAN;
BEGIN
  -- SECURITY FIX: Ownership verification
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

  -- SECURITY FIX: Validate array sizes to prevent DoS
  IF p_categories IS NOT NULL AND array_length(p_categories, 1) > 20 THEN
    RAISE EXCEPTION 'Too many categories (max 20)';
  END IF;

  IF p_ingredients IS NOT NULL AND array_length(p_ingredients, 1) > 100 THEN
    RAISE EXCEPTION 'Too many ingredients (max 100)';
  END IF;

  IF p_instructions IS NOT NULL AND array_length(p_instructions, 1) > 100 THEN
    RAISE EXCEPTION 'Too many instructions (max 100)';
  END IF;

  -- Update recipes table
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

  -- Handle categories with rate limiting for new category creation
  DELETE FROM recipe_categories WHERE recipe = p_recipe_id;
  IF p_categories IS NOT NULL THEN
    -- Check rate limit before processing categories
    v_is_rate_limited := check_rate_limit(v_current_user, 'category_creation', 10, 60, 60);

    FOREACH cat IN ARRAY p_categories LOOP
      SELECT id INTO cat_id FROM categories WHERE categories.name = cat;
      IF cat_id IS NULL THEN
        -- New category - check rate limit
        IF v_is_rate_limited THEN
          RAISE EXCEPTION 'Too many new categories created. Please wait before creating more.';
        END IF;

        INSERT INTO categories(name) VALUES(cat) RETURNING id INTO cat_id;
        v_new_category_count := v_new_category_count + 1;

        -- Record each new category creation for rate limiting
        PERFORM record_failed_attempt(v_current_user, 'category_creation', 60);
      END IF;
      INSERT INTO recipe_categories(recipe, category) VALUES(p_recipe_id, cat_id);
    END LOOP;
  END IF;

  -- Handle ingredients
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

  -- Handle instructions
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
END;
$func$;

-- =============================================================================
-- 9. Update search_text triggers to include form field
-- =============================================================================

-- Update rebuild function to include form
CREATE OR REPLACE FUNCTION rebuild_recipe_search_text(p_recipe_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE recipes r SET
    search_text = concat_ws(' ',
      r.name,
      r.description,
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

COMMENT ON FUNCTION rebuild_recipe_search_text IS
  'Rebuilds the search_text column for a recipe, including name, description,
   ingredient names, and ingredient forms for trigram search.';

-- Update recipe trigger to include form
CREATE OR REPLACE FUNCTION trigger_recipe_search_text()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Build search_text inline for the NEW row
  -- Note: On INSERT, ingredients don't exist yet, so only name+description are included.
  -- The ingredient trigger will rebuild search_text when ingredients are added.
  NEW.search_text := concat_ws(' ',
    NEW.name,
    NEW.description,
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

-- Update food trigger to include form when rebuilding
CREATE OR REPLACE FUNCTION trigger_food_search_text()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Rebuild if name changed, or if status changed involving 'approved'
  IF (TG_OP = 'UPDATE' AND
      (OLD.name IS DISTINCT FROM NEW.name OR OLD.status IS DISTINCT FROM NEW.status) AND
      (NEW.status = 'approved' OR OLD.status = 'approved')) THEN
    -- Rebuild search_text for all recipes using this food
    UPDATE recipes r SET
      search_text = concat_ws(' ',
        r.name,
        r.description,
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

-- =============================================================================
-- 10. Backfill search_text for all existing recipes to include form
-- =============================================================================

UPDATE recipes r SET
  search_text = concat_ws(' ',
    r.name,
    r.description,
    (SELECT string_agg(COALESCE(f.name, i.name), ' ')
     FROM ingredients i
     LEFT JOIN foods f ON i.food_id = f.id AND f.status = 'approved'
     WHERE i.recipe_id = r.id),
    (SELECT string_agg(i.form, ' ')
     FROM ingredients i
     WHERE i.recipe_id = r.id AND i.form IS NOT NULL)
  );

-- =============================================================================
-- Documentation
-- =============================================================================

COMMENT ON COLUMN ingredients.form IS
  'The form/cut/preparation of the ingredient, e.g. "klyftor" (cloves), "zest", "strimlad" (shredded), "tärnad" (diced). Nullable - not all ingredients need a form specified.';
