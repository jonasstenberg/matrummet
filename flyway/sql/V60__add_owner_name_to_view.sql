-- Add owner's display name to recipes_and_categories view
-- Column must be appended at the end for CREATE OR REPLACE VIEW
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
                        ing.forms,
                        jsonb_path_query_array(rc.categories::jsonb, '$'::jsonpath),
                        ins.steps
                       )
             ) as full_tsv,
  EXISTS (
    SELECT 1 FROM recipe_likes
    WHERE recipe_likes.recipe_id = recipes.id
    AND recipe_likes.user_email = current_setting('request.jwt.claims', true)::jsonb->>'email'
  ) AS is_liked,
  COALESCE(pantry_stats.matching_count, 0) AS pantry_matching_count,
  COALESCE(pantry_stats.total_count, 0) AS pantry_total_count,
  CASE
    WHEN COALESCE(pantry_stats.total_count, 0) = 0 THEN 0
    ELSE (COALESCE(pantry_stats.matching_count, 0) * 100 / pantry_stats.total_count)::INTEGER
  END AS pantry_match_percentage,
  recipe_owner.name AS owner_name
FROM recipes
LEFT JOIN users recipe_owner ON recipe_owner.email = recipes.owner
LEFT JOIN LATERAL (
  SELECT jsonb_agg(name) AS categories FROM (
    SELECT categories.name FROM categories, recipe_categories WHERE recipe_categories.category = categories.id AND recipe_categories.recipe = recipes.id
  ) AS rc_categories
) AS rc ON TRUE
LEFT JOIN LATERAL (
  SELECT COALESCE(
    array_agg(DISTINCT COALESCE(f.canonical_food_id, up.food_id)),
    ARRAY[]::UUID[]
  ) AS food_ids
  FROM user_pantry up
  LEFT JOIN foods f ON f.id = up.food_id
  WHERE up.user_email = current_setting('request.jwt.claims', true)::jsonb->>'email'
) AS pantry ON TRUE
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
        'unit_id', ingredient.unit_id,
        'in_pantry', ingredient.food_id IS NOT NULL
          AND COALESCE(food.canonical_food_id, ingredient.food_id) = ANY(pantry.food_ids)
      ) ORDER BY ig.sort_order NULLS FIRST, ingredient.sort_order
    ) AS ingredients,
    string_agg(COALESCE(food.name, ingredient.name), ' ') AS names,
    string_agg(ingredient.form, ' ') FILTER (WHERE ingredient.form IS NOT NULL) AS forms
  FROM ingredients ingredient
  LEFT JOIN foods food ON ingredient.food_id = food.id AND food.status = 'approved'
  LEFT JOIN units unit ON ingredient.unit_id = unit.id
  LEFT JOIN ingredient_groups ig ON ingredient.group_id = ig.id
  WHERE ingredient.recipe_id = recipes.id
) AS ing ON TRUE
LEFT JOIN LATERAL (
  SELECT
    COUNT(DISTINCT COALESCE(fa.canonical_food_id, i.food_id))
      FILTER (WHERE i.food_id IS NOT NULL)::INTEGER AS total_count,
    COUNT(DISTINCT COALESCE(fa.canonical_food_id, i.food_id))
      FILTER (
        WHERE i.food_id IS NOT NULL
          AND COALESCE(fa.canonical_food_id, i.food_id) = ANY(pantry.food_ids)
      )::INTEGER AS matching_count
  FROM ingredients i
  LEFT JOIN foods fa ON fa.id = i.food_id
  WHERE i.recipe_id = recipes.id
) AS pantry_stats ON TRUE
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
      ) ORDER BY instg.sort_order NULLS FIRST, instruction.sort_order
    ) AS instructions,
    string_agg(instruction.step, ' ') AS steps
  FROM instructions instruction
  LEFT JOIN instruction_groups instg ON instruction.group_id = instg.id
  WHERE instruction.recipe_id = recipes.id
) AS ins ON TRUE;
