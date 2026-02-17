-- Increase signup bonus from 3 to 10 credits
-- Also update existing users who still have exactly 3 credits (untouched signup bonus)

-- 1. Update signup function
DROP FUNCTION IF EXISTS public.signup(text, text, text, text);
CREATE FUNCTION public.signup(
  p_name text,
  p_email text,
  p_password text,
  p_provider text DEFAULT NULL
) RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _user_id uuid;
  _result users;
BEGIN
  -- Block reserved email domains
  IF p_email LIKE '%@cron.local' THEN
    RAISE EXCEPTION 'signup-failed';
  END IF;

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

    -- Grant 10 free AI generation credits (using internal function)
    PERFORM _add_credits_internal(p_email, 10, 'signup_bonus', 'Välkomstbonus: 10 gratis AI-genereringar');
  END IF;

  SELECT * INTO _result FROM users WHERE id = _user_id;
  RETURN _result;
END;
$$;

-- 2. Update signup_provider function
DROP FUNCTION IF EXISTS public.signup_provider(text, text, text);
CREATE FUNCTION public.signup_provider(
  p_name text,
  p_email text,
  p_provider text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _user_id UUID;
  _existing_provider TEXT;
  _json_result JSONB;
BEGIN
  -- Block reserved email domains
  IF p_email LIKE '%@cron.local' THEN
    RAISE EXCEPTION 'signup-failed';
  END IF;

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

    -- Grant 10 free AI generation credits (using internal function)
    PERFORM _add_credits_internal(p_email, 10, 'signup_bonus', 'Välkomstbonus: 10 gratis AI-genereringar');

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
$$;

-- Restore grants
GRANT ALL ON FUNCTION public.signup(text, text, text, text) TO authenticated;
GRANT ALL ON FUNCTION public.signup(text, text, text, text) TO anon;
GRANT ALL ON FUNCTION public.signup_provider(text, text, text) TO authenticated;
GRANT ALL ON FUNCTION public.signup_provider(text, text, text) TO anon;

-- 3. Grant 7 extra credits to existing users whose balance is exactly 3
-- (these are users who signed up but never used or purchased credits)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT u.email
    FROM users u
    JOIN user_credits uc ON uc.user_email = u.email
    WHERE uc.balance = 3
  LOOP
    PERFORM _add_credits_internal(r.email, 7, 'admin_grant', 'Uppgradering: välkomstbonus höjd från 3 till 10');
  END LOOP;
END;
$$;
