-- V49: Fix is_admin() NULL bug, break anon→authenticated inheritance, harden grants
--
-- Problems fixed:
-- 1. is_admin() returns NULL (not FALSE) when no JWT claims exist, because
--    `NULL = 'admin'` is NULL in SQL three-valued logic. This causes
--    `IF NOT is_admin()` to be skipped (NOT NULL = NULL = falsy), making
--    admin functions like admin_list_users() callable by unauthenticated users.
--
-- 2. `authenticated` inherits from `anon` (GRANT anon TO authenticated in V26),
--    which is non-idiomatic for PostgREST. Breaking this inheritance lets us
--    give anon minimal access without affecting authenticated users.
--
-- Approach:
-- 1. Fix is_admin() and is_admin_or_system() with COALESCE
-- 2. Break role inheritance (REVOKE anon FROM authenticated)
-- 3. Grant authenticated its own table/view/function access
-- 4. Restrict anon to a minimal function whitelist

-- =============================================================================
-- 1. Fix is_admin() NULL handling
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
  SELECT u.role INTO user_role
  FROM users u
  WHERE u.email = current_setting('request.jwt.claims', true)::jsonb->>'email';

  RETURN COALESCE(user_role = 'admin', FALSE);
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$func$;

CREATE OR REPLACE FUNCTION is_admin_or_system()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  current_email TEXT;
  user_role TEXT;
BEGIN
  current_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF current_email = 'system@cron.local' THEN
    RETURN TRUE;
  END IF;

  SELECT u.role INTO user_role
  FROM users u
  WHERE u.email = current_email;

  RETURN COALESCE(user_role = 'admin', FALSE);
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$func$;

-- =============================================================================
-- 2. Break anon → authenticated inheritance
-- =============================================================================

REVOKE anon FROM authenticated;

-- =============================================================================
-- 3. Grant authenticated its own table/view access
--    (previously inherited from anon)
-- =============================================================================

-- Core tables (RLS enforces ownership)
GRANT SELECT, INSERT, UPDATE, DELETE ON users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_passwords TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON recipes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ingredients TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON instructions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON recipe_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ingredient_groups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON instruction_groups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON recipe_likes TO authenticated;

-- Reference tables
GRANT SELECT, INSERT, UPDATE, DELETE ON foods TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON units TO authenticated;

-- Email/notification tables
GRANT SELECT, INSERT, UPDATE, DELETE ON email_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON email_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_email_preferences TO authenticated;

-- Auth support
GRANT SELECT, INSERT, UPDATE, DELETE ON password_reset_tokens TO authenticated;

-- Logs
GRANT SELECT ON food_review_logs TO authenticated;

-- Views
GRANT SELECT ON recipes_and_categories TO authenticated;
GRANT SELECT ON liked_recipes TO authenticated;

-- =============================================================================
-- 4. Grant authenticated all functions, then restrict anon
-- =============================================================================

-- Give authenticated access to all functions. Security is enforced at the
-- function level (is_admin checks, ownership validation, RLS).
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Revoke all function access from anon (clean slate).
-- Extension functions (pgcrypto, pg_trgm) granted to PUBLIC are unaffected.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;

-- =============================================================================
-- 5. Anon function whitelist
-- =============================================================================

-- PostgREST pre-request hook (validates API keys for unauthenticated requests)
GRANT EXECUTE ON FUNCTION pre_request() TO anon;

-- Auth flow
GRANT EXECUTE ON FUNCTION login(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION signup(TEXT, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION signup_provider(TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION reset_password(TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION request_password_reset(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION complete_password_reset(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION validate_password_reset_token(TEXT) TO anon;

-- Public search (SECURITY INVOKER, needs helper functions for ILIKE and ranking)
GRANT EXECUTE ON FUNCTION search_recipes(TEXT, TEXT, TEXT, INTEGER, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION escape_like_pattern(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION word_similarity(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION similarity(TEXT, TEXT) TO anon;

-- Email unsubscribe (token-based, no auth needed)
GRANT EXECUTE ON FUNCTION unsubscribe_from_emails(UUID, TEXT) TO anon;
