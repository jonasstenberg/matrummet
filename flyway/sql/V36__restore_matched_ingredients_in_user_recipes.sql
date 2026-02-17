-- V22 recreated user_recipes but omitted matched_ingredients from the
-- instructions JSON that V7 had added.  Restore it.

CREATE OR REPLACE VIEW public.user_recipes WITH (security_invoker='on') AS
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
    COALESCE(ARRAY( SELECT jsonb_array_elements_text(rc.categories)), ARRAY[]::text[]) AS categories,
    ing_grp.ingredient_groups,
    ing.ingredients,
    ins_grp.instruction_groups,
    ins.instructions,
    to_tsvector('swedish'::regconfig, concat_ws(' '::text, recipes.name, recipes.description, ing.names, ing.forms, jsonb_path_query_array(rc.categories, '$'::jsonpath), ins.steps)) AS full_tsv,
    (EXISTS ( SELECT 1
           FROM public.recipe_likes
          WHERE recipe_likes.recipe_id = recipes.id
            AND recipe_likes.user_email = (current_setting('request.jwt.claims'::text, true)::jsonb ->> 'email'::text))) AS is_liked,
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
     LEFT JOIN LATERAL ( SELECT jsonb_agg(rc_categories.name) AS categories
           FROM ( SELECT categories.name
                   FROM public.categories,
                    public.recipe_categories
                  WHERE recipe_categories.category = categories.id AND recipe_categories.recipe = recipes.id) rc_categories) rc ON true
     LEFT JOIN LATERAL ( SELECT COALESCE(array_agg(DISTINCT COALESCE(f.canonical_food_id, up.food_id)), ARRAY[]::uuid[]) AS food_ids
           FROM public.user_pantry up
             LEFT JOIN public.foods f ON f.id = up.food_id
          WHERE up.home_id = public.get_current_user_home_id()) pantry ON true
     LEFT JOIN LATERAL ( SELECT jsonb_agg(jsonb_build_object('id', ig.id, 'name', ig.name, 'sort_order', ig.sort_order) ORDER BY ig.sort_order) AS ingredient_groups
           FROM public.ingredient_groups ig
          WHERE ig.recipe_id = recipes.id) ing_grp ON true
     LEFT JOIN LATERAL ( SELECT jsonb_agg(jsonb_build_object('id', ingredient.id, 'name', COALESCE(food.name, ingredient.name), 'measurement', COALESCE(NULLIF(unit.abbreviation, ''::text), unit.name, ingredient.measurement), 'quantity', ingredient.quantity, 'form', ingredient.form, 'group_id', ingredient.group_id, 'sort_order', ingredient.sort_order, 'food_id', ingredient.food_id, 'unit_id', ingredient.unit_id, 'in_pantry',
                CASE
                    WHEN ingredient.food_id IS NULL THEN false
                    WHEN COALESCE(food.canonical_food_id, ingredient.food_id) = ANY (pantry.food_ids) THEN true
                    ELSE false
                END) ORDER BY ig.sort_order NULLS FIRST, ingredient.sort_order) AS ingredients,
            string_agg(DISTINCT COALESCE(food.name, ingredient.name), ' '::text) AS names,
            string_agg(DISTINCT ingredient.form, ' '::text) FILTER (WHERE ingredient.form IS NOT NULL) AS forms
           FROM public.ingredients ingredient
             LEFT JOIN public.ingredient_groups ig ON ig.id = ingredient.group_id
             LEFT JOIN public.foods food ON food.id = ingredient.food_id
             LEFT JOIN public.units unit ON unit.id = ingredient.unit_id
          WHERE ingredient.recipe_id = recipes.id) ing ON true
     LEFT JOIN LATERAL ( SELECT jsonb_agg(jsonb_build_object('id', ig.id, 'name', ig.name, 'sort_order', ig.sort_order) ORDER BY ig.sort_order) AS instruction_groups
           FROM public.instruction_groups ig
          WHERE ig.recipe_id = recipes.id) ins_grp ON true
     LEFT JOIN LATERAL ( SELECT jsonb_agg(
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
            ORDER BY ig.sort_order NULLS FIRST, instruction.sort_order) AS instructions,
            string_agg(instruction.step, ' '::text) AS steps
           FROM public.instructions instruction
             LEFT JOIN public.instruction_groups ig ON ig.id = instruction.group_id
          WHERE instruction.recipe_id = recipes.id) ins ON true
     LEFT JOIN LATERAL ( SELECT count(*) FILTER (WHERE COALESCE(f.canonical_food_id, i.food_id) = ANY (pantry.food_ids)) AS matching_count,
            count(*) AS total_count
           FROM public.ingredients i
             LEFT JOIN public.foods f ON f.id = i.food_id
          WHERE i.recipe_id = recipes.id AND i.food_id IS NOT NULL) pantry_stats ON true;
