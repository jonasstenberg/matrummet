-- V44: Combined Fixes
--
-- This migration combines several fixes and improvements:
--
-- 1. RATE LIMITING REMOVAL
--    - Remove rate limiting from signup, login, validate_api_key, insert_recipe, update_recipe
--    - Drop rate limiting infrastructure (functions and table)
--
-- 2. PASSWORD VALIDATION FIX
--    - Fix case-sensitive regex for uppercase/lowercase checks in signup function
--
-- 3. API KEY FUNCTION FIXES
--    - Grant EXECUTE permissions for get_user_api_keys, revoke_api_key, create_user_api_key
--    - Fix revoke_api_key to use 'key-not-found' error message
--
-- 4. FIND_RECIPES_FROM_PANTRY FIX
--    - Fix return type to match find_recipes_by_ingredients columns
--
-- 5. SEARCH_FOODS EDGE CASE HANDLING
--    - Handle empty/whitespace queries gracefully
--    - Escape special characters for ILIKE
--    - Truncate very long queries
--    - Safe tsquery creation with fallback
--
-- 6. DELETE_ALL_USER_RECIPES FUNCTION
--    - Add function for test cleanup
--
-- 7. SEARCH TEXT TRIGGER PERMISSIONS
--    - Grant EXECUTE on search text functions to anon role
--
-- 8. INGREDIENTS/INSTRUCTIONS RLS FIX
--    - Fix INSERT policies to verify recipe ownership
--
-- 9. GET_OR_CREATE_FOOD FIX
--    - Handle orphaned pending foods (created by deleted users)
--
-- 10. FIND_RECIPES_BY_INGREDIENTS SECURITY FIX
--    - Use SECURITY DEFINER to bypass RLS for missing_food_names lookup


-- =============================================================================
-- SECTION 1: DROP RATE LIMITING INFRASTRUCTURE
-- =============================================================================
-- Drop functions first, then table

DROP FUNCTION IF EXISTS check_rate_limit(text, text, integer, integer, integer);
DROP FUNCTION IF EXISTS record_failed_attempt(text, text, integer);
DROP FUNCTION IF EXISTS clear_rate_limit(text, text);
DROP FUNCTION IF EXISTS cleanup_rate_limit_attempts(integer);
DROP FUNCTION IF EXISTS extract_email_domain(text);

DROP TABLE IF EXISTS rate_limit_attempts;


-- =============================================================================
-- SECTION 2: AUTHENTICATION FUNCTIONS (without rate limiting)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- signup function (with fixed password validation regex)
-- -----------------------------------------------------------------------------
-- The password validation uses case-sensitive regex (~) to properly validate
-- that passwords contain both uppercase AND lowercase letters.
-- Previous version used case-insensitive (~*) which matched any letter for both checks.

CREATE OR REPLACE FUNCTION signup (p_name text, p_email text, p_password text default null, p_provider text default null)
    RETURNS users
    AS $func$
DECLARE
    _user_id uuid;
    _result users;
BEGIN
    IF p_name IS NULL OR length(p_name) < 1 OR length(p_name) > 255 THEN
        RAISE EXCEPTION 'invalid-name';
    END IF;

    IF p_provider IS NULL THEN
        IF p_password IS NULL OR
           LENGTH(p_password) < 8 OR
           LENGTH(p_password) > 72 OR
           NOT (p_password ~ '[A-Z]') OR  -- case-sensitive: must have uppercase
           NOT (p_password ~ '[a-z]') OR  -- case-sensitive: must have lowercase
           NOT (p_password ~ '\d') THEN
            RAISE EXCEPTION 'password-not-meet-requirements';
        END IF;
    END IF;

    SELECT u.id INTO _user_id FROM users u WHERE u.email = p_email;

    IF _user_id IS NOT NULL THEN
        RAISE EXCEPTION 'signup-failed';
    ELSE
        INSERT INTO users (name, email, provider, owner) VALUES (p_name, p_email, p_provider, p_email)
        RETURNING id INTO _user_id;

        IF p_provider IS NULL THEN
            INSERT INTO user_passwords (email, password, owner) VALUES (p_email, p_password, p_email);
        END IF;
    END IF;

    SELECT * INTO _result FROM users WHERE id = _user_id;
    RETURN _result;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- -----------------------------------------------------------------------------
-- login function (without rate limiting)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION login(login_email TEXT, login_password TEXT)
    RETURNS users
    AS $func$
DECLARE
    result users;
    stored_password TEXT;
    dummy_hash TEXT := '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.I4e1rq4yY1.HCi';
BEGIN
    SELECT user_passwords.password
    INTO stored_password
    FROM users
    INNER JOIN user_passwords ON users.email = user_passwords.email
    WHERE users.email = login_email;

    IF stored_password IS NULL THEN
        PERFORM crypt(login_password, dummy_hash);
        RAISE EXCEPTION 'invalid user or password';
    END IF;

    IF stored_password <> crypt(login_password, stored_password) THEN
        RAISE EXCEPTION 'invalid user or password';
    END IF;

    SELECT * INTO result FROM users WHERE email = login_email;
    RETURN result;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- =============================================================================
-- SECTION 3: API KEY FUNCTIONS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- validate_api_key (without rate limiting)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION validate_api_key(p_api_key TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_key_prefix TEXT;
  v_key_record RECORD;
BEGIN
  IF p_api_key IS NULL OR LENGTH(p_api_key) < 8 THEN
    RETURN NULL;
  END IF;

  v_key_prefix := LEFT(p_api_key, 8);

  FOR v_key_record IN
    SELECT id, user_email, api_key_hash, expires_at, is_active
    FROM user_api_keys
    WHERE api_key_prefix = v_key_prefix AND is_active = true
  LOOP
    IF v_key_record.api_key_hash = crypt(p_api_key, v_key_record.api_key_hash) THEN
      IF v_key_record.expires_at IS NOT NULL AND v_key_record.expires_at < now() THEN
        UPDATE user_api_keys SET is_active = false WHERE id = v_key_record.id;
        RETURN NULL;
      END IF;

      UPDATE user_api_keys SET last_used_at = now() WHERE id = v_key_record.id;
      RETURN v_key_record.user_email;
    END IF;
  END LOOP;

  RETURN NULL;
END;
$func$;

-- -----------------------------------------------------------------------------
-- revoke_api_key (with descriptive error message)
-- -----------------------------------------------------------------------------

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

  -- Return descriptive error for missing/unauthorized keys
  IF NOT v_key_exists THEN
    RAISE EXCEPTION 'key-not-found';
  END IF;

  -- Revoke the key
  UPDATE user_api_keys
  SET is_active = false
  WHERE id = p_key_id AND user_email = v_user_email;

  RETURN jsonb_build_object('revoked', true);
END;
$func$;

-- -----------------------------------------------------------------------------
-- API key function grants
-- -----------------------------------------------------------------------------

GRANT EXECUTE ON FUNCTION get_user_api_keys() TO "authenticated";
GRANT EXECUTE ON FUNCTION revoke_api_key(UUID) TO "authenticated";
GRANT EXECUTE ON FUNCTION create_user_api_key(TEXT) TO "authenticated";


-- =============================================================================
-- SECTION 4: RECIPE FUNCTIONS (without rate limiting)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- insert_recipe
-- -----------------------------------------------------------------------------

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

  RETURN new_recipe_id;
END;
$func$;

-- -----------------------------------------------------------------------------
-- update_recipe
-- -----------------------------------------------------------------------------

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
END;
$func$;

-- -----------------------------------------------------------------------------
-- delete_all_user_recipes (for test cleanup)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION delete_all_user_recipes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_email TEXT;
BEGIN
  -- Get current user email from JWT
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  -- Delete all recipes owned by this user
  DELETE FROM recipes WHERE owner = v_user_email;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_all_user_recipes() TO authenticated;


-- =============================================================================
-- SECTION 5: PANTRY/SEARCH FUNCTIONS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- find_recipes_from_pantry (fixed return type)
-- -----------------------------------------------------------------------------
-- The declared return type now matches the columns returned by find_recipes_by_ingredients

DROP FUNCTION IF EXISTS find_recipes_from_pantry(INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION find_recipes_from_pantry(
  p_min_match_percentage INTEGER DEFAULT 50,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  recipe_id UUID,
  name TEXT,
  description TEXT,
  image TEXT,
  categories TEXT[],
  total_ingredients INTEGER,
  matching_ingredients INTEGER,
  match_percentage INTEGER,
  missing_food_ids UUID[],
  missing_food_names TEXT[],
  owner TEXT,
  prep_time INTEGER,
  cook_time INTEGER,
  recipe_yield INTEGER,
  recipe_yield_name TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user_email TEXT;
  v_home_id UUID;
  v_pantry_food_ids UUID[];
BEGIN
  -- Get current user email from JWT
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  -- Get user's home_id
  SELECT home_id INTO v_home_id
  FROM users
  WHERE email = v_user_email;

  -- If user has no home, return empty result (not an error)
  IF v_home_id IS NULL THEN
    RETURN;
  END IF;

  -- Get all food_ids from home's pantry
  SELECT ARRAY_AGG(up.food_id)
  INTO v_pantry_food_ids
  FROM user_pantry up
  WHERE up.home_id = v_home_id;

  -- If pantry is empty, return no results
  IF v_pantry_food_ids IS NULL OR array_length(v_pantry_food_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  -- Use the main function to find matching recipes
  RETURN QUERY
  SELECT *
  FROM find_recipes_by_ingredients(v_pantry_food_ids, NULL, p_min_match_percentage, p_limit);
END;
$func$;

GRANT EXECUTE ON FUNCTION find_recipes_from_pantry(INTEGER, INTEGER) TO "authenticated";

COMMENT ON FUNCTION find_recipes_from_pantry IS
  'Find recipes that can be made with ingredients in the user''s home pantry.
   Convenience wrapper around find_recipes_by_ingredients that automatically
   uses the authenticated user''s home pantry contents.';

-- -----------------------------------------------------------------------------
-- search_foods (with edge case handling)
-- -----------------------------------------------------------------------------
-- Handles:
-- - Empty/whitespace queries: return empty array instead of error
-- - Special characters: escape for safe ILIKE usage
-- - Very long queries: truncate to 200 characters
-- - SQL injection: safely handle malicious input via plainto_tsquery

CREATE OR REPLACE FUNCTION search_foods(
  p_query TEXT,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  rank REAL,
  status food_status,
  is_own_pending BOOLEAN
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $func$
DECLARE
  v_sanitized_query TEXT;
  v_tsquery tsquery;
BEGIN
  -- Handle NULL, empty, or whitespace-only queries - return empty result
  IF p_query IS NULL OR trim(p_query) = '' THEN
    RETURN;
  END IF;

  -- Truncate very long queries to 200 characters to prevent performance issues
  v_sanitized_query := left(trim(p_query), 200);

  -- Escape special LIKE pattern characters (%, _, \) for safe ILIKE usage
  -- This prevents these characters from acting as wildcards
  v_sanitized_query := replace(v_sanitized_query, '\', '\\');
  v_sanitized_query := replace(v_sanitized_query, '%', '\%');
  v_sanitized_query := replace(v_sanitized_query, '_', '\_');

  -- Try to create a tsquery from the input
  -- plainto_tsquery handles most special characters safely, but empty results
  -- after processing can cause issues
  BEGIN
    v_tsquery := plainto_tsquery('swedish'::regconfig, v_sanitized_query);
  EXCEPTION WHEN OTHERS THEN
    -- If tsquery creation fails, we'll just use ILIKE matching
    v_tsquery := NULL;
  END;

  -- If tsquery is empty (e.g., query was all stop words or special chars),
  -- fall back to ILIKE-only matching
  IF v_tsquery IS NULL OR v_tsquery = ''::tsquery THEN
    RETURN QUERY
    SELECT
      f.id,
      f.name,
      0.5::REAL AS rank,
      f.status,
      f.status = 'pending' AND f.created_by = current_setting('request.jwt.claims', true)::jsonb->>'email' AS is_own_pending
    FROM foods f
    WHERE (
        f.status = 'approved'
        OR (f.status = 'pending' AND f.created_by = current_setting('request.jwt.claims', true)::jsonb->>'email')
      )
      AND f.name ILIKE v_sanitized_query || '%' ESCAPE '\'
    ORDER BY
      CASE WHEN f.status = 'approved' THEN 0 ELSE 1 END,
      CASE
        WHEN lower(f.name) = lower(v_sanitized_query) THEN 0
        WHEN lower(f.name) LIKE lower(v_sanitized_query) || '%' ESCAPE '\' THEN 1
        ELSE 2
      END,
      f.name
    LIMIT p_limit;
    RETURN;
  END IF;

  -- Full search with both tsquery and ILIKE
  RETURN QUERY
  SELECT
    f.id,
    f.name,
    CASE
      WHEN lower(f.name) = lower(v_sanitized_query) THEN 1.0
      WHEN lower(f.name) LIKE lower(v_sanitized_query) || '%' ESCAPE '\' THEN 0.9
      ELSE ts_rank(f.tsv, v_tsquery)
    END AS rank,
    f.status,
    f.status = 'pending' AND f.created_by = current_setting('request.jwt.claims', true)::jsonb->>'email' AS is_own_pending
  FROM foods f
  WHERE (
      f.status = 'approved'
      OR (f.status = 'pending' AND f.created_by = current_setting('request.jwt.claims', true)::jsonb->>'email')
    )
    AND (
      f.tsv @@ v_tsquery
      OR f.name ILIKE v_sanitized_query || '%' ESCAPE '\'
    )
  ORDER BY
    CASE WHEN f.status = 'approved' THEN 0 ELSE 1 END,
    CASE
      WHEN lower(f.name) = lower(v_sanitized_query) THEN 0
      WHEN lower(f.name) LIKE lower(v_sanitized_query) || '%' ESCAPE '\' THEN 1
      ELSE 2
    END,
    ts_rank(f.tsv, v_tsquery) DESC,
    f.name
  LIMIT p_limit;
END;
$func$;

GRANT EXECUTE ON FUNCTION search_foods(TEXT, INTEGER) TO anon;


-- =============================================================================
-- SECTION 6: SEARCH TEXT TRIGGER PERMISSIONS
-- =============================================================================
-- Grant EXECUTE permissions on search text functions to anon role.
-- These functions are SECURITY INVOKER (default), meaning they execute with
-- the caller's permissions. When the anon role modifies data via PostgREST,
-- it needs permission to execute these trigger functions.

GRANT EXECUTE ON FUNCTION rebuild_recipe_search_text(UUID) TO "anon";
GRANT EXECUTE ON FUNCTION trigger_ingredient_search_text() TO "anon";
GRANT EXECUTE ON FUNCTION trigger_recipe_search_text() TO "anon";
GRANT EXECUTE ON FUNCTION trigger_food_search_text() TO "anon";

COMMENT ON FUNCTION rebuild_recipe_search_text IS
  'Rebuilds the search_text column for a recipe, including name, description,
   ingredient names, and ingredient forms for trigram search.
   Called by triggers on ingredients table. Anon role has EXECUTE permission.';


-- =============================================================================
-- SECTION 7: RLS POLICY FIXES FOR INGREDIENTS AND INSTRUCTIONS
-- =============================================================================
-- Fix INSERT policies to verify that the recipe_id refers to a recipe owned
-- by the current user. This prevents users from inserting ingredients/instructions
-- into other users' recipes.

-- -----------------------------------------------------------------------------
-- Fix ingredients INSERT policy
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS ingredients_policy_insert ON ingredients;

CREATE POLICY ingredients_policy_insert
  ON ingredients
  FOR INSERT
  WITH CHECK (
    owner = current_setting('request.jwt.claims', true)::jsonb->>'email'
    AND EXISTS (
      SELECT 1 FROM recipes r
      WHERE r.id = recipe_id
      AND r.owner = current_setting('request.jwt.claims', true)::jsonb->>'email'
    )
  );

-- -----------------------------------------------------------------------------
-- Fix instructions INSERT policy
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS instructions_policy_insert ON instructions;

CREATE POLICY instructions_policy_insert
  ON instructions
  FOR INSERT
  WITH CHECK (
    owner = current_setting('request.jwt.claims', true)::jsonb->>'email'
    AND EXISTS (
      SELECT 1 FROM recipes r
      WHERE r.id = recipe_id
      AND r.owner = current_setting('request.jwt.claims', true)::jsonb->>'email'
    )
  );


-- =============================================================================
-- SECTION 8: FIX GET_OR_CREATE_FOOD FUNCTION
-- =============================================================================
-- Fix handling of orphaned pending foods (created by users who no longer exist).
-- The fallback SELECT now also returns pending foods even if created by someone else.

CREATE OR REPLACE FUNCTION get_or_create_food(p_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_food_id UUID;
  v_normalized_name TEXT;
  v_current_user TEXT;
  v_similar_count INT;
BEGIN
  -- Return NULL for empty/null input
  IF p_name IS NULL OR trim(p_name) = '' THEN
    RETURN NULL;
  END IF;

  v_normalized_name := trim(p_name);
  v_current_user := current_setting('request.jwt.claims', true)::jsonb->>'email';

  -- First: Check for exact match in approved foods (case-insensitive)
  SELECT id INTO v_food_id
  FROM foods
  WHERE lower(name) = lower(v_normalized_name)
    AND status = 'approved';

  IF v_food_id IS NOT NULL THEN
    RETURN v_food_id;
  END IF;

  -- Second: Check if user already has a pending food with same name
  SELECT id INTO v_food_id
  FROM foods
  WHERE lower(name) = lower(v_normalized_name)
    AND status = 'pending'
    AND created_by = v_current_user;

  IF v_food_id IS NOT NULL THEN
    RETURN v_food_id;
  END IF;

  -- Third: Check for similar foods using trigram similarity > 0.7
  -- This prevents creation of duplicate/similar foods
  SELECT COUNT(*) INTO v_similar_count
  FROM foods
  WHERE similarity(name, v_normalized_name) > 0.7
    AND status = 'approved'
    AND lower(name) != lower(v_normalized_name);

  -- If similar foods found, return NULL to signal user should review existing foods
  IF v_similar_count > 0 THEN
    RETURN NULL;
  END IF;

  -- Fourth: Create new pending food
  INSERT INTO foods (name, status, created_by)
  VALUES (v_normalized_name, 'pending', v_current_user)
  ON CONFLICT (name) DO NOTHING
  RETURNING id INTO v_food_id;

  -- If INSERT returned NULL due to conflict, select again
  -- Handle orphaned pending foods (created by users who no longer exist)
  IF v_food_id IS NULL THEN
    SELECT id INTO v_food_id
    FROM foods
    WHERE lower(name) = lower(v_normalized_name)
      AND (status = 'approved' OR status = 'pending');
  END IF;

  RETURN v_food_id;
END;
$func$;


-- =============================================================================
-- SECTION 9: FIX FIND_RECIPES_BY_INGREDIENTS SECURITY
-- =============================================================================
-- Change from SECURITY INVOKER to SECURITY DEFINER so the subquery to get
-- missing_food_names can access pending foods regardless of RLS policy.
-- The foods SELECT policy restricts pending foods to their creator, but
-- this function needs to show food names for all ingredients.

CREATE OR REPLACE FUNCTION find_recipes_by_ingredients(
  p_food_ids UUID[],
  p_user_email TEXT DEFAULT NULL,
  p_min_match_percentage INTEGER DEFAULT 50,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  recipe_id UUID,
  name TEXT,
  description TEXT,
  image TEXT,
  categories TEXT[],
  total_ingredients INTEGER,
  matching_ingredients INTEGER,
  match_percentage INTEGER,
  missing_food_ids UUID[],
  missing_food_names TEXT[],
  owner TEXT,
  prep_time INTEGER,
  cook_time INTEGER,
  recipe_yield INTEGER,
  recipe_yield_name TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  -- Guard against NULL or empty input
  IF p_food_ids IS NULL OR array_length(p_food_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH
  -- Step 1: Pre-compute match stats, using GIN index for early filtering
  match_stats AS (
    SELECT
      ris.recipe_id,
      ris.owner,
      ris.ingredient_count::INTEGER AS total_ings,
      ris.food_ids,
      -- Count matching ingredients
      (
        SELECT COUNT(*)::INTEGER
        FROM unnest(ris.food_ids) AS f(food_id)
        WHERE f.food_id = ANY(p_food_ids)
      ) AS matching_ings
    FROM recipe_ingredient_summary ris
    WHERE ris.ingredient_count > 0
      AND (p_user_email IS NULL OR ris.owner = p_user_email)
      -- GIN index filter: recipe must have at least one matching ingredient
      AND ris.food_ids && p_food_ids
  ),
  -- Step 2: Calculate percentages and filter by minimum
  filtered AS (
    SELECT
      ms.*,
      (ms.matching_ings * 100 / ms.total_ings)::INTEGER AS match_pct,
      ARRAY(SELECT unnest(ms.food_ids) EXCEPT SELECT unnest(p_food_ids)) AS missing_ids
    FROM match_stats ms
    WHERE (ms.matching_ings * 100 / ms.total_ings) >= p_min_match_percentage
  )
  -- Step 3: Join with recipes and get names
  SELECT
    f.recipe_id,
    r.name,
    r.description,
    r.image,
    COALESCE(
      (SELECT array_agg(c.name ORDER BY c.name)
       FROM recipe_categories rc JOIN categories c ON c.id = rc.category
       WHERE rc.recipe = f.recipe_id),
      ARRAY[]::TEXT[]
    ) AS categories,
    f.total_ings AS total_ingredients,
    f.matching_ings AS matching_ingredients,
    f.match_pct AS match_percentage,
    f.missing_ids AS missing_food_ids,
    COALESCE(
      (SELECT array_agg(fd.name ORDER BY fd.name)
       FROM unnest(f.missing_ids) AS mid(food_id)
       JOIN foods fd ON fd.id = mid.food_id),
      ARRAY[]::TEXT[]
    ) AS missing_food_names,
    f.owner,
    r.prep_time,
    r.cook_time,
    r.recipe_yield,
    r.recipe_yield_name
  FROM filtered f
  JOIN recipes r ON r.id = f.recipe_id
  ORDER BY
    f.match_pct DESC,
    f.matching_ings DESC,
    f.total_ings ASC
  LIMIT p_limit;
END;
$func$;
