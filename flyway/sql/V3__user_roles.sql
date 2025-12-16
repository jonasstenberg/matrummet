-- V3: Add user roles with admin privileges for category management
-- Implements role-based access control for categories while maintaining backward compatibility

-- =============================================================================
-- Add role column to users table
-- =============================================================================

ALTER TABLE users
  ADD COLUMN role TEXT DEFAULT 'user' NOT NULL CHECK (role IN ('user', 'admin'));

-- =============================================================================
-- Helper function to check if current user is admin
-- =============================================================================

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  user_role TEXT;
BEGIN
  -- Get the email from JWT claims
  SELECT u.role INTO user_role
  FROM users u
  WHERE u.email = current_setting('request.jwt.claims', true)::jsonb->>'email';

  RETURN user_role = 'admin';
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$func$;

GRANT EXECUTE ON FUNCTION is_admin() TO "anon";

-- =============================================================================
-- Update categories RLS policies
-- =============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS categories_policy_insert ON categories;
DROP POLICY IF EXISTS categories_policy_update ON categories;
DROP POLICY IF EXISTS categories_policy_delete ON categories;

-- SELECT: Keep public (anyone can view categories)
-- Already defined in V1, no change needed

-- INSERT: Only admins can create categories directly
-- Note: insert_recipe() and update_recipe() will use SECURITY DEFINER to bypass this
CREATE POLICY categories_policy_insert
  ON categories
  FOR INSERT
  WITH CHECK (is_admin());

-- UPDATE: Only admins can rename categories
CREATE POLICY categories_policy_update
  ON categories
  FOR UPDATE
  USING (is_admin());

-- DELETE: Only admins can delete categories
CREATE POLICY categories_policy_delete
  ON categories
  FOR DELETE
  USING (is_admin());

-- =============================================================================
-- Update insert_recipe and update_recipe to use SECURITY DEFINER
-- =============================================================================

-- This allows regular users to create categories via recipes
-- even though they can't INSERT into categories directly

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
  new_recipe_id UUID;
  cat TEXT;
  cat_id UUID;
  ing JSONB;
  instr JSONB;
  current_group_id UUID;
  group_sort INTEGER := 0;
  ingredient_sort INTEGER := 0;
BEGIN
  -- Insert into the recipes table
  INSERT INTO recipes(name, author, url, recipe_yield, recipe_yield_name, prep_time, cook_time, cuisine, description, image, thumbnail)
  VALUES(p_name, p_author, p_url, p_recipe_yield, p_recipe_yield_name, p_prep_time, p_cook_time, p_cuisine, p_description, p_image, p_thumbnail)
  RETURNING id INTO new_recipe_id;

  -- Handle categories
  IF p_categories IS NOT NULL THEN
    FOREACH cat IN ARRAY p_categories
    LOOP
      SELECT id INTO cat_id FROM categories WHERE categories.name = cat;
      IF cat_id IS NULL THEN
        INSERT INTO categories(name) VALUES(cat) RETURNING id INTO cat_id;
      END IF;
      INSERT INTO recipe_categories(recipe, category) VALUES(new_recipe_id, cat_id);
    END LOOP;
  END IF;

  -- Handle ingredients (with inline group markers)
  current_group_id := NULL;
  IF p_ingredients IS NOT NULL THEN
    FOREACH ing IN ARRAY p_ingredients
    LOOP
      -- Check if this is a group marker
      IF ing ? 'group' THEN
        INSERT INTO ingredient_groups(recipe_id, name, sort_order)
        VALUES(new_recipe_id, ing->>'group', group_sort)
        RETURNING id INTO current_group_id;
        group_sort := group_sort + 1;
        ingredient_sort := 0;
      ELSE
        -- Regular ingredient
        INSERT INTO ingredients(recipe_id, name, measurement, quantity, group_id, sort_order)
        VALUES(new_recipe_id, ing->>'name', ing->>'measurement', ing->>'quantity', current_group_id, ingredient_sort);
        ingredient_sort := ingredient_sort + 1;
      END IF;
    END LOOP;
  END IF;

  -- Handle instructions
  IF p_instructions IS NOT NULL THEN
    FOREACH instr IN ARRAY p_instructions
    LOOP
      INSERT INTO instructions(recipe_id, step)
      VALUES(new_recipe_id, instr->>'step');
    END LOOP;
  END IF;

  RETURN new_recipe_id;
END;
$func$;

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
  cat TEXT;
  cat_id UUID;
  ing JSONB;
  instr JSONB;
  current_group_id UUID;
  group_sort INTEGER := 0;
  ingredient_sort INTEGER := 0;
BEGIN
  -- Update the recipes table
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

  -- Handle categories: delete and recreate
  DELETE FROM recipe_categories WHERE recipe = p_recipe_id;

  IF p_categories IS NOT NULL THEN
    FOREACH cat IN ARRAY p_categories
    LOOP
      SELECT id INTO cat_id FROM categories WHERE categories.name = cat;
      IF cat_id IS NULL THEN
        INSERT INTO categories(name) VALUES(cat) RETURNING id INTO cat_id;
      END IF;
      INSERT INTO recipe_categories(recipe, category) VALUES(p_recipe_id, cat_id);
    END LOOP;
  END IF;

  -- Handle ingredients: delete groups and ingredients, then recreate
  -- (Deleting groups will cascade to set group_id to NULL, then we delete ingredients)
  DELETE FROM ingredient_groups WHERE recipe_id = p_recipe_id;
  DELETE FROM ingredients WHERE recipe_id = p_recipe_id;

  current_group_id := NULL;
  IF p_ingredients IS NOT NULL THEN
    FOREACH ing IN ARRAY p_ingredients
    LOOP
      -- Check if this is a group marker
      IF ing ? 'group' THEN
        INSERT INTO ingredient_groups(recipe_id, name, sort_order)
        VALUES(p_recipe_id, ing->>'group', group_sort)
        RETURNING id INTO current_group_id;
        group_sort := group_sort + 1;
        ingredient_sort := 0;
      ELSE
        -- Regular ingredient
        INSERT INTO ingredients(recipe_id, name, measurement, quantity, group_id, sort_order)
        VALUES(p_recipe_id, ing->>'name', ing->>'measurement', ing->>'quantity', current_group_id, ingredient_sort);
        ingredient_sort := ingredient_sort + 1;
      END IF;
    END LOOP;
  END IF;

  -- Handle instructions: delete and recreate
  DELETE FROM instructions WHERE recipe_id = p_recipe_id;

  IF p_instructions IS NOT NULL THEN
    FOREACH instr IN ARRAY p_instructions
    LOOP
      INSERT INTO instructions(recipe_id, step)
      VALUES(p_recipe_id, instr->>'step');
    END LOOP;
  END IF;
END;
$func$;

-- =============================================================================
-- Promote specific user to admin
-- =============================================================================

UPDATE users
SET role = 'admin'
WHERE email = 'jonas@stenberg.io';
