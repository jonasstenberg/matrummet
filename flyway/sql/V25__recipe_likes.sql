-- V25: Add recipe likes functionality
-- Allows users to "like" recipes (but not their own)
-- Likes are private - users can only see their own likes
-- Adds is_liked column to recipes_and_categories view

-- =============================================================================
-- Recipe Likes Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS recipe_likes (
  date_published TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE NOT NULL,
  user_email TEXT NOT NULL,
  PRIMARY KEY (recipe_id, user_email)
);

-- Indexes for efficient querying
CREATE INDEX recipe_likes_user_email_idx ON recipe_likes (user_email);
CREATE INDEX recipe_likes_recipe_id_idx ON recipe_likes (recipe_id);
-- Composite index for fetching user's liked recipes ordered by date
CREATE INDEX recipe_likes_user_date_idx ON recipe_likes (user_email, date_published DESC);

GRANT SELECT, INSERT, DELETE ON recipe_likes TO "anon";

-- =============================================================================
-- Row Level Security
-- =============================================================================

ALTER TABLE recipe_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_likes FORCE ROW LEVEL SECURITY;

-- Users can only see their own likes (privacy requirement)
CREATE POLICY recipe_likes_policy_select
  ON recipe_likes
  FOR SELECT
  USING (user_email = current_setting('request.jwt.claims', true)::jsonb->>'email');

-- Users can only like recipes they don't own (enforced at DB level)
CREATE POLICY recipe_likes_policy_insert
  ON recipe_likes
  FOR INSERT
  WITH CHECK (
    user_email = current_setting('request.jwt.claims', true)::jsonb->>'email'
    AND NOT EXISTS (
      SELECT 1 FROM recipes
      WHERE recipes.id = recipe_id
      AND recipes.owner = current_setting('request.jwt.claims', true)::jsonb->>'email'
    )
  );

-- Users can only delete their own likes
CREATE POLICY recipe_likes_policy_delete
  ON recipe_likes
  FOR DELETE
  USING (user_email = current_setting('request.jwt.claims', true)::jsonb->>'email');

-- =============================================================================
-- Helper Functions
-- =============================================================================

-- Toggle like status (idempotent)
CREATE OR REPLACE FUNCTION toggle_recipe_like(p_recipe_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user_email TEXT;
  v_recipe_owner TEXT;
  v_is_liked BOOLEAN;
BEGIN
  -- Get current user email from JWT
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  -- Check if recipe exists and get owner
  SELECT owner INTO v_recipe_owner FROM recipes WHERE id = p_recipe_id;

  IF v_recipe_owner IS NULL THEN
    RAISE EXCEPTION 'recipe-not-found';
  END IF;

  -- Prevent liking own recipe
  IF v_recipe_owner = v_user_email THEN
    RAISE EXCEPTION 'cannot-like-own-recipe';
  END IF;

  -- Check if already liked
  SELECT EXISTS(
    SELECT 1 FROM recipe_likes
    WHERE recipe_id = p_recipe_id AND user_email = v_user_email
  ) INTO v_is_liked;

  IF v_is_liked THEN
    -- Unlike
    DELETE FROM recipe_likes
    WHERE recipe_id = p_recipe_id AND user_email = v_user_email;
    RETURN jsonb_build_object('liked', false);
  ELSE
    -- Like
    INSERT INTO recipe_likes (recipe_id, user_email)
    VALUES (p_recipe_id, v_user_email);
    RETURN jsonb_build_object('liked', true);
  END IF;
END;
$func$;

GRANT EXECUTE ON FUNCTION toggle_recipe_like(UUID) TO "anon";

-- =============================================================================
-- Update recipes_and_categories View to include is_liked
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

-- =============================================================================
-- View for Fetching Liked Recipes
-- =============================================================================

-- View that returns liked recipes with full recipe data for the current user
CREATE OR REPLACE VIEW liked_recipes AS
SELECT
  rac.*,
  rl.date_published as liked_at
FROM recipe_likes rl
INNER JOIN recipes_and_categories rac ON rac.id = rl.recipe_id
WHERE rl.user_email = current_setting('request.jwt.claims', true)::jsonb->>'email';

GRANT SELECT ON liked_recipes TO "anon";
