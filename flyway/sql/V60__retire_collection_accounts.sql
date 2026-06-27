-- V60: Retire the collection-account hack.
--
-- Recetas Mexas (and any future curated import) now lives in a real first-class
-- Collection (V58/V59). The `is_collection` pseudo-user concept and its plumbing are
-- removed. get_home_info is reverted to no longer surface `is_collection` FIRST — the
-- function body late-binds in plpgsql, so dropping the column without this would only
-- fail at runtime.

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

  IF p_home_id IS NOT NULL THEN
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

  SELECT * INTO v_home FROM homes WHERE id = v_home_id;

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

ALTER TABLE public.users DROP COLUMN is_collection;
