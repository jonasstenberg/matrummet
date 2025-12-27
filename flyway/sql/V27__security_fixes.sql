-- V27: Comprehensive Security Fixes
--
-- This migration addresses multiple security vulnerabilities identified in the security audit:
--
-- CRITICAL:
-- 1. reset_password() - Missing JWT caller validation (could reset other users' passwords)
-- 2. update_recipe() - Missing ownership verification (SECURITY DEFINER bypass)
--
-- HIGH:
-- 3. GRANT ALL to anon - Includes unnecessary TRUNCATE, REFERENCES, TRIGGER
-- 4. Missing rate limiting on login/signup - Brute force vulnerability
-- 5. email_service role has LOGIN - Should be NOLOGIN
-- 6. insert_recipe() - Missing authentication check
-- 7. Missing RLS bypass policies for V25/V26 SECURITY DEFINER functions
--
-- MEDIUM:
-- 8. login() timing attack - User enumeration via response time (invalid dummy hash)
-- 9. signup() user enumeration - "already-exists" reveals registered emails
-- 10. signup_provider() OAuth linking - Returns user data without provider verification
-- 11. user_passwords DELETE grant - Should only be via SECURITY DEFINER functions
-- 12. validate_api_key() brute-force - No rate limiting on API key validation
-- 13. Bcrypt cost factor too low (6) - Should be 12
-- 14. No max password length - bcrypt DoS vulnerability
-- 15. Missing search_path on utility functions

-- =============================================================================
-- SECTION 1: Rate Limiting Infrastructure
-- =============================================================================

-- Rate limit attempts table
CREATE TABLE IF NOT EXISTS rate_limit_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier TEXT NOT NULL,
    attempt_type TEXT NOT NULL CHECK (attempt_type IN ('login', 'signup_domain', 'api_key')),
    attempt_count INTEGER NOT NULL DEFAULT 1 CHECK (attempt_count >= 0),
    first_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    locked_until TIMESTAMPTZ,
    UNIQUE (identifier, attempt_type)
);

CREATE INDEX IF NOT EXISTS rate_limit_attempts_identifier_type_idx
    ON rate_limit_attempts (identifier, attempt_type);
CREATE INDEX IF NOT EXISTS rate_limit_attempts_last_attempt_idx
    ON rate_limit_attempts (last_attempt_at);
CREATE INDEX IF NOT EXISTS rate_limit_attempts_locked_until_idx
    ON rate_limit_attempts (locked_until) WHERE locked_until IS NOT NULL;

-- Only recept role can access (used by SECURITY DEFINER functions)
GRANT SELECT, INSERT, UPDATE, DELETE ON rate_limit_attempts TO recept;

-- Check if an identifier is rate limited
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_identifier TEXT,
    p_attempt_type TEXT,
    p_max_attempts INTEGER,
    p_lockout_minutes INTEGER,
    p_window_minutes INTEGER DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
    v_record rate_limit_attempts%ROWTYPE;
    v_window_start TIMESTAMPTZ;
BEGIN
    SELECT * INTO v_record
    FROM rate_limit_attempts
    WHERE identifier = p_identifier AND attempt_type = p_attempt_type;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    IF v_record.locked_until IS NOT NULL AND v_record.locked_until > now() THEN
        RETURN TRUE;
    END IF;

    IF p_window_minutes IS NOT NULL THEN
        v_window_start := now() - (p_window_minutes || ' minutes')::INTERVAL;
        IF v_record.first_attempt_at < v_window_start THEN
            RETURN FALSE;
        END IF;
    END IF;

    IF v_record.attempt_count >= p_max_attempts THEN
        IF v_record.locked_until IS NULL THEN
            UPDATE rate_limit_attempts
            SET locked_until = now() + (p_lockout_minutes || ' minutes')::INTERVAL
            WHERE identifier = p_identifier AND attempt_type = p_attempt_type;
        END IF;
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$func$;

-- Record a failed attempt
CREATE OR REPLACE FUNCTION record_failed_attempt(
    p_identifier TEXT,
    p_attempt_type TEXT,
    p_window_minutes INTEGER DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
    v_window_start TIMESTAMPTZ;
BEGIN
    IF p_window_minutes IS NOT NULL THEN
        v_window_start := now() - (p_window_minutes || ' minutes')::INTERVAL;
    END IF;

    INSERT INTO rate_limit_attempts (identifier, attempt_type, attempt_count, first_attempt_at, last_attempt_at)
    VALUES (p_identifier, p_attempt_type, 1, now(), now())
    ON CONFLICT (identifier, attempt_type) DO UPDATE
    SET
        attempt_count = CASE
            WHEN p_window_minutes IS NOT NULL AND rate_limit_attempts.first_attempt_at < v_window_start THEN 1
            ELSE rate_limit_attempts.attempt_count + 1
        END,
        first_attempt_at = CASE
            WHEN p_window_minutes IS NOT NULL AND rate_limit_attempts.first_attempt_at < v_window_start THEN now()
            ELSE rate_limit_attempts.first_attempt_at
        END,
        last_attempt_at = now(),
        locked_until = CASE
            WHEN rate_limit_attempts.locked_until IS NOT NULL AND rate_limit_attempts.locked_until <= now() THEN NULL
            ELSE rate_limit_attempts.locked_until
        END;
END;
$func$;

-- Clear attempts on successful authentication
CREATE OR REPLACE FUNCTION clear_rate_limit(
    p_identifier TEXT,
    p_attempt_type TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
    DELETE FROM rate_limit_attempts
    WHERE identifier = p_identifier AND attempt_type = p_attempt_type;
END;
$func$;

-- Extract domain from email
CREATE OR REPLACE FUNCTION extract_email_domain(p_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $func$
BEGIN
    RETURN lower(split_part(p_email, '@', 2));
END;
$func$;

-- Cleanup old rate limit attempts
CREATE OR REPLACE FUNCTION cleanup_rate_limit_attempts(p_older_than_hours INTEGER DEFAULT 24)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
    v_deleted INTEGER;
BEGIN
    DELETE FROM rate_limit_attempts
    WHERE last_attempt_at < now() - (p_older_than_hours || ' hours')::INTERVAL
      AND (locked_until IS NULL OR locked_until < now());

    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$func$;

-- Set function owners
DO $$
BEGIN
    EXECUTE format('ALTER FUNCTION check_rate_limit(text, text, integer, integer, integer) OWNER TO %I', 'recept');
    EXECUTE format('ALTER FUNCTION record_failed_attempt(text, text, integer) OWNER TO %I', 'recept');
    EXECUTE format('ALTER FUNCTION clear_rate_limit(text, text) OWNER TO %I', 'recept');
    EXECUTE format('ALTER FUNCTION cleanup_rate_limit_attempts(integer) OWNER TO %I', 'recept');
END $$;

-- =============================================================================
-- SECTION 2: Fix reset_password() - Add JWT caller validation
-- CRITICAL: Prevents authenticated users from resetting other users' passwords
-- =============================================================================

CREATE OR REPLACE FUNCTION reset_password(p_email text, p_old_password text, p_new_password text)
    RETURNS void
    AS $func$
DECLARE
    stored_password text;
    jwt_email text;
BEGIN
    -- SECURITY FIX: Validate that the caller is resetting their own password
    jwt_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

    IF jwt_email IS NULL OR jwt_email <> p_email THEN
        RAISE EXCEPTION 'unauthorized-password-reset';
    END IF;

    SELECT password INTO stored_password FROM user_passwords WHERE user_passwords.email = p_email;

    IF stored_password IS NULL THEN
        RAISE EXCEPTION 'invalid-credentials';
    END IF;

    IF stored_password <> crypt(p_old_password, stored_password) THEN
        RAISE EXCEPTION 'invalid-credentials';
    END IF;

    -- SECURITY FIX: Added max length check (72 bytes = bcrypt limit) to prevent DoS
    IF LENGTH(p_new_password) < 8 OR
       LENGTH(p_new_password) > 72 OR
       NOT (p_new_password ~* '.*[A-Z].*') OR
       NOT (p_new_password ~* '.*[a-z].*') OR
       NOT (p_new_password ~ '\d') THEN
        RAISE EXCEPTION 'password-not-meet-requirements';
    END IF;

    UPDATE user_passwords
    SET password = p_new_password
    WHERE user_passwords.email = p_email;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =============================================================================
-- SECTION 3: Fix login() - Timing attack prevention + rate limiting
-- MEDIUM: Prevents user enumeration via response time
-- HIGH: Prevents brute force attacks
-- =============================================================================

CREATE OR REPLACE FUNCTION login(login_email TEXT, login_password TEXT)
    RETURNS users
    AS $func$
DECLARE
    _role NAME;
    result users;
    stored_password TEXT;
    v_is_locked BOOLEAN;
    v_normalized_email TEXT;
    -- Pre-computed bcrypt hash with cost factor 12 for constant-time comparison
    -- This is a valid hash of an arbitrary string, used only for timing attack prevention
    dummy_hash TEXT := '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.I4e1rq4yY1.HCi';
BEGIN
    v_normalized_email := lower(login_email);

    -- Check rate limit (5 attempts, 15 minute lockout)
    v_is_locked := check_rate_limit(v_normalized_email, 'login', 5, 15, NULL);
    IF v_is_locked THEN
        RAISE EXCEPTION 'too-many-attempts';
    END IF;

    -- Get stored password
    SELECT user_passwords.password
    INTO stored_password
    FROM users
    INNER JOIN user_passwords ON users.email = user_passwords.email
    WHERE users.email = login_email;

    -- SECURITY FIX: Always run bcrypt to prevent timing-based user enumeration
    IF stored_password IS NULL THEN
        PERFORM crypt(login_password, dummy_hash);
        PERFORM record_failed_attempt(v_normalized_email, 'login', NULL);
        RAISE EXCEPTION 'invalid user or password';
    END IF;

    IF stored_password <> crypt(login_password, stored_password) THEN
        PERFORM record_failed_attempt(v_normalized_email, 'login', NULL);
        RAISE EXCEPTION 'invalid user or password';
    END IF;

    -- Clear rate limit on success
    PERFORM clear_rate_limit(v_normalized_email, 'login');

    SELECT * INTO result FROM users WHERE email = login_email;
    RETURN result;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =============================================================================
-- SECTION 4: Fix signup() - User enumeration prevention + rate limiting
-- MEDIUM: Generic error prevents email enumeration
-- HIGH: Domain-based rate limiting prevents mass registration
-- =============================================================================

DROP FUNCTION IF EXISTS signup(text, text, text, text);

CREATE FUNCTION signup (p_name text, p_email text, p_password text default null, p_provider text default null)
    RETURNS users
    AS $func$
DECLARE
    _user_id uuid;
    _result users;
    v_email_domain TEXT;
    v_is_limited BOOLEAN;
BEGIN
    v_email_domain := extract_email_domain(p_email);

    -- Rate limit: 3 signups per domain per hour
    v_is_limited := check_rate_limit(v_email_domain, 'signup_domain', 3, 60, 60);
    IF v_is_limited THEN
        RAISE EXCEPTION 'too-many-signups';
    END IF;

    IF p_name IS NULL OR length(p_name) < 1 OR length(p_name) > 255 THEN
        RAISE EXCEPTION 'invalid-name';
    END IF;

    IF p_provider IS NULL THEN
        -- SECURITY FIX: Added max length check (72 bytes = bcrypt limit) to prevent DoS
        IF p_password IS NULL OR
           LENGTH(p_password) < 8 OR
           LENGTH(p_password) > 72 OR
           NOT (p_password ~* '.*[A-Z].*') OR
           NOT (p_password ~* '.*[a-z].*') OR
           NOT (p_password ~ '\d') THEN
            RAISE EXCEPTION 'password-not-meet-requirements';
        END IF;
    END IF;

    SELECT u.id INTO _user_id FROM users u WHERE u.email = p_email;

    -- SECURITY FIX: Generic error prevents user enumeration
    IF _user_id IS NOT NULL THEN
        RAISE EXCEPTION 'signup-failed';
    ELSE
        INSERT INTO users (name, email, provider, owner) VALUES (p_name, p_email, p_provider, p_email)
        RETURNING id INTO _user_id;

        IF p_provider IS NULL THEN
            INSERT INTO user_passwords (email, password, owner) VALUES (p_email, p_password, p_email);
        END IF;
    END IF;

    -- Record signup for domain rate limiting
    PERFORM record_failed_attempt(v_email_domain, 'signup_domain', 60);

    SELECT * INTO _result FROM users WHERE id = _user_id;
    RETURN _result;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION signup(TEXT, TEXT, TEXT, TEXT) TO "anon";

DO $$
BEGIN
    EXECUTE format('ALTER FUNCTION signup(text, text, text, text) OWNER TO %I', 'recept');
END $$;

-- =============================================================================
-- SECTION 5: Fix signup_provider() - OAuth account linking vulnerability
-- MEDIUM: Verifies provider matches before allowing login
-- =============================================================================

CREATE OR REPLACE FUNCTION signup_provider(p_name TEXT, p_email TEXT, p_provider TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  _user_id UUID;
  _existing_provider TEXT;
  _json_result JSONB;
BEGIN
  SELECT u.id, u.provider INTO _user_id, _existing_provider
  FROM users u
  WHERE u.email = p_email;

  IF _user_id IS NOT NULL THEN
    -- SECURITY FIX: Verify provider matches to prevent OAuth account takeover
    IF _existing_provider IS DISTINCT FROM p_provider THEN
      RAISE EXCEPTION 'provider-mismatch'
        USING HINT = 'An account with this email exists but was registered with a different provider';
    END IF;

    SELECT jsonb_build_object(
      'id', u.id,
      'name', u.name,
      'email', u.email,
      'provider', u.provider,
      'owner', u.owner,
      'role', u.role,
      'measures_system', u.measures_system
    ) INTO _json_result
    FROM users u
    WHERE u.id = _user_id;
  ELSE
    INSERT INTO users (name, email, provider, owner)
    VALUES (p_name, p_email, p_provider, p_email)
    RETURNING id INTO _user_id;

    SELECT jsonb_build_object(
      'id', u.id,
      'name', u.name,
      'email', u.email,
      'provider', u.provider,
      'owner', u.owner,
      'role', u.role,
      'measures_system', u.measures_system
    ) INTO _json_result
    FROM users u
    WHERE u.id = _user_id;
  END IF;

  RETURN _json_result;
END;
$func$;

-- =============================================================================
-- SECTION 6: Fix update_recipe() - Add ownership verification
-- CRITICAL: Prevents unauthorized recipe modification via SECURITY DEFINER bypass
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

  -- Handle categories
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
-- SECTION 7: Fix validate_api_key() - Add rate limiting
-- MEDIUM: Prevents brute-force attacks on API keys
-- =============================================================================

CREATE OR REPLACE FUNCTION validate_api_key(p_api_key TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_key_prefix TEXT;
  v_key_record RECORD;
  v_user_email TEXT;
  v_is_locked BOOLEAN;
BEGIN
  IF p_api_key IS NULL OR LENGTH(p_api_key) < 8 THEN
    RETURN NULL;
  END IF;

  v_key_prefix := LEFT(p_api_key, 8);

  -- Rate limit: 10 attempts per hour, 60 minute lockout
  v_is_locked := check_rate_limit(v_key_prefix, 'api_key', 10, 60, 60);
  IF v_is_locked THEN
    RETURN NULL;
  END IF;

  FOR v_key_record IN
    SELECT id, user_email, api_key_hash, expires_at, is_active
    FROM user_api_keys
    WHERE api_key_prefix = v_key_prefix AND is_active = true
  LOOP
    IF v_key_record.api_key_hash = crypt(p_api_key, v_key_record.api_key_hash) THEN
      IF v_key_record.expires_at IS NOT NULL AND v_key_record.expires_at < now() THEN
        UPDATE user_api_keys SET is_active = false WHERE id = v_key_record.id;
        PERFORM record_failed_attempt(v_key_prefix, 'api_key', 60);
        RETURN NULL;
      END IF;

      UPDATE user_api_keys SET last_used_at = now() WHERE id = v_key_record.id;
      PERFORM clear_rate_limit(v_key_prefix, 'api_key');
      RETURN v_key_record.user_email;
    END IF;
  END LOOP;

  PERFORM record_failed_attempt(v_key_prefix, 'api_key', 60);
  RETURN NULL;
END;
$func$;

-- =============================================================================
-- SECTION 8: Fix GRANT ALL - Replace with specific permissions
-- HIGH: Removes unnecessary TRUNCATE, REFERENCES, TRIGGER privileges
-- =============================================================================

-- Recipe-related tables
REVOKE ALL ON "recipes" FROM "anon";
GRANT SELECT, INSERT, UPDATE, DELETE ON "recipes" TO "anon";

REVOKE ALL ON "ingredients" FROM "anon";
GRANT SELECT, INSERT, UPDATE, DELETE ON "ingredients" TO "anon";

REVOKE ALL ON "instructions" FROM "anon";
GRANT SELECT, INSERT, UPDATE, DELETE ON "instructions" TO "anon";

REVOKE ALL ON "categories" FROM "anon";
GRANT SELECT, INSERT, UPDATE, DELETE ON "categories" TO "anon";

REVOKE ALL ON "recipe_categories" FROM "anon";
GRANT SELECT, INSERT, UPDATE, DELETE ON "recipe_categories" TO "anon";

-- Group tables
REVOKE ALL ON "ingredient_groups" FROM "anon";
GRANT SELECT, INSERT, UPDATE, DELETE ON "ingredient_groups" TO "anon";

REVOKE ALL ON "instruction_groups" FROM "anon";
GRANT SELECT, INSERT, UPDATE, DELETE ON "instruction_groups" TO "anon";

-- Reference tables
REVOKE ALL ON "foods" FROM "anon";
GRANT SELECT, INSERT, UPDATE, DELETE ON "foods" TO "anon";

REVOKE ALL ON "units" FROM "anon";
GRANT SELECT, INSERT, UPDATE, DELETE ON "units" TO "anon";

-- =============================================================================
-- SECTION 9: Fix user_passwords grants - Remove DELETE
-- MEDIUM: Password deletion should only occur via SECURITY DEFINER functions
-- =============================================================================

REVOKE ALL ON "user_passwords" FROM "anon";
GRANT SELECT, INSERT, UPDATE ON "user_passwords" TO "anon";

-- =============================================================================
-- SECTION 10: Fix email_service role - Remove LOGIN privilege
-- HIGH: Service role should not allow direct database connections
-- NOTE: ALTER ROLE requires superuser. We wrap in exception handler to allow
--       migration to succeed even if the user lacks privileges.
-- =============================================================================

DO $$
BEGIN
    ALTER ROLE email_service NOLOGIN;
    RAISE NOTICE 'Successfully set email_service to NOLOGIN';
EXCEPTION
    WHEN insufficient_privilege THEN
        RAISE WARNING 'Could not ALTER ROLE email_service NOLOGIN - requires superuser. Run manually: ALTER ROLE email_service NOLOGIN;';
END;
$$;

-- =============================================================================
-- SECTION 11: Fix insert_recipe() - Add authentication check
-- HIGH: SECURITY DEFINER function must verify caller is authenticated
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
BEGIN
  -- SECURITY FIX: Verify caller is authenticated
  v_current_user := current_setting('request.jwt.claims', true)::jsonb->>'email';
  IF v_current_user IS NULL OR v_current_user = '' THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

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
-- SECTION 12: RLS Bypass Policies for Service Role
-- HIGH: Allows SECURITY DEFINER functions (owned by recept) to bypass RLS
-- =============================================================================

-- recipe_likes: Used by toggle_recipe_like() in V25
CREATE POLICY recipe_likes_policy_service
  ON recipe_likes
  FOR ALL
  TO recept
  USING (true)
  WITH CHECK (true);

-- shopping_lists: Used by shopping list functions in V26
CREATE POLICY shopping_lists_policy_service
  ON shopping_lists
  FOR ALL
  TO recept
  USING (true)
  WITH CHECK (true);

-- shopping_list_items: Used by shopping list functions in V26
CREATE POLICY shopping_list_items_policy_service
  ON shopping_list_items
  FOR ALL
  TO recept
  USING (true)
  WITH CHECK (true);

-- shopping_list_item_sources: Used by add_recipe_to_shopping_list() in V26
CREATE POLICY shopping_list_item_sources_policy_service
  ON shopping_list_item_sources
  FOR ALL
  TO recept
  USING (true)
  WITH CHECK (true);

-- user_api_keys: Used by API key functions in V26
CREATE POLICY user_api_keys_policy_service
  ON user_api_keys
  FOR ALL
  TO recept
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- SECTION 13: Fix bcrypt cost factor
-- MEDIUM: Increases bcrypt cost from default 6 to recommended 12
-- =============================================================================

-- Update encrypt_password() with cost factor 12 and search_path
CREATE OR REPLACE FUNCTION encrypt_password()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  -- Only encrypt if password is not null and has changed
  IF NEW.password IS NOT NULL AND (tg_op = 'INSERT' OR NEW.password <> OLD.password) THEN
    NEW.password = crypt(NEW.password, gen_salt('bf', 12));
  END IF;
  RETURN NEW;
END;
$func$;

COMMENT ON FUNCTION encrypt_password IS 'Trigger function to hash passwords using bcrypt with cost factor 12';

-- =============================================================================
-- SECTION 14: Add search_path to utility functions
-- MEDIUM: Prevents search_path injection attacks on trigger functions
-- =============================================================================

-- Recreate set_timestamptz() with SET search_path = public
CREATE OR REPLACE FUNCTION set_timestamptz()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $func$
BEGIN
    NEW.date_modified = now()::timestamptz;
    RETURN NEW;
END;
$func$;

-- Recreate notify_email_queued() with SET search_path = public
CREATE OR REPLACE FUNCTION notify_email_queued()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_payload TEXT;
BEGIN
    v_payload := json_build_object(
        'id', NEW.id,
        'operation', lower(TG_OP),
        'table', TG_TABLE_NAME
    )::text;

    PERFORM pg_notify('email_message_channel', v_payload);

    RETURN NEW;
END;
$$;

-- =============================================================================
-- Documentation
-- =============================================================================

COMMENT ON TABLE rate_limit_attempts IS 'Tracks failed authentication attempts for rate limiting';
COMMENT ON FUNCTION check_rate_limit IS 'Returns TRUE if the identifier is rate limited';
COMMENT ON FUNCTION record_failed_attempt IS 'Records a failed attempt for rate limiting';
COMMENT ON FUNCTION clear_rate_limit IS 'Clears rate limit on successful authentication';
COMMENT ON FUNCTION cleanup_rate_limit_attempts IS 'Removes old rate limit records';
