-- Migration: Add featured recipes for landing page preview
-- Admins can mark recipes as featured, which makes them visible to anonymous users

-- Add is_featured column to recipes
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE;

-- Create index for featured recipe queries
CREATE INDEX IF NOT EXISTS recipes_is_featured_idx
ON recipes USING btree (is_featured)
WHERE (is_featured = TRUE);

-- RLS policy: anonymous users can SELECT featured recipes
DROP POLICY IF EXISTS recipes_anon_featured_select ON recipes;
CREATE POLICY recipes_anon_featured_select ON recipes
FOR SELECT TO anon
USING (is_featured = TRUE);

-- RLS policy: authenticated users can also SELECT featured recipes (in addition to their own)
DROP POLICY IF EXISTS recipes_featured_select ON recipes;
CREATE POLICY recipes_featured_select ON recipes
FOR SELECT TO authenticated
USING (is_featured = TRUE);

-- RLS policies for related tables: anonymous access to featured recipe data
DROP POLICY IF EXISTS ingredients_anon_featured_select ON ingredients;
CREATE POLICY ingredients_anon_featured_select ON ingredients
FOR SELECT TO anon
USING (EXISTS (
  SELECT 1 FROM recipes
  WHERE recipes.id = ingredients.recipe_id
  AND recipes.is_featured = TRUE
));

DROP POLICY IF EXISTS ingredient_groups_anon_featured_select ON ingredient_groups;
CREATE POLICY ingredient_groups_anon_featured_select ON ingredient_groups
FOR SELECT TO anon
USING (EXISTS (
  SELECT 1 FROM recipes
  WHERE recipes.id = ingredient_groups.recipe_id
  AND recipes.is_featured = TRUE
));

DROP POLICY IF EXISTS instructions_anon_featured_select ON instructions;
CREATE POLICY instructions_anon_featured_select ON instructions
FOR SELECT TO anon
USING (EXISTS (
  SELECT 1 FROM recipes
  WHERE recipes.id = instructions.recipe_id
  AND recipes.is_featured = TRUE
));

DROP POLICY IF EXISTS instruction_groups_anon_featured_select ON instruction_groups;
CREATE POLICY instruction_groups_anon_featured_select ON instruction_groups
FOR SELECT TO anon
USING (EXISTS (
  SELECT 1 FROM recipes
  WHERE recipes.id = instruction_groups.recipe_id
  AND recipes.is_featured = TRUE
));

DROP POLICY IF EXISTS recipe_categories_anon_featured_select ON recipe_categories;
CREATE POLICY recipe_categories_anon_featured_select ON recipe_categories
FOR SELECT TO anon
USING (EXISTS (
  SELECT 1 FROM recipes
  WHERE recipes.id = recipe_categories.recipe
  AND recipes.is_featured = TRUE
));

-- Grant get_user_id to anon (needed for featured_recipes view)
GRANT EXECUTE ON FUNCTION public.get_user_id(text) TO anon;

-- Create featured_recipes view with full ingredient/instruction data
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
      'measurement', COALESCE(NULLIF(unit.abbreviation, ''), unit.name, ingredient.measurement),
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
      'sort_order', instruction.sort_order
    )
    ORDER BY ig.sort_order NULLS FIRST, instruction.sort_order
  ) AS instructions
  FROM public.instructions instruction
  LEFT JOIN public.instruction_groups ig ON ig.id = instruction.group_id
  WHERE instruction.recipe_id = recipes.id
) ins ON true
WHERE recipes.is_featured = TRUE;

-- Grant permissions on the view
GRANT SELECT ON featured_recipes TO anon;
GRANT SELECT ON featured_recipes TO authenticated;

-- Create admin function to set featured status
CREATE OR REPLACE FUNCTION set_recipe_featured(p_recipe_id UUID, p_featured BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'permission-denied: only admins can feature recipes';
  END IF;

  UPDATE recipes
  SET is_featured = p_featured
  WHERE id = p_recipe_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not-found: recipe does not exist';
  END IF;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION set_recipe_featured(UUID, BOOLEAN) TO authenticated;

-- Update user_recipes view to include is_featured
-- Must DROP first since CREATE OR REPLACE cannot add columns
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
    COALESCE(ARRAY( SELECT jsonb_array_elements_text(rc.categories) AS jsonb_array_elements_text), ARRAY[]::text[]) AS categories,
    ing_grp.ingredient_groups,
    ing.ingredients,
    ins_grp.instruction_groups,
    ins.instructions,
    to_tsvector('swedish'::regconfig, concat_ws(' '::text, recipes.name, recipes.description, ing.names, ing.forms, jsonb_path_query_array(rc.categories, '$'::jsonpath), ins.steps)) AS full_tsv,
    (EXISTS ( SELECT 1
           FROM public.recipe_likes
          WHERE ((recipe_likes.recipe_id = recipes.id) AND (recipe_likes.user_email = ((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'email'::text))))) AS is_liked,
    COALESCE(pantry_stats.matching_count, (0)::bigint) AS pantry_matching_count,
    COALESCE(pantry_stats.total_count, (0)::bigint) AS pantry_total_count,
        CASE
            WHEN (COALESCE(pantry_stats.total_count, (0)::bigint) = 0) THEN 0
            ELSE (((COALESCE(pantry_stats.matching_count, (0)::bigint) * 100) / pantry_stats.total_count))::integer
        END AS pantry_match_percentage,
    public.get_user_display_name(recipes.owner) AS owner_name,
    public.get_user_id(recipes.owner) AS owner_id,
    (recipes.copied_from_recipe_id IS NOT NULL) AS is_copy,
    (recipes.owner = ((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'email'::text)) AS is_owner
   FROM (((((((public.recipes
     LEFT JOIN LATERAL ( SELECT jsonb_agg(rc_categories.name) AS categories
           FROM ( SELECT categories.name
                   FROM public.categories,
                    public.recipe_categories
                  WHERE ((recipe_categories.category = categories.id) AND (recipe_categories.recipe = recipes.id))) rc_categories) rc ON (true))
     LEFT JOIN LATERAL ( SELECT COALESCE(array_agg(DISTINCT COALESCE(f.canonical_food_id, up.food_id)), ARRAY[]::uuid[]) AS food_ids
           FROM (public.user_pantry up
             LEFT JOIN public.foods f ON ((f.id = up.food_id)))
          WHERE (up.user_email = ((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'email'::text))) pantry ON (true))
     LEFT JOIN LATERAL ( SELECT jsonb_agg(jsonb_build_object('id', ig.id, 'name', ig.name, 'sort_order', ig.sort_order) ORDER BY ig.sort_order) AS ingredient_groups
           FROM public.ingredient_groups ig
          WHERE (ig.recipe_id = recipes.id)) ing_grp ON (true))
     LEFT JOIN LATERAL ( SELECT jsonb_agg(jsonb_build_object('id', ingredient.id, 'name', COALESCE(food.name, ingredient.name), 'measurement', COALESCE(NULLIF(unit.abbreviation, ''::text), unit.name, ingredient.measurement), 'quantity', ingredient.quantity, 'form', ingredient.form, 'group_id', ingredient.group_id, 'sort_order', ingredient.sort_order, 'food_id', ingredient.food_id, 'unit_id', ingredient.unit_id, 'in_pantry',
                CASE
                    WHEN (ingredient.food_id IS NULL) THEN false
                    WHEN (COALESCE(food.canonical_food_id, ingredient.food_id) = ANY (pantry.food_ids)) THEN true
                    ELSE false
                END) ORDER BY ig.sort_order NULLS FIRST, ingredient.sort_order) AS ingredients,
            string_agg(DISTINCT COALESCE(food.name, ingredient.name), ' '::text) AS names,
            string_agg(DISTINCT ingredient.form, ' '::text) FILTER (WHERE (ingredient.form IS NOT NULL)) AS forms
           FROM (((public.ingredients ingredient
             LEFT JOIN public.ingredient_groups ig ON ((ig.id = ingredient.group_id)))
             LEFT JOIN public.foods food ON ((food.id = ingredient.food_id)))
             LEFT JOIN public.units unit ON ((unit.id = ingredient.unit_id)))
          WHERE (ingredient.recipe_id = recipes.id)) ing ON (true))
     LEFT JOIN LATERAL ( SELECT jsonb_agg(jsonb_build_object('id', ig.id, 'name', ig.name, 'sort_order', ig.sort_order) ORDER BY ig.sort_order) AS instruction_groups
           FROM public.instruction_groups ig
          WHERE (ig.recipe_id = recipes.id)) ins_grp ON (true))
     LEFT JOIN LATERAL ( SELECT jsonb_agg(jsonb_build_object('id', instruction.id, 'step', instruction.step, 'group_id', instruction.group_id, 'sort_order', instruction.sort_order) ORDER BY ig.sort_order NULLS FIRST, instruction.sort_order) AS instructions,
            string_agg(instruction.step, ' '::text) AS steps
           FROM (public.instructions instruction
             LEFT JOIN public.instruction_groups ig ON ((ig.id = instruction.group_id)))
          WHERE (instruction.recipe_id = recipes.id)) ins ON (true))
     LEFT JOIN LATERAL ( SELECT count(*) FILTER (WHERE (COALESCE(f.canonical_food_id, i.food_id) = ANY (pantry.food_ids))) AS matching_count,
            count(*) AS total_count
           FROM (public.ingredients i
             LEFT JOIN public.foods f ON ((f.id = i.food_id)))
          WHERE ((i.recipe_id = recipes.id) AND (i.food_id IS NOT NULL))) pantry_stats ON (true));

-- Re-grant permissions on user_recipes
GRANT SELECT ON user_recipes TO authenticated;

-- Recreate search_recipes function that depends on user_recipes
CREATE OR REPLACE FUNCTION public.search_recipes(p_query text, p_owner_only boolean DEFAULT false, p_category text DEFAULT NULL::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0) RETURNS SETOF public.user_recipes
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
