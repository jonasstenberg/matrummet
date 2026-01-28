-- V59: Change signup bonus from 10 to 3 credits
-- Updates both signup() and signup_provider() to grant 3 free credits

-- Recreate signup() with 3 credits and corrected description
CREATE OR REPLACE FUNCTION signup (p_name text, p_email text, p_password text default null, p_provider text default null)
    RETURNS users
    AS $func$
DECLARE
    _user_id uuid;
    _result users;
BEGIN
    IF p_name IS NULL OR length(p_name) < 1 OR length(p_name) > 255 THEN
        RAISE EXCEPTION 'invalid-name';
    END IF;

    IF p_provider IS NULL THEN
        IF p_password IS NULL OR
           LENGTH(p_password) < 8 OR
           LENGTH(p_password) > 72 OR
           NOT (p_password ~ '[A-Z]') OR
           NOT (p_password ~ '[a-z]') OR
           NOT (p_password ~ '\d') THEN
            RAISE EXCEPTION 'password-not-meet-requirements';
        END IF;
    END IF;

    SELECT u.id INTO _user_id FROM users u WHERE u.email = p_email;

    IF _user_id IS NOT NULL THEN
        RAISE EXCEPTION 'signup-failed';
    ELSE
        INSERT INTO users (name, email, provider, owner) VALUES (p_name, p_email, p_provider, p_email)
        RETURNING id INTO _user_id;

        IF p_provider IS NULL THEN
            INSERT INTO user_passwords (email, password, owner) VALUES (p_email, p_password, p_email);
        END IF;

        -- Grant 3 free AI generation credits
        PERFORM add_credits(p_email, 3, 'signup_bonus', 'Välkomstbonus: 3 gratis AI-genereringar');
    END IF;

    SELECT * INTO _result FROM users WHERE id = _user_id;
    RETURN _result;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- Recreate signup_provider() with 3 credits and corrected description
CREATE OR REPLACE FUNCTION signup_provider(p_name TEXT, p_email TEXT, p_provider TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  _user_id UUID;
  _existing_provider TEXT;
  _json_result JSONB;
BEGIN
  SELECT u.id, u.provider INTO _user_id, _existing_provider
  FROM users u
  WHERE u.email = p_email;

  IF _user_id IS NOT NULL THEN
    -- Existing user: verify provider matches
    IF _existing_provider IS DISTINCT FROM p_provider THEN
      RAISE EXCEPTION 'provider-mismatch'
        USING HINT = 'An account with this email exists but was registered with a different provider';
    END IF;

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
    -- New user
    INSERT INTO users (name, email, provider, owner)
    VALUES (p_name, p_email, p_provider, p_email)
    RETURNING id INTO _user_id;

    -- Grant 3 free AI generation credits
    PERFORM add_credits(p_email, 3, 'signup_bonus', 'Välkomstbonus: 3 gratis AI-genereringar');

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
$func$;
