-- Update signup function to return full user record (like login does)
-- This allows the frontend to automatically log in the user after signup

-- Must drop first because we're changing the return type from jsonb to users
DROP FUNCTION IF EXISTS signup(text, text, text, text);

CREATE FUNCTION signup (p_name text, p_email text, p_password text default null, p_provider text default null)
    RETURNS users
    AS $func$
DECLARE
  _user_id uuid;
  _result users;
BEGIN
    -- Validate name
    IF p_name IS NULL OR length(p_name) < 1 OR length(p_name) > 255 THEN
      RAISE EXCEPTION 'invalid-name';
    END IF;

    -- Validate password requirements if password-based signup
    IF p_provider IS NULL THEN
      IF p_password IS NULL OR
         LENGTH(p_password) < 8 OR
         NOT (p_password ~* '.*[A-Z].*') OR
         NOT (p_password ~* '.*[a-z].*') OR
         NOT (p_password ~ '\d') THEN
        RAISE EXCEPTION 'password-not-meet-requirements';
      END IF;
    END IF;

    -- Check if user already exists
    SELECT u.id
    INTO _user_id
    FROM users u
    WHERE u.email = p_email;

    IF _user_id IS NOT NULL THEN
      RAISE EXCEPTION 'already-exists';
    ELSE
      INSERT INTO users (name, email, provider, owner) VALUES (p_name, p_email, p_provider, p_email)
      RETURNING id INTO _user_id;

      IF p_provider IS NULL THEN
        INSERT INTO user_passwords (email, password, owner) VALUES (p_email, p_password, p_email);
      END IF;
    END IF;

    -- Return full user record
    SELECT * INTO _result FROM users WHERE id = _user_id;
    RETURN _result;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Re-grant execute permission (needed after CREATE OR REPLACE)
GRANT EXECUTE ON FUNCTION signup(TEXT, TEXT, TEXT, TEXT) TO "anon";

-- Re-set owner to recept role for RLS bypass
DO $$
BEGIN
  EXECUTE format('ALTER FUNCTION signup(text, text, text, text) OWNER TO %I', 'recept');
END $$;
