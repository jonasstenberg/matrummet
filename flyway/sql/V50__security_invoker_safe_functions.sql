-- Convert 4 SECURITY DEFINER functions to SECURITY INVOKER.
-- These functions only access tables where the authenticated role has
-- the necessary grants AND RLS policies enforce the same ownership check.
--
-- NOT converted (must stay SECURITY DEFINER):
-- - get_user_credits() — V12 revoked SELECT on user_credits from authenticated
-- - get_credit_history() — V12 revoked SELECT on credit_transactions from authenticated

-- 1. current_user_info() — reads users (SELECT, RLS: owner = jwt_email)
CREATE OR REPLACE FUNCTION public.current_user_info() RETURNS json
    LANGUAGE sql STABLE SECURITY INVOKER
    SET search_path TO 'public'
    AS $$
  SELECT json_build_object('email', u.email, 'name', u.name)
  FROM users u
  WHERE u.email = current_setting('request.jwt.claims', true)::json->>'email';
$$;

-- 2. get_user_api_keys() — reads user_api_keys (SELECT, RLS: user_email = jwt_email)
CREATE OR REPLACE FUNCTION public.get_user_api_keys() RETURNS TABLE(id uuid, name text, api_key_prefix text, last_used_at timestamp with time zone, expires_at timestamp with time zone, is_active boolean, date_published timestamp with time zone)
    LANGUAGE plpgsql SECURITY INVOKER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_email TEXT;
BEGIN
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';
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
$$;

-- 3. create_user_api_key() — reads + inserts user_api_keys (SELECT + INSERT, RLS covers both)
-- Extension functions (crypt, gen_salt, gen_random_bytes) are granted to authenticated.
CREATE OR REPLACE FUNCTION public.create_user_api_key(p_name TEXT)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_user_email TEXT;
  v_api_key TEXT;
  v_api_key_prefix TEXT;
  v_api_key_hash TEXT;
  v_key_id UUID;
BEGIN
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF p_name IS NULL OR LENGTH(TRIM(p_name)) < 1 THEN
    RAISE EXCEPTION 'invalid-key-name';
  END IF;

  IF EXISTS (SELECT 1 FROM user_api_keys WHERE user_email = v_user_email AND name = TRIM(p_name)) THEN
    RAISE EXCEPTION 'key-name-already-exists';
  END IF;

  v_api_key := 'sk_' || encode(gen_random_bytes(16), 'hex');
  v_api_key_prefix := LEFT(v_api_key, 8);
  v_api_key_hash := crypt(v_api_key, gen_salt('bf'));

  INSERT INTO user_api_keys (user_email, name, api_key_hash, api_key_prefix)
  VALUES (v_user_email, TRIM(p_name), v_api_key_hash, v_api_key_prefix)
  RETURNING id INTO v_key_id;

  RETURN jsonb_build_object(
    'id', v_key_id,
    'name', TRIM(p_name),
    'api_key', v_api_key,
    'api_key_prefix', v_api_key_prefix
  );
END;
$$;

-- 4. toggle_recipe_like() — reads recipes (SELECT) + reads/inserts/deletes recipe_likes
-- RLS on recipes: user sees own + public + household + book-shared recipes.
-- Invisible recipes return NULL owner → same generic error as before.
-- RLS on recipe_likes: SELECT/INSERT/DELETE all enforce user_email = jwt_email.
CREATE OR REPLACE FUNCTION public.toggle_recipe_like(p_recipe_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY INVOKER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_email TEXT;
  v_recipe_owner TEXT;
  v_is_liked BOOLEAN;
BEGIN
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  -- Check if recipe exists and get owner (RLS filters visibility)
  SELECT owner INTO v_recipe_owner FROM recipes WHERE id = p_recipe_id;

  IF v_recipe_owner IS NULL THEN
    RAISE EXCEPTION 'operation-failed';
  END IF;

  -- Prevent liking own recipe
  IF v_recipe_owner = v_user_email THEN
    RAISE EXCEPTION 'operation-failed';
  END IF;

  -- Check if already liked
  SELECT EXISTS(
    SELECT 1 FROM recipe_likes
    WHERE recipe_id = p_recipe_id AND user_email = v_user_email
  ) INTO v_is_liked;

  IF v_is_liked THEN
    DELETE FROM recipe_likes
    WHERE recipe_id = p_recipe_id AND user_email = v_user_email;
    RETURN jsonb_build_object('liked', false);
  ELSE
    INSERT INTO recipe_likes (recipe_id, user_email)
    VALUES (p_recipe_id, v_user_email);
    RETURN jsonb_build_object('liked', true);
  END IF;
END;
$$;
