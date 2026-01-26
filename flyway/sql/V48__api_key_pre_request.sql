-- Pre-request function for PostgREST API key authentication
-- Called automatically by PostgREST before every request (via db-pre-request config).
-- If an x-api-key header is present, validates it and promotes the connection
-- to 'authenticated' role with the correct email claim, so existing RLS policies work unchanged.
-- If no key is provided, the normal JWT/anon flow proceeds as before.

CREATE OR REPLACE FUNCTION pre_request()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_api_key TEXT;
  v_user_email TEXT;
BEGIN
  v_api_key := current_setting('request.header.x-api-key', true);

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

GRANT EXECUTE ON FUNCTION pre_request() TO anon;
GRANT EXECUTE ON FUNCTION pre_request() TO authenticated;
