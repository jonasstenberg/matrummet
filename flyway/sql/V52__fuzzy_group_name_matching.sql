-- Fuzzy group name matching for instruction-ingredient matches.
--
-- Problem: Group preference uses exact lower() equality, which fails for
-- Swedish definite/indefinite form differences like "Sås" vs "Såsen".
--
-- Fix: Replace exact equality with word_similarity >= 0.6, which handles
-- Swedish definite forms (Sås↔Såsen, Fyllning↔Fyllningen) while keeping
-- unrelated names apart (Sås vs Deg = 0).

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
              AND word_similarity(lower(ins_grp.name), lower(ing_grp.name)) >= 0.6 THEN 0
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

-- Recompute all recipes with the improved group matching
DO $$
DECLARE
  v_recipe_id UUID;
BEGIN
  FOR v_recipe_id IN SELECT id FROM recipes LOOP
    PERFORM compute_instruction_ingredient_matches(v_recipe_id);
  END LOOP;
END;
$$;
