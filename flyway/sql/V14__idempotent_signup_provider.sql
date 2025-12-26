-- Make signup_provider idempotent: return existing user if they exist
-- This allows OAuth login to work for both new and existing users

CREATE OR REPLACE FUNCTION signup_provider(p_name text, p_email text, p_provider text default null)
    RETURNS jsonb
    AS $func$
DECLARE
  _user_id uuid;
  _json_result jsonb;
BEGIN
  -- Check if user already exists
  SELECT u.id INTO _user_id
  FROM users u
  WHERE u.email = p_email;

  IF _user_id IS NOT NULL THEN
    -- User exists, return their data for login
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
    -- Create new user
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
$func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
