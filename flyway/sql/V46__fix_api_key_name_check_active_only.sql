-- Change revoke_api_key to DELETE the row instead of soft-deleting.
-- Revoked keys are invisible in the UI and serve no purpose.

-- Clean up any already-revoked keys
DELETE FROM user_api_keys WHERE is_active = false;

-- Update revoke function to delete instead of soft-update
CREATE OR REPLACE FUNCTION public.revoke_api_key(p_key_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_email TEXT;
  v_deleted BOOLEAN;
BEGIN
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  DELETE FROM user_api_keys
  WHERE id = p_key_id AND user_email = v_user_email
  RETURNING true INTO v_deleted;

  IF v_deleted IS NULL THEN
    RAISE EXCEPTION 'key-not-found';
  END IF;

  RETURN jsonb_build_object('revoked', true);
END;
$$;

-- Revert create function to simple duplicate check (no is_active filter needed)
CREATE OR REPLACE FUNCTION public.create_user_api_key(p_name TEXT)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
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

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

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
