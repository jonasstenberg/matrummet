-- V13: Use unit abbreviations in recipes_and_categories view
-- Updates ingredients measurement field to prefer abbreviations over full unit names
-- Falls back to unit name, then raw measurement string if no unit is linked

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
        'name', COALESCE(food.name, ingredient.name),
        'measurement', COALESCE(
          NULLIF(unit.abbreviation, ''),  -- Use abbreviation if not empty
          unit.name,                       -- Fall back to unit name
          ingredient.measurement           -- Fall back to raw measurement string
        ),
        'quantity', ingredient.quantity,
        'group_id', ingredient.group_id,
        'sort_order', ingredient.sort_order,
        'food_id', ingredient.food_id,
        'unit_id', ingredient.unit_id
      ) ORDER BY ingredient.group_id NULLS FIRST, ingredient.sort_order
    ) AS ingredients,
    string_agg(COALESCE(food.name, ingredient.name), ' ') AS names
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
