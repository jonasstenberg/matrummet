-- V50: Restrict anon table access and hide extension functions from public API
--
-- Problems fixed:
-- 1. Anon has table access (SELECT/INSERT/UPDATE/DELETE) from early migrations,
--    exposing the full schema in the public OpenAPI spec. RLS protects data but
--    the schema structure itself is unnecessarily exposed.
-- 2. Extension functions (pgcrypto, uuid-ossp, pg_trgm) have PUBLIC grants from
--    CREATE EXTENSION, making them visible in the public OpenAPI spec.
-- 3. debug_admin_check() is visible to anon (granted to PUBLIC).
--
-- Approach:
-- 1. Revoke all table/view access from anon, then whitelist public views
-- 2. Revoke PUBLIC execute on all functions (hides extension functions)
-- 3. Re-grant authenticated (in case PUBLIC revocation affected coverage)
-- 4. Re-apply anon function whitelist from V49 (unaffected, but explicit)
-- 5. Drop debug_admin_check() (debug utility, not needed in production)

-- =============================================================================
-- 1. Revoke all table/view access from anon
-- =============================================================================

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;

-- Whitelist: anon needs SELECT on these for public recipe browsing.
-- search_recipes() is SECURITY INVOKER and queries recipes + recipes_and_categories.
-- Recipe detail pages need ingredients, instructions, categories, and their groups.
GRANT SELECT ON recipes TO anon;
GRANT SELECT ON recipes_and_categories TO anon;
GRANT SELECT ON ingredients TO anon;
GRANT SELECT ON instructions TO anon;
GRANT SELECT ON categories TO anon;
GRANT SELECT ON recipe_categories TO anon;
GRANT SELECT ON ingredient_groups TO anon;
GRANT SELECT ON instruction_groups TO anon;

-- =============================================================================
-- 2. Revoke PUBLIC execute on all functions in public schema
--    This removes the implicit PUBLIC grants that extension functions
--    (pgcrypto, uuid-ossp, pg_trgm) received at CREATE EXTENSION time.
--    Application functions never had PUBLIC grants (V1 ALTER DEFAULT PRIVILEGES).
-- =============================================================================

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;

-- =============================================================================
-- 3. Re-grant authenticated all functions
--    V49 granted this, but re-apply to ensure coverage after PUBLIC revocation.
-- =============================================================================

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- =============================================================================
-- 4. Re-apply anon function whitelist (same as V49, for clarity)
--    These are direct role grants and were not affected by the PUBLIC revoke,
--    but listing them here makes the complete anon surface area explicit.
-- =============================================================================

-- PostgREST pre-request hook
GRANT EXECUTE ON FUNCTION pre_request() TO anon;

-- Auth flow
GRANT EXECUTE ON FUNCTION login(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION signup(TEXT, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION signup_provider(TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION reset_password(TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION request_password_reset(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION complete_password_reset(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION validate_password_reset_token(TEXT) TO anon;

-- Public search (SECURITY INVOKER, needs helper functions)
GRANT EXECUTE ON FUNCTION search_recipes(TEXT, TEXT, TEXT, INTEGER, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION escape_like_pattern(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION word_similarity(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION similarity(TEXT, TEXT) TO anon;

-- Email unsubscribe (token-based, no auth needed)
GRANT EXECUTE ON FUNCTION unsubscribe_from_emails(UUID, TEXT) TO anon;

-- =============================================================================
-- 5. Drop debug_admin_check (debug utility, not needed in production)
-- =============================================================================

DROP FUNCTION IF EXISTS debug_admin_check();
