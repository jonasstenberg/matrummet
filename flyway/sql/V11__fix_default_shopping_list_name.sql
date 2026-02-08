-- Fix: get_or_create_default_shopping_list used 'Inkopslista' instead of 'Inköpslista'

-- Fix any existing lists with the wrong name
UPDATE shopping_lists
SET name = 'Inköpslista'
WHERE name = 'Inkopslista';

-- Recreate the function with the correct name
CREATE OR REPLACE FUNCTION public.get_or_create_default_shopping_list() RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_email TEXT;
  v_home_id UUID;
  v_list_id UUID;
BEGIN
  -- Get current user email from JWT
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  -- Get user's home_id
  SELECT home_id INTO v_home_id
  FROM users
  WHERE email = v_user_email;

  IF v_home_id IS NULL THEN
    RAISE EXCEPTION 'user-has-no-home';
  END IF;

  -- Try to find existing default list for the home
  SELECT id INTO v_list_id
  FROM shopping_lists
  WHERE home_id = v_home_id AND is_default = true;

  IF v_list_id IS NOT NULL THEN
    RETURN v_list_id;
  END IF;

  -- No default list exists, create one
  INSERT INTO shopping_lists (user_email, home_id, name, is_default)
  VALUES (v_user_email, v_home_id, 'Inköpslista', true)
  ON CONFLICT (home_id, name) DO UPDATE SET is_default = true
  RETURNING id INTO v_list_id;

  RETURN v_list_id;
END;
$$;
