-- V53: Fix pre_request() for PostgREST 14 + PostgreSQL 17
--
-- Four issues prevented x-api-key authentication from working:
--
-- 1. HEADER READING: The function used the legacy GUC format
--    current_setting('request.header.x-api-key') which doesn't work on
--    PostgreSQL 14+ (dashes in GUC names are invalid). PostgREST 14 uses
--    current_setting('request.headers')::json->>'x-api-key' instead.
--
-- 2. GUC ROLLBACK: SECURITY DEFINER + SET clause causes PostgreSQL to
--    create a savepoint and roll back ALL GUC changes (SET LOCAL role,
--    set_config) on function exit. Even without the SET clause, SECURITY
--    DEFINER restores the effective role on exit.
--
-- 3. READ-ONLY TRANSACTIONS: PostgREST uses read-only transactions for
--    GET/HEAD requests. validate_api_key() does UPDATEs (last_used_at,
--    is_active) which fail in read-only context.
--
-- 4. SEARCH PATH: validate_api_key uses crypt() from pgcrypto, which was
--    moved to the extensions schema in V51, but its search_path only
--    included public.
--
-- Fixes:
--   - pre_request: Use JSON header format, remove SECURITY DEFINER/SET clause
--   - validate_api_key: Add extensions to search_path, skip UPDATEs in
--     read-only transactions
--   - Grant anon execute on validate_api_key (itself SECURITY DEFINER)

GRANT EXECUTE ON FUNCTION validate_api_key(TEXT) TO anon;

-- Fix validate_api_key to handle read-only transactions (GET requests)
CREATE OR REPLACE FUNCTION validate_api_key(p_api_key TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
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
        BEGIN
          UPDATE user_api_keys SET is_active = false WHERE id = v_key_record.id;
        EXCEPTION WHEN read_only_sql_transaction THEN
          NULL; -- Skip in read-only context (GET/HEAD requests)
        END;
        RETURN NULL;
      END IF;

      BEGIN
        UPDATE user_api_keys SET last_used_at = now() WHERE id = v_key_record.id;
      EXCEPTION WHEN read_only_sql_transaction THEN
        NULL; -- Skip in read-only context (GET/HEAD requests)
      END;
      RETURN v_key_record.user_email;
    END IF;
  END LOOP;

  RETURN NULL;
END;
$func$;

-- Fix pre_request: JSON header format, no SECURITY DEFINER
CREATE OR REPLACE FUNCTION pre_request()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_api_key TEXT;
  v_user_email TEXT;
BEGIN
  v_api_key := current_setting('request.headers', true)::json->>'x-api-key';

  IF v_api_key IS NOT NULL AND v_api_key != '' THEN
    v_user_email := validate_api_key(v_api_key);

    IF v_user_email IS NOT NULL THEN
      SET LOCAL role TO 'authenticated';
      PERFORM set_config(
        'request.jwt.claims',
        json_build_object('email', v_user_email, 'role', 'authenticated')::text,
        true
      );
    ELSE
      RAISE EXCEPTION 'Invalid or expired API key'
        USING ERRCODE = '28000';
    END IF;
  END IF;
END;
$$;
