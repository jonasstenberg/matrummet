-- V30: Add user UUID to get_home_info() members and add get_current_user_uuid() helper

-- Update get_home_info() to include each member's UUID in the JSONB output
CREATE OR REPLACE FUNCTION public.get_home_info(p_home_id UUID DEFAULT NULL) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_email TEXT;
  v_home_id UUID;
  v_home RECORD;
  v_members JSONB;
  v_pending_invitations JSONB;
BEGIN
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  -- Use explicit home_id if provided, otherwise fall back to default
  IF p_home_id IS NOT NULL THEN
    -- Verify user is a member of this home
    IF NOT EXISTS (SELECT 1 FROM home_members WHERE user_email = v_user_email AND home_id = p_home_id) THEN
      RETURN NULL;
    END IF;
    v_home_id := p_home_id;
  ELSE
    v_home_id := get_current_user_home_id();
  END IF;

  IF v_home_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Get home details
  SELECT * INTO v_home
  FROM homes
  WHERE id = v_home_id;

  -- Get members from home_members JOIN users (now includes user id)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', u.id,
    'email', u.email,
    'name', u.name,
    'joined_at', hm.joined_at,
    'role', hm.role,
    'is_creator', u.email = v_home.created_by_email,
    'is_current_user', u.email = v_user_email
  ) ORDER BY
    CASE WHEN u.email = v_home.created_by_email THEN 0 ELSE 1 END,
    u.name
  ), '[]'::jsonb) INTO v_members
  FROM home_members hm
  JOIN users u ON u.email = hm.user_email
  WHERE hm.home_id = v_home_id;

  -- Get pending invitations
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', hi.id,
    'invited_email', hi.invited_email,
    'invited_by', hi.invited_by_email,
    'expires_at', hi.expires_at,
    'date_published', hi.date_published
  ) ORDER BY hi.date_published DESC), '[]'::jsonb) INTO v_pending_invitations
  FROM home_invitations hi
  WHERE hi.home_id = v_home_id
    AND hi.status = 'pending'
    AND hi.expires_at > now();

  RETURN jsonb_build_object(
    'id', v_home.id,
    'name', v_home.name,
    'join_code', v_home.join_code,
    'join_code_expires_at', v_home.join_code_expires_at,
    'created_by_email', v_home.created_by_email,
    'is_creator', v_home.created_by_email = v_user_email,
    'date_published', v_home.date_published,
    'members', v_members,
    'pending_invitations', v_pending_invitations
  );
END;
$$;

-- Helper function to get the current JWT user's UUID
CREATE OR REPLACE FUNCTION public.get_current_user_uuid() RETURNS UUID
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_email TEXT;
  v_user_id UUID;
BEGIN
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_user_id FROM users WHERE email = v_user_email;
  RETURN v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_current_user_uuid() TO authenticated;
