-- V55: Add current_user_info() RPC for API key authentication in Next.js
--
-- When external clients authenticate via x-api-key header, PostgREST's
-- pre_request() validates the key and sets JWT claims. This function
-- reads those claims to return the authenticated user's info, enabling
-- Next.js API routes (like image upload) to support API key auth.

CREATE OR REPLACE FUNCTION current_user_info()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object('email', u.email, 'name', u.name)
  FROM users u
  WHERE u.email = current_setting('request.jwt.claims', true)::json->>'email';
$$;

GRANT EXECUTE ON FUNCTION current_user_info() TO anon, authenticated;

COMMENT ON FUNCTION current_user_info() IS
  'Returns email and name of the currently authenticated user from JWT claims. '
  'Used by Next.js API routes to validate x-api-key authentication via PostgREST.';
