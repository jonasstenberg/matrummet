-- Filter out inactive (revoked) API keys from get_user_api_keys

CREATE OR REPLACE FUNCTION get_user_api_keys()
RETURNS TABLE (
  id UUID,
  name TEXT,
  api_key_prefix TEXT,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN,
  date_published TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user_email TEXT;
BEGIN
  -- Get current user email from JWT
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  RETURN QUERY
  SELECT
    uak.id,
    uak.name,
    uak.api_key_prefix,
    uak.last_used_at,
    uak.expires_at,
    uak.is_active,
    uak.date_published
  FROM user_api_keys uak
  WHERE uak.user_email = v_user_email
    AND uak.is_active = true
  ORDER BY uak.date_published DESC;
END;
$func$;
