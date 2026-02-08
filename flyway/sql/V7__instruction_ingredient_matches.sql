-- Migration: Add instruction-ingredient matching using pg_trgm word similarity
-- Links instructions to the ingredients they reference, enabling UI highlighting

-- =============================================================================
-- 1. Create the join table
-- =============================================================================

CREATE TABLE IF NOT EXISTS instruction_ingredient_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instruction_id UUID NOT NULL REFERENCES instructions(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  similarity REAL NOT NULL CHECK (similarity > 0 AND similarity <= 1),
  owner TEXT NOT NULL DEFAULT current_setting('request.jwt.claims', true)::jsonb->>'email',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (instruction_id, ingredient_id)
);

-- Indexes
CREATE INDEX instruction_ingredient_matches_instruction_id_idx
  ON instruction_ingredient_matches (instruction_id);
CREATE INDEX instruction_ingredient_matches_ingredient_id_idx
  ON instruction_ingredient_matches (ingredient_id);
CREATE INDEX instruction_ingredient_matches_recipe_id_idx
  ON instruction_ingredient_matches (recipe_id);
CREATE INDEX instruction_ingredient_matches_owner_idx
  ON instruction_ingredient_matches (owner);

-- =============================================================================
-- 2. RLS policies (following project pattern)
-- =============================================================================

ALTER TABLE instruction_ingredient_matches ENABLE ROW LEVEL SECURITY;

-- SELECT: authenticated users can see matches for any recipe they can see
DROP POLICY IF EXISTS iim_auth_select ON instruction_ingredient_matches;
CREATE POLICY iim_auth_select ON instruction_ingredient_matches
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM recipes WHERE recipes.id = instruction_ingredient_matches.recipe_id
));

-- SELECT: anonymous users can see matches for featured recipes
DROP POLICY IF EXISTS iim_anon_featured_select ON instruction_ingredient_matches;
CREATE POLICY iim_anon_featured_select ON instruction_ingredient_matches
FOR SELECT TO anon
USING (EXISTS (
  SELECT 1 FROM recipes
  WHERE recipes.id = instruction_ingredient_matches.recipe_id
  AND recipes.is_featured = TRUE
));

-- SELECT: anonymous users can see matches for public recipes
DROP POLICY IF EXISTS iim_anon_select ON instruction_ingredient_matches;
CREATE POLICY iim_anon_select ON instruction_ingredient_matches
FOR SELECT TO anon
USING (EXISTS (
  SELECT 1 FROM recipes
  WHERE recipes.id = instruction_ingredient_matches.recipe_id
  AND recipes.visibility = 'public'::recipe_visibility
));

-- INSERT: owner only
DROP POLICY IF EXISTS iim_policy_insert ON instruction_ingredient_matches;
CREATE POLICY iim_policy_insert ON instruction_ingredient_matches
FOR INSERT
WITH CHECK (
  owner = current_setting('request.jwt.claims', true)::jsonb->>'email'
  AND EXISTS (
    SELECT 1 FROM recipes r
    WHERE r.id = instruction_ingredient_matches.recipe_id
    AND r.owner = current_setting('request.jwt.claims', true)::jsonb->>'email'
  )
);

-- UPDATE: owner only
DROP POLICY IF EXISTS iim_policy_update ON instruction_ingredient_matches;
CREATE POLICY iim_policy_update ON instruction_ingredient_matches
FOR UPDATE
USING (owner = current_setting('request.jwt.claims', true)::jsonb->>'email');

-- DELETE: owner only
DROP POLICY IF EXISTS iim_policy_delete ON instruction_ingredient_matches;
CREATE POLICY iim_policy_delete ON instruction_ingredient_matches
FOR DELETE
USING (owner = current_setting('request.jwt.claims', true)::jsonb->>'email');

-- Grant table permissions
GRANT SELECT ON instruction_ingredient_matches TO anon;
GRANT SELECT ON instruction_ingredient_matches TO authenticated;

-- =============================================================================
-- 3. Compute function using pg_trgm word_similarity
-- =============================================================================

CREATE OR REPLACE FUNCTION compute_instruction_ingredient_matches(p_recipe_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_recipe_owner TEXT;
BEGIN
  SELECT owner INTO v_recipe_owner FROM recipes WHERE id = p_recipe_id;

  IF v_recipe_owner IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM instruction_ingredient_matches WHERE recipe_id = p_recipe_id;

  -- Match ingredients to instructions using pg_trgm word_similarity (>= 0.6)
  -- or exact substring match (LIKE). Deduplicates by ingredient name per
  -- instruction so the same ingredient from multiple groups only appears once,
  -- preferring the match from the same group as the instruction.
  INSERT INTO instruction_ingredient_matches (instruction_id, ingredient_id, recipe_id, similarity, owner)
  SELECT instruction_id, ingredient_id, p_recipe_id, similarity, v_recipe_owner
  FROM (
    SELECT
      ins.id AS instruction_id,
      ing.id AS ingredient_id,
      GREATEST(
        word_similarity(lower(COALESCE(food.name, ing.name)), lower(ins.step)),
        CASE
          WHEN lower(ins.step) LIKE '%' || lower(COALESCE(food.name, ing.name)) || '%' THEN 1.0
          ELSE 0.0
        END
      ) AS similarity,
      ROW_NUMBER() OVER (
        PARTITION BY ins.id, lower(COALESCE(food.name, ing.name))
        ORDER BY
          -- Prefer matches where instruction and ingredient share the same group name
          CASE
            WHEN ins_grp.name IS NOT NULL AND ing_grp.name IS NOT NULL
              AND lower(ins_grp.name) = lower(ing_grp.name) THEN 0
            WHEN ins.group_id IS NULL AND ing.group_id IS NULL THEN 0
            ELSE 1
          END,
          -- Then by similarity descending
          GREATEST(
            word_similarity(lower(COALESCE(food.name, ing.name)), lower(ins.step)),
            CASE WHEN lower(ins.step) LIKE '%' || lower(COALESCE(food.name, ing.name)) || '%' THEN 1.0 ELSE 0.0 END
          ) DESC
      ) AS rn
    FROM instructions ins
    CROSS JOIN ingredients ing
    LEFT JOIN foods food ON food.id = ing.food_id
    LEFT JOIN instruction_groups ins_grp ON ins_grp.id = ins.group_id
    LEFT JOIN ingredient_groups ing_grp ON ing_grp.id = ing.group_id
    WHERE ins.recipe_id = p_recipe_id
      AND ing.recipe_id = p_recipe_id
      AND length(COALESCE(food.name, ing.name)) >= 2
      AND (
        word_similarity(lower(COALESCE(food.name, ing.name)), lower(ins.step)) >= 0.6
        OR lower(ins.step) LIKE '%' || lower(COALESCE(food.name, ing.name)) || '%'
      )
  ) ranked
  WHERE rn = 1;
END;
$$;

GRANT EXECUTE ON FUNCTION compute_instruction_ingredient_matches(UUID) TO authenticated;

-- =============================================================================
-- 4. Update insert_recipe to call compute function
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
      IF cat_id IS NULL THEN
        INSERT INTO categories(name) VALUES(cat) RETURNING id INTO cat_id;
      END IF;
      INSERT INTO recipe_categories(recipe, category) VALUES(new_recipe_id, cat_id);
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
-- 5. Update update_recipe to call compute function
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
      IF cat_id IS NULL THEN
        INSERT INTO categories(name) VALUES(cat) RETURNING id INTO cat_id;
      END IF;
      INSERT INTO recipe_categories(recipe, category) VALUES(p_recipe_id, cat_id);
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

-- =============================================================================
-- 6. Update user_recipes view to include matched_ingredients
-- =============================================================================

-- Must DROP first since the view is referenced by search_recipes function
-- which returns SETOF user_recipes, so we need to recreate that too.
DROP VIEW IF EXISTS user_recipes CASCADE;

CREATE VIEW public.user_recipes WITH (security_invoker='on') AS
SELECT recipes.id,
    recipes.name,
    recipes.description,
    recipes.author,
    recipes.url,
    recipes.image,
    recipes.thumbnail,
    recipes.recipe_yield,
    recipes.recipe_yield_name,
    recipes.prep_time,
    recipes.cook_time,
    recipes.cuisine,
    recipes.date_published,
    recipes.date_modified,
    recipes.visibility,
    recipes.copied_from_recipe_id,
    recipes.copied_from_author_name,
    recipes.is_featured,
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(rc.categories)), ARRAY[]::text[]) AS categories,
    ing_grp.ingredient_groups,
    ing.ingredients,
    ins_grp.instruction_groups,
    ins.instructions,
    to_tsvector('swedish'::regconfig, concat_ws(' '::text, recipes.name, recipes.description, ing.names, ing.forms, jsonb_path_query_array(rc.categories, '$'::jsonpath), ins.steps)) AS full_tsv,
    (EXISTS (
      SELECT 1
      FROM public.recipe_likes
      WHERE recipe_likes.recipe_id = recipes.id
        AND recipe_likes.user_email = (current_setting('request.jwt.claims'::text, true)::jsonb ->> 'email'::text)
    )) AS is_liked,
    COALESCE(pantry_stats.matching_count, 0::bigint) AS pantry_matching_count,
    COALESCE(pantry_stats.total_count, 0::bigint) AS pantry_total_count,
    CASE
      WHEN COALESCE(pantry_stats.total_count, 0::bigint) = 0 THEN 0
      ELSE (COALESCE(pantry_stats.matching_count, 0::bigint) * 100 / pantry_stats.total_count)::integer
    END AS pantry_match_percentage,
    public.get_user_display_name(recipes.owner) AS owner_name,
    public.get_user_id(recipes.owner) AS owner_id,
    (recipes.copied_from_recipe_id IS NOT NULL) AS is_copy,
    (recipes.owner = (current_setting('request.jwt.claims'::text, true)::jsonb ->> 'email'::text)) AS is_owner
FROM public.recipes
LEFT JOIN LATERAL (
  SELECT jsonb_agg(rc_categories.name) AS categories
  FROM (
    SELECT categories.name
    FROM public.categories, public.recipe_categories
    WHERE recipe_categories.category = categories.id
      AND recipe_categories.recipe = recipes.id
  ) rc_categories
) rc ON true
LEFT JOIN LATERAL (
  SELECT COALESCE(array_agg(DISTINCT COALESCE(f.canonical_food_id, up.food_id)), ARRAY[]::uuid[]) AS food_ids
  FROM public.user_pantry up
  LEFT JOIN public.foods f ON f.id = up.food_id
  WHERE up.user_email = (current_setting('request.jwt.claims'::text, true)::jsonb ->> 'email'::text)
) pantry ON true
LEFT JOIN LATERAL (
  SELECT jsonb_agg(
    jsonb_build_object('id', ig.id, 'name', ig.name, 'sort_order', ig.sort_order)
    ORDER BY ig.sort_order
  ) AS ingredient_groups
  FROM public.ingredient_groups ig
  WHERE ig.recipe_id = recipes.id
) ing_grp ON true
LEFT JOIN LATERAL (
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', ingredient.id,
      'name', COALESCE(food.name, ingredient.name),
      'measurement', COALESCE(NULLIF(unit.abbreviation, ''::text), unit.name, ingredient.measurement),
      'quantity', ingredient.quantity,
      'form', ingredient.form,
      'group_id', ingredient.group_id,
      'sort_order', ingredient.sort_order,
      'food_id', ingredient.food_id,
      'unit_id', ingredient.unit_id,
      'in_pantry', CASE
        WHEN ingredient.food_id IS NULL THEN false
        WHEN COALESCE(food.canonical_food_id, ingredient.food_id) = ANY (pantry.food_ids) THEN true
        ELSE false
      END
    )
    ORDER BY ig.sort_order NULLS FIRST, ingredient.sort_order
  ) AS ingredients,
  string_agg(DISTINCT COALESCE(food.name, ingredient.name), ' '::text) AS names,
  string_agg(DISTINCT ingredient.form, ' '::text) FILTER (WHERE ingredient.form IS NOT NULL) AS forms
  FROM public.ingredients ingredient
  LEFT JOIN public.ingredient_groups ig ON ig.id = ingredient.group_id
  LEFT JOIN public.foods food ON food.id = ingredient.food_id
  LEFT JOIN public.units unit ON unit.id = ingredient.unit_id
  WHERE ingredient.recipe_id = recipes.id
) ing ON true
LEFT JOIN LATERAL (
  SELECT jsonb_agg(
    jsonb_build_object('id', ig.id, 'name', ig.name, 'sort_order', ig.sort_order)
    ORDER BY ig.sort_order
  ) AS instruction_groups
  FROM public.instruction_groups ig
  WHERE ig.recipe_id = recipes.id
) ins_grp ON true
LEFT JOIN LATERAL (
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', instruction.id,
      'step', instruction.step,
      'group_id', instruction.group_id,
      'sort_order', instruction.sort_order,
      'matched_ingredients', (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'id', mi.id,
            'name', COALESCE(mf.name, mi.name),
            'quantity', mi.quantity,
            'measurement', COALESCE(NULLIF(mu.abbreviation, ''::text), mu.name, mi.measurement)
          )
        ), '[]'::jsonb)
        FROM public.instruction_ingredient_matches iim
        JOIN public.ingredients mi ON mi.id = iim.ingredient_id
        LEFT JOIN public.foods mf ON mf.id = mi.food_id
        LEFT JOIN public.units mu ON mu.id = mi.unit_id
        WHERE iim.instruction_id = instruction.id
      )
    )
    ORDER BY ig.sort_order NULLS FIRST, instruction.sort_order
  ) AS instructions,
  string_agg(instruction.step, ' '::text) AS steps
  FROM public.instructions instruction
  LEFT JOIN public.instruction_groups ig ON ig.id = instruction.group_id
  WHERE instruction.recipe_id = recipes.id
) ins ON true
LEFT JOIN LATERAL (
  SELECT count(*) FILTER (WHERE COALESCE(f.canonical_food_id, i.food_id) = ANY (pantry.food_ids)) AS matching_count,
    count(*) AS total_count
  FROM public.ingredients i
  LEFT JOIN public.foods f ON f.id = i.food_id
  WHERE i.recipe_id = recipes.id AND i.food_id IS NOT NULL
) pantry_stats ON true;

-- Re-grant permissions on user_recipes
GRANT SELECT ON user_recipes TO authenticated;

-- Recreate search_recipes function that depends on user_recipes
CREATE OR REPLACE FUNCTION public.search_recipes(
  p_query text,
  p_owner_only boolean DEFAULT false,
  p_category text DEFAULT NULL::text,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS SETOF public.user_recipes
LANGUAGE sql STABLE
SET search_path TO 'public', 'extensions'
AS $$
  SELECT ur.* FROM user_recipes ur JOIN recipes r ON r.id = ur.id
  WHERE COALESCE(trim(p_query), '') != '' AND r.search_text ILIKE '%' || escape_like_pattern(p_query) || '%'
    AND (NOT p_owner_only OR ur.is_owner = TRUE)
    AND (p_category IS NULL OR p_category = ANY(ur.categories))
  ORDER BY CASE WHEN ur.name ILIKE escape_like_pattern(p_query) THEN 0 WHEN ur.name ILIKE escape_like_pattern(p_query) || '%' THEN 1 WHEN ur.name ILIKE '%' || escape_like_pattern(p_query) || '%' THEN 2 ELSE 3 END, word_similarity(p_query, ur.name) DESC, ur.date_published DESC
  LIMIT p_limit OFFSET p_offset;
$$;

GRANT ALL ON FUNCTION public.search_recipes(text, boolean, text, integer, integer) TO authenticated;

-- =============================================================================
-- 7. Update featured_recipes view to include matched_ingredients
-- =============================================================================

CREATE OR REPLACE VIEW featured_recipes AS
SELECT
  recipes.id,
  recipes.name,
  recipes.description,
  recipes.author,
  recipes.url,
  recipes.image,
  recipes.thumbnail,
  recipes.recipe_yield,
  recipes.recipe_yield_name,
  recipes.prep_time,
  recipes.cook_time,
  recipes.cuisine,
  recipes.date_published,
  recipes.date_modified,
  recipes.is_featured,
  COALESCE(ARRAY(SELECT jsonb_array_elements_text(rc.categories)), ARRAY[]::text[]) AS categories,
  ing_grp.ingredient_groups,
  ing.ingredients,
  ins_grp.instruction_groups,
  ins.instructions,
  public.get_user_display_name(recipes.owner) AS owner_name,
  public.get_user_id(recipes.owner) AS owner_id
FROM public.recipes
LEFT JOIN LATERAL (
  SELECT jsonb_agg(rc_categories.name) AS categories
  FROM (
    SELECT categories.name
    FROM public.categories, public.recipe_categories
    WHERE recipe_categories.category = categories.id
      AND recipe_categories.recipe = recipes.id
  ) rc_categories
) rc ON true
LEFT JOIN LATERAL (
  SELECT jsonb_agg(
    jsonb_build_object('id', ig.id, 'name', ig.name, 'sort_order', ig.sort_order)
    ORDER BY ig.sort_order
  ) AS ingredient_groups
  FROM public.ingredient_groups ig
  WHERE ig.recipe_id = recipes.id
) ing_grp ON true
LEFT JOIN LATERAL (
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', ingredient.id,
      'name', COALESCE(food.name, ingredient.name),
      'measurement', COALESCE(NULLIF(unit.abbreviation, ''::text), unit.name, ingredient.measurement),
      'quantity', ingredient.quantity,
      'form', ingredient.form,
      'group_id', ingredient.group_id,
      'sort_order', ingredient.sort_order,
      'food_id', ingredient.food_id,
      'unit_id', ingredient.unit_id
    )
    ORDER BY ig.sort_order NULLS FIRST, ingredient.sort_order
  ) AS ingredients
  FROM public.ingredients ingredient
  LEFT JOIN public.ingredient_groups ig ON ig.id = ingredient.group_id
  LEFT JOIN public.foods food ON food.id = ingredient.food_id
  LEFT JOIN public.units unit ON unit.id = ingredient.unit_id
  WHERE ingredient.recipe_id = recipes.id
) ing ON true
LEFT JOIN LATERAL (
  SELECT jsonb_agg(
    jsonb_build_object('id', ig.id, 'name', ig.name, 'sort_order', ig.sort_order)
    ORDER BY ig.sort_order
  ) AS instruction_groups
  FROM public.instruction_groups ig
  WHERE ig.recipe_id = recipes.id
) ins_grp ON true
LEFT JOIN LATERAL (
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', instruction.id,
      'step', instruction.step,
      'group_id', instruction.group_id,
      'sort_order', instruction.sort_order,
      'matched_ingredients', (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'id', mi.id,
            'name', COALESCE(mf.name, mi.name),
            'quantity', mi.quantity,
            'measurement', COALESCE(NULLIF(mu.abbreviation, ''::text), mu.name, mi.measurement)
          )
        ), '[]'::jsonb)
        FROM public.instruction_ingredient_matches iim
        JOIN public.ingredients mi ON mi.id = iim.ingredient_id
        LEFT JOIN public.foods mf ON mf.id = mi.food_id
        LEFT JOIN public.units mu ON mu.id = mi.unit_id
        WHERE iim.instruction_id = instruction.id
      )
    )
    ORDER BY ig.sort_order NULLS FIRST, instruction.sort_order
  ) AS instructions
  FROM public.instructions instruction
  LEFT JOIN public.instruction_groups ig ON ig.id = instruction.group_id
  WHERE instruction.recipe_id = recipes.id
) ins ON true
WHERE recipes.is_featured = TRUE;

-- Re-grant permissions on featured_recipes
GRANT SELECT ON featured_recipes TO anon;
GRANT SELECT ON featured_recipes TO authenticated;

-- =============================================================================
-- 8. Backfill existing recipes
-- =============================================================================

DO $$
DECLARE
  v_recipe_id UUID;
BEGIN
  FOR v_recipe_id IN SELECT id FROM recipes LOOP
    PERFORM compute_instruction_ingredient_matches(v_recipe_id);
  END LOOP;
END;
$$;
