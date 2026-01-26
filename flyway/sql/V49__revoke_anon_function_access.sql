-- V49: Fix is_admin() NULL bug and revoke excessive anon function access
--
-- Problem: is_admin() returns NULL (not FALSE) when no JWT claims are present,
-- because `NULL = 'admin'` evaluates to NULL in SQL's three-valued logic.
-- Combined with `IF NOT is_admin()` in admin functions (where NOT NULL = NULL,
-- which is falsy), the permission check is skipped entirely.
-- This means admin functions like admin_list_users() are callable by anon.
--
-- Fix:
-- 1. Use COALESCE in is_admin() and is_admin_or_system() to ensure FALSE, not NULL
-- 2. Revoke EXECUTE on all public functions from anon (defense in depth)
-- 3. Re-grant only the functions that anon legitimately needs

-- =============================================================================
-- Fix is_admin() NULL handling
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

-- =============================================================================
-- Fix is_admin_or_system() NULL handling
-- =============================================================================

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
-- Revoke all function access from anon, then whitelist
-- =============================================================================

-- Remove all direct EXECUTE grants on public schema functions from anon.
-- Extension functions (pgcrypto, pg_trgm, uuid-ossp) granted to PUBLIC are
-- unaffected since this only revokes grants made directly to the anon role.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;

-- Re-grant only the functions anon legitimately needs:

-- PostgREST pre-request hook (must be callable by anon for API key auth)
GRANT EXECUTE ON FUNCTION pre_request() TO anon;

-- Auth functions (all SECURITY DEFINER)
GRANT EXECUTE ON FUNCTION login(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION signup(TEXT, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION signup_provider(TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION reset_password(TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION request_password_reset(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION complete_password_reset(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION validate_password_reset_token(TEXT) TO anon;

-- Public features
GRANT EXECUTE ON FUNCTION search_recipes(TEXT, TEXT, TEXT, INTEGER, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION escape_like_pattern(TEXT) TO anon; -- used by search_recipes
GRANT EXECUTE ON FUNCTION unsubscribe_from_emails(UUID, TEXT) TO anon;
