-- V28: Security Hardening
--
-- This migration addresses additional security vulnerabilities:
--
-- 1. Category spam prevention - Rate limit category creation (10 new categories per user per hour)
-- 2. DoS via unbounded arrays - Add size limits to insert_recipe()/update_recipe()
--    - Max 100 ingredients
--    - Max 100 instructions
--    - Max 20 categories
-- 3. Restrict email_templates SELECT - Change from public to admin-only
-- 4. Restrict email_service role - Create minimal view instead of full users table access
-- 5. Add password confirmation to delete_account() - Require password verification
-- 6. Standardize error messages - Use generic errors to prevent resource enumeration
-- 7. Fix trigger error message - Remove role disclosure from prevent_role_escalation()

-- =============================================================================
-- SECTION 1: Add category creation rate limiting type
-- =============================================================================

-- Add 'category_creation' to the rate_limit_attempts check constraint
ALTER TABLE rate_limit_attempts
  DROP CONSTRAINT IF EXISTS rate_limit_attempts_attempt_type_check;

ALTER TABLE rate_limit_attempts
  ADD CONSTRAINT rate_limit_attempts_attempt_type_check
  CHECK (attempt_type IN ('login', 'signup_domain', 'api_key', 'category_creation'));

-- =============================================================================
-- SECTION 2: Update insert_recipe() with array size limits and category rate limiting
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

        INSERT INTO ingredients(recipe_id, name, measurement, quantity, group_id, sort_order, food_id, unit_id)
        VALUES(new_recipe_id, ing->>'name', ing->>'measurement', ing->>'quantity', current_ingredient_group_id, ingredient_sort, v_food_id, v_unit_id);
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
-- SECTION 3: Update update_recipe() with array size limits and category rate limiting
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
        INSERT INTO ingredients(recipe_id, name, measurement, quantity, group_id, sort_order, food_id, unit_id)
        VALUES(p_recipe_id, ing->>'name', ing->>'measurement', ing->>'quantity', current_ingredient_group_id, ingredient_sort, v_food_id, v_unit_id);
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
-- SECTION 4: Restrict email_templates SELECT to admin-only
-- =============================================================================

DROP POLICY IF EXISTS email_templates_policy_select ON email_templates;

CREATE POLICY email_templates_policy_select
  ON email_templates
  FOR SELECT
  USING (is_admin());

-- =============================================================================
-- SECTION 5: Restrict email_service role - Create minimal view
-- =============================================================================

-- Create a view with only the columns needed by email_service
CREATE OR REPLACE VIEW email_users_view AS
SELECT id, email, name FROM users;

-- Revoke SELECT on the full users table from email_service
-- Wrap in exception handler in case of permission issues
DO $$
BEGIN
    REVOKE SELECT ON users FROM email_service;
    RAISE NOTICE 'Successfully revoked SELECT on users from email_service';
EXCEPTION
    WHEN insufficient_privilege THEN
        RAISE WARNING 'Could not REVOKE SELECT ON users FROM email_service - requires ownership or grant option. Run manually.';
END;
$$;

-- Grant SELECT on the minimal view to email_service
DO $$
BEGIN
    GRANT SELECT ON email_users_view TO email_service;
    RAISE NOTICE 'Successfully granted SELECT on email_users_view to email_service';
EXCEPTION
    WHEN insufficient_privilege THEN
        RAISE WARNING 'Could not GRANT SELECT ON email_users_view TO email_service - requires ownership. Run manually.';
END;
$$;

-- =============================================================================
-- SECTION 6: Add password confirmation to delete_account()
-- =============================================================================

-- Drop the old function without password parameter
DROP FUNCTION IF EXISTS delete_account();

CREATE OR REPLACE FUNCTION delete_account(p_password TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_email TEXT;
    v_user_id UUID;
    v_user_provider TEXT;
    v_stored_password TEXT;
BEGIN
    -- Get the email from JWT claims
    v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

    -- Validate that we have a valid user email
    IF v_user_email IS NULL OR v_user_email = '' THEN
        RAISE EXCEPTION 'not-authenticated';
    END IF;

    -- Get the user ID and provider to verify user exists
    SELECT id, provider INTO v_user_id, v_user_provider
    FROM users
    WHERE email = v_user_email;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'operation-failed';
    END IF;

    -- SECURITY FIX: Require password verification for non-OAuth users
    IF v_user_provider IS NULL THEN
        -- User signed up with password, require password confirmation
        IF p_password IS NULL THEN
            RAISE EXCEPTION 'password-required';
        END IF;

        -- Get the stored password hash
        SELECT password INTO v_stored_password
        FROM user_passwords
        WHERE email = v_user_email;

        IF v_stored_password IS NULL THEN
            RAISE EXCEPTION 'operation-failed';
        END IF;

        -- Verify the password
        IF v_stored_password <> crypt(p_password, v_stored_password) THEN
            RAISE EXCEPTION 'invalid-password';
        END IF;
    END IF;
    -- OAuth users can delete without password (they authenticated via OAuth provider)

    -- Delete the user
    -- This will:
    -- 1. Cascade delete from user_passwords (ON DELETE CASCADE)
    -- 2. Cascade delete from user_email_preferences (ON DELETE CASCADE)
    -- 3. Cascade delete from password_reset_tokens (ON DELETE CASCADE)
    -- 4. Set recipes.owner to NULL (ON DELETE SET NULL)
    -- 5. Cascade delete from email_messages.recipient_user_id (ON DELETE SET NULL)
    DELETE FROM users WHERE id = v_user_id;

    RETURN jsonb_build_object('success', true, 'message', 'Account deleted successfully');
END;
$$;

COMMENT ON FUNCTION delete_account(TEXT) IS
    'Deletes the current user account. Requires password for non-OAuth users. '
    'Recipes are preserved with NULL owner. '
    'User passwords, email preferences, and password reset tokens are deleted.';

-- Grant execute to anon role (authenticated users via PostgREST)
GRANT EXECUTE ON FUNCTION delete_account(TEXT) TO "anon";

-- Set the owner to recept for SECURITY DEFINER to work properly
DO $$
BEGIN
    EXECUTE format('ALTER FUNCTION delete_account(TEXT) OWNER TO %I', 'recept');
END $$;

-- =============================================================================
-- SECTION 7: Standardize error messages - toggle_recipe_like()
-- =============================================================================

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

  -- SECURITY FIX: Generic error to prevent resource enumeration
  IF v_recipe_owner IS NULL THEN
    RAISE EXCEPTION 'operation-failed';
  END IF;

  -- Prevent liking own recipe
  IF v_recipe_owner = v_user_email THEN
    RAISE EXCEPTION 'operation-failed';
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

-- =============================================================================
-- SECTION 8: Standardize error messages - add_recipe_to_shopping_list()
-- =============================================================================

CREATE OR REPLACE FUNCTION add_recipe_to_shopping_list(
  p_recipe_id UUID,
  p_shopping_list_id UUID DEFAULT NULL,
  p_servings INTEGER DEFAULT NULL,
  p_ingredient_ids UUID[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user_email TEXT;
  v_list_id UUID;
  v_recipe_name TEXT;
  v_recipe_yield INTEGER;
  v_scale_factor NUMERIC;
  v_added_count INTEGER := 0;
  v_ingredient RECORD;
  v_existing_item_id UUID;
  v_new_item_id UUID;
  v_ingredient_quantity NUMERIC;
  v_scaled_quantity NUMERIC;
BEGIN
  -- Get current user email from JWT
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  -- Get recipe details
  SELECT name, recipe_yield INTO v_recipe_name, v_recipe_yield
  FROM recipes
  WHERE id = p_recipe_id;

  -- SECURITY FIX: Generic error to prevent resource enumeration
  IF v_recipe_name IS NULL THEN
    RAISE EXCEPTION 'operation-failed';
  END IF;

  -- Get or create shopping list
  IF p_shopping_list_id IS NOT NULL THEN
    -- Verify the list exists and belongs to the user
    SELECT id INTO v_list_id
    FROM shopping_lists
    WHERE id = p_shopping_list_id AND user_email = v_user_email;

    -- SECURITY FIX: Generic error to prevent resource enumeration
    IF v_list_id IS NULL THEN
      RAISE EXCEPTION 'operation-failed';
    END IF;
  ELSE
    v_list_id := get_or_create_default_shopping_list();
  END IF;

  -- Calculate scale factor
  IF p_servings IS NOT NULL AND v_recipe_yield IS NOT NULL AND v_recipe_yield > 0 THEN
    v_scale_factor := p_servings::NUMERIC / v_recipe_yield::NUMERIC;
  ELSE
    v_scale_factor := 1.0;
  END IF;

  -- Process each ingredient
  FOR v_ingredient IN
    SELECT
      i.id,
      i.name,
      i.measurement,
      i.quantity,
      i.food_id,
      i.unit_id
    FROM ingredients i
    WHERE i.recipe_id = p_recipe_id
      AND (p_ingredient_ids IS NULL OR i.id = ANY(p_ingredient_ids))
  LOOP
    -- Parse quantity (handle text values like "1/2", "1-2", etc.)
    BEGIN
      v_ingredient_quantity := v_ingredient.quantity::NUMERIC;
    EXCEPTION WHEN OTHERS THEN
      -- If quantity can't be parsed, default to 1
      v_ingredient_quantity := 1;
    END;

    v_scaled_quantity := v_ingredient_quantity * v_scale_factor;

    -- Check for existing unchecked item with same food_id AND unit_id
    IF v_ingredient.food_id IS NOT NULL THEN
      SELECT id INTO v_existing_item_id
      FROM shopping_list_items
      WHERE shopping_list_id = v_list_id
        AND food_id = v_ingredient.food_id
        AND unit_id IS NOT DISTINCT FROM v_ingredient.unit_id
        AND is_checked = false;
    ELSE
      v_existing_item_id := NULL;
    END IF;

    IF v_existing_item_id IS NOT NULL THEN
      -- Add quantity to existing item
      UPDATE shopping_list_items
      SET quantity = quantity + v_scaled_quantity
      WHERE id = v_existing_item_id;

      v_new_item_id := v_existing_item_id;
    ELSE
      -- Insert new item
      INSERT INTO shopping_list_items (
        shopping_list_id,
        food_id,
        unit_id,
        display_name,
        display_unit,
        quantity,
        user_email,
        sort_order
      )
      VALUES (
        v_list_id,
        v_ingredient.food_id,
        v_ingredient.unit_id,
        v_ingredient.name,
        COALESCE(v_ingredient.measurement, ''),
        v_scaled_quantity,
        v_user_email,
        (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM shopping_list_items WHERE shopping_list_id = v_list_id)
      )
      RETURNING id INTO v_new_item_id;
    END IF;

    -- Insert source tracking record
    INSERT INTO shopping_list_item_sources (
      shopping_list_item_id,
      recipe_id,
      recipe_name,
      quantity_added,
      servings_used,
      user_email
    )
    VALUES (
      v_new_item_id,
      p_recipe_id,
      v_recipe_name,
      v_scaled_quantity,
      p_servings,
      v_user_email
    );

    v_added_count := v_added_count + 1;
  END LOOP;

  -- Update shopping list modified timestamp
  UPDATE shopping_lists SET date_modified = now() WHERE id = v_list_id;

  RETURN jsonb_build_object(
    'added_count', v_added_count,
    'list_id', v_list_id
  );
END;
$func$;

-- =============================================================================
-- SECTION 9: Standardize error messages - approve_food() and reject_food()
-- =============================================================================

CREATE OR REPLACE FUNCTION approve_food(p_food_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_reviewer TEXT;
BEGIN
  -- Check admin permission
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  v_reviewer := current_setting('request.jwt.claims', true)::jsonb->>'email';

  -- Update food status
  UPDATE foods
  SET
    status = 'approved',
    reviewed_by = v_reviewer,
    reviewed_at = now()
  WHERE id = p_food_id;

  -- SECURITY FIX: Generic error to prevent resource enumeration
  IF NOT FOUND THEN
    RAISE EXCEPTION 'operation-failed';
  END IF;
END;
$func$;

CREATE OR REPLACE FUNCTION reject_food(p_food_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_reviewer TEXT;
BEGIN
  -- Check admin permission
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  v_reviewer := current_setting('request.jwt.claims', true)::jsonb->>'email';

  -- Update food status
  UPDATE foods
  SET
    status = 'rejected',
    reviewed_by = v_reviewer,
    reviewed_at = now()
  WHERE id = p_food_id;

  -- SECURITY FIX: Generic error to prevent resource enumeration
  IF NOT FOUND THEN
    RAISE EXCEPTION 'operation-failed';
  END IF;
END;
$func$;

-- =============================================================================
-- SECTION 10: Standardize error messages - Shopping list functions
-- =============================================================================

CREATE OR REPLACE FUNCTION toggle_shopping_list_item(p_item_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user_email TEXT;
  v_is_checked BOOLEAN;
  v_list_id UUID;
BEGIN
  -- Get current user email from JWT
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  -- Get current state and verify ownership
  SELECT is_checked, shopping_list_id INTO v_is_checked, v_list_id
  FROM shopping_list_items
  WHERE id = p_item_id AND user_email = v_user_email;

  -- SECURITY FIX: Generic error to prevent resource enumeration
  IF v_is_checked IS NULL THEN
    RAISE EXCEPTION 'operation-failed';
  END IF;

  -- Toggle the checked state
  UPDATE shopping_list_items
  SET
    is_checked = NOT v_is_checked,
    checked_at = CASE WHEN v_is_checked THEN NULL ELSE now() END
  WHERE id = p_item_id;

  -- Update shopping list modified timestamp
  UPDATE shopping_lists SET date_modified = now() WHERE id = v_list_id;

  RETURN jsonb_build_object('is_checked', NOT v_is_checked);
END;
$func$;

CREATE OR REPLACE FUNCTION clear_checked_items(p_shopping_list_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user_email TEXT;
  v_list_id UUID;
  v_deleted_count INTEGER;
BEGIN
  -- Get current user email from JWT
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  -- Get or default to default shopping list
  IF p_shopping_list_id IS NOT NULL THEN
    -- Verify the list exists and belongs to the user
    SELECT id INTO v_list_id
    FROM shopping_lists
    WHERE id = p_shopping_list_id AND user_email = v_user_email;

    -- SECURITY FIX: Generic error to prevent resource enumeration
    IF v_list_id IS NULL THEN
      RAISE EXCEPTION 'operation-failed';
    END IF;
  ELSE
    v_list_id := get_or_create_default_shopping_list();
  END IF;

  -- Delete checked items (sources will cascade delete)
  DELETE FROM shopping_list_items
  WHERE shopping_list_id = v_list_id AND is_checked = true;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  -- Update shopping list modified timestamp
  UPDATE shopping_lists SET date_modified = now() WHERE id = v_list_id;

  RETURN jsonb_build_object('deleted_count', v_deleted_count);
END;
$func$;

CREATE OR REPLACE FUNCTION rename_shopping_list(p_list_id UUID, p_name TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user_email TEXT;
  v_list_exists BOOLEAN;
BEGIN
  -- Get current user email from JWT
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  -- Validate name
  IF p_name IS NULL OR LENGTH(TRIM(p_name)) < 1 THEN
    RAISE EXCEPTION 'invalid-list-name';
  END IF;

  -- Check if list exists and belongs to user
  SELECT EXISTS (
    SELECT 1 FROM shopping_lists
    WHERE id = p_list_id AND user_email = v_user_email
  ) INTO v_list_exists;

  -- SECURITY FIX: Generic error to prevent resource enumeration
  IF NOT v_list_exists THEN
    RAISE EXCEPTION 'operation-failed';
  END IF;

  -- Update the list name
  UPDATE shopping_lists
  SET name = TRIM(p_name)
  WHERE id = p_list_id AND user_email = v_user_email;
END;
$func$;

CREATE OR REPLACE FUNCTION delete_shopping_list(p_list_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user_email TEXT;
  v_list_record RECORD;
  v_list_count INTEGER;
  v_new_default_id UUID;
BEGIN
  -- Get current user email from JWT
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  -- Get the list details
  SELECT id, is_default INTO v_list_record
  FROM shopping_lists
  WHERE id = p_list_id AND user_email = v_user_email;

  -- SECURITY FIX: Generic error to prevent resource enumeration
  IF v_list_record.id IS NULL THEN
    RAISE EXCEPTION 'operation-failed';
  END IF;

  -- Count user's lists
  SELECT COUNT(*) INTO v_list_count
  FROM shopping_lists
  WHERE user_email = v_user_email;

  -- If deleting the default list and there are other lists, assign a new default
  IF v_list_record.is_default AND v_list_count > 1 THEN
    -- Find another list to make default (most recently modified)
    SELECT id INTO v_new_default_id
    FROM shopping_lists
    WHERE user_email = v_user_email AND id != p_list_id
    ORDER BY date_modified DESC
    LIMIT 1;

    UPDATE shopping_lists
    SET is_default = true
    WHERE id = v_new_default_id;
  END IF;

  -- Delete the list (items will cascade delete)
  DELETE FROM shopping_lists
  WHERE id = p_list_id AND user_email = v_user_email;
END;
$func$;

CREATE OR REPLACE FUNCTION set_default_shopping_list(p_list_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user_email TEXT;
  v_list_exists BOOLEAN;
BEGIN
  -- Get current user email from JWT
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  -- Check if list exists and belongs to user
  SELECT EXISTS (
    SELECT 1 FROM shopping_lists
    WHERE id = p_list_id AND user_email = v_user_email
  ) INTO v_list_exists;

  -- SECURITY FIX: Generic error to prevent resource enumeration
  IF NOT v_list_exists THEN
    RAISE EXCEPTION 'operation-failed';
  END IF;

  -- Remove default from all other lists
  UPDATE shopping_lists
  SET is_default = false
  WHERE user_email = v_user_email AND is_default = true;

  -- Set the new default
  UPDATE shopping_lists
  SET is_default = true
  WHERE id = p_list_id AND user_email = v_user_email;
END;
$func$;

CREATE OR REPLACE FUNCTION revoke_api_key(p_key_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user_email TEXT;
  v_key_exists BOOLEAN;
BEGIN
  -- Get current user email from JWT
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  -- Check if key exists and belongs to user
  SELECT EXISTS (
    SELECT 1 FROM user_api_keys
    WHERE id = p_key_id AND user_email = v_user_email
  ) INTO v_key_exists;

  -- SECURITY FIX: Generic error to prevent resource enumeration
  IF NOT v_key_exists THEN
    RAISE EXCEPTION 'operation-failed';
  END IF;

  -- Revoke the key
  UPDATE user_api_keys
  SET is_active = false
  WHERE id = p_key_id AND user_email = v_user_email;

  RETURN jsonb_build_object('revoked', true);
END;
$func$;

-- =============================================================================
-- SECTION 11: Fix prevent_role_escalation() trigger - Remove role disclosure
-- =============================================================================

CREATE OR REPLACE FUNCTION prevent_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  current_user_email TEXT;
  current_user_role TEXT;
BEGIN
  -- Only check if role column is being changed
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    BEGIN
      -- Get current user email from JWT (with error handling)
      current_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';
    EXCEPTION
      WHEN OTHERS THEN
        current_user_email := NULL;
    END;

    -- If no JWT email, deny the change (not authenticated)
    IF current_user_email IS NULL THEN
      RAISE EXCEPTION 'permission-denied'
        USING HINT = 'Authentication required',
              ERRCODE = '42501';
    END IF;

    -- Get current user's role from database
    SELECT role INTO current_user_role
    FROM users
    WHERE email = current_user_email;

    -- SECURITY FIX: Generic error message - do not disclose role
    IF current_user_role IS NULL OR current_user_role != 'admin' THEN
      RAISE EXCEPTION 'permission-denied'
        USING HINT = 'Insufficient privileges',
              ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$func$;

COMMENT ON FUNCTION prevent_role_escalation() IS
'Trigger function that prevents non-admin users from modifying the role column. '
'Validates JWT claims and checks admin status before allowing role changes. '
'Uses generic error messages to prevent information disclosure.';

-- =============================================================================
-- Documentation
-- =============================================================================

COMMENT ON FUNCTION insert_recipe IS
'Creates a new recipe with categories, ingredients, and instructions. '
'Rate limits category creation to 10 new categories per user per hour. '
'Limits arrays: max 20 categories, 100 ingredients, 100 instructions.';

COMMENT ON FUNCTION update_recipe IS
'Updates an existing recipe with ownership verification. '
'Rate limits category creation to 10 new categories per user per hour. '
'Limits arrays: max 20 categories, 100 ingredients, 100 instructions.';

COMMENT ON POLICY email_templates_policy_select ON email_templates IS
'Only admins can read email templates to prevent template content disclosure.';

COMMENT ON VIEW email_users_view IS
'Minimal view of users table for email_service role. Only exposes id, email, and name.';
