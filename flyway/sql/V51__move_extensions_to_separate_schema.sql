-- V51: Move extensions to separate schema to hide them from PostgREST API
--
-- Problem: Extension functions (pgcrypto, uuid-ossp, pg_trgm) in the public
-- schema appear in the PostgREST OpenAPI spec. V50 attempted REVOKE FROM PUBLIC
-- but that only works when the revoker owns the function — extension functions
-- are owned by postgres, so the revoke was silently ignored.
--
-- Solution: Move extensions to an `extensions` schema that is NOT listed in
-- PostgREST's db-schemas. PostgREST's db-extra-search-path makes the functions
-- findable by application code without exposing them in the API.
--
-- Note: ALTER EXTENSION SET SCHEMA requires superuser. In Docker tests, recept
-- IS the superuser. On production, run the ALTER EXTENSION commands manually as
-- postgres after deploying this migration (see instructions below).
--
-- After deploying, run as postgres on production:
--   ALTER EXTENSION pgcrypto SET SCHEMA extensions;
--   ALTER EXTENSION "uuid-ossp" SET SCHEMA extensions;
--   ALTER EXTENSION pg_trgm SET SCHEMA extensions;

-- =============================================================================
-- 1. Create extensions schema and grant usage
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO recept;
GRANT USAGE ON SCHEMA extensions TO authenticated;
GRANT USAGE ON SCHEMA extensions TO anon;

-- =============================================================================
-- 2. Move extensions (requires superuser — safe fallback if not)
-- =============================================================================

DO $$
BEGIN
  ALTER EXTENSION pgcrypto SET SCHEMA extensions;
  ALTER EXTENSION "uuid-ossp" SET SCHEMA extensions;
  ALTER EXTENSION pg_trgm SET SCHEMA extensions;

  -- After moving, grant EXECUTE on extension functions to authenticated
  -- (anon should NOT have access to extension functions)
  GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO authenticated;

  RAISE NOTICE 'Extensions moved to extensions schema successfully';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE '=================================================================';
    RAISE NOTICE 'Cannot move extensions (not superuser). Run as postgres:';
    RAISE NOTICE '  ALTER EXTENSION pgcrypto SET SCHEMA extensions;';
    RAISE NOTICE '  ALTER EXTENSION "uuid-ossp" SET SCHEMA extensions;';
    RAISE NOTICE '  ALTER EXTENSION pg_trgm SET SCHEMA extensions;';
    RAISE NOTICE '  GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO authenticated;';
    RAISE NOTICE '=================================================================';
END;
$$;

-- =============================================================================
-- 3. Update function search_paths to include extensions schema
--    This is safe to run regardless of whether extensions moved yet —
--    functions still find extension functions in public (current location)
--    or extensions (after move).
-- =============================================================================

-- pgcrypto users (crypt, gen_salt, gen_random_bytes, encode/sha256)
ALTER FUNCTION encrypt_password() SET search_path = public, extensions;
ALTER FUNCTION login(TEXT, TEXT) SET search_path = public, extensions;
ALTER FUNCTION reset_password(TEXT, TEXT, TEXT) SET search_path = public, extensions;
ALTER FUNCTION create_user_api_key(TEXT) SET search_path = public, extensions;
ALTER FUNCTION validate_api_key(TEXT) SET search_path = public, extensions;
ALTER FUNCTION delete_account(TEXT) SET search_path = public, extensions;
ALTER FUNCTION request_password_reset(TEXT, TEXT) SET search_path = public, extensions;
ALTER FUNCTION complete_password_reset(TEXT, TEXT) SET search_path = public, extensions;
ALTER FUNCTION validate_password_reset_token(TEXT) SET search_path = public, extensions;
ALTER FUNCTION invite_to_home(TEXT) SET search_path = public, extensions;
ALTER FUNCTION generate_join_code(INTEGER) SET search_path = public, extensions;

-- pg_trgm users (similarity, word_similarity)
ALTER FUNCTION search_recipes(TEXT, TEXT, TEXT, INTEGER, INTEGER) SET search_path = public, extensions;
ALTER FUNCTION search_liked_recipes(TEXT, TEXT, INTEGER, INTEGER) SET search_path = public, extensions;
ALTER FUNCTION get_or_create_food(TEXT) SET search_path = public, extensions;
ALTER FUNCTION find_similar_foods(TEXT, INT) SET search_path = public, extensions;
