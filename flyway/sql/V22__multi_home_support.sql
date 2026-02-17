--
-- V22: Multi-home support
-- Allows users to belong to multiple homes simultaneously via home_members junction table.
-- Replaces the single users.home_id column with many-to-many relationship.
-- Backward compatible: users.home_id still updated for transition period.
--

-- ============================================================================
-- PART 1: Create home_members table
-- ============================================================================

CREATE TABLE home_members (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_email text NOT NULL REFERENCES users(email) ON DELETE CASCADE,
    home_id uuid NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
    role text DEFAULT 'member' CHECK (role IN ('member', 'admin')),
    joined_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE (user_email, home_id)
);

CREATE INDEX idx_home_members_user ON home_members(user_email);
CREATE INDEX idx_home_members_home ON home_members(home_id);

ALTER TABLE home_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE ONLY home_members FORCE ROW LEVEL SECURITY;

-- ============================================================================
-- PART 2: Backfill from users.home_id
-- ============================================================================

INSERT INTO home_members (user_email, home_id, role, joined_at)
SELECT u.email, u.home_id,
       CASE WHEN h.created_by_email = u.email THEN 'admin' ELSE 'member' END,
       COALESCE(u.home_joined_at, now())
FROM users u
JOIN homes h ON h.id = u.home_id
WHERE u.home_id IS NOT NULL;

-- ============================================================================
-- PART 3: RLS on home_members
-- ============================================================================

-- Users can see members of homes they belong to
CREATE POLICY home_members_policy_select ON home_members FOR SELECT
  USING (
    home_id IN (
      SELECT hm.home_id FROM home_members hm
      WHERE hm.user_email = current_setting('request.jwt.claims', true)::jsonb->>'email'
    )
  );

-- Service role (matrummet) gets full access for SECURITY DEFINER functions
CREATE POLICY home_members_service_policy ON home_members
  USING (current_user = 'matrummet');

GRANT SELECT ON home_members TO authenticated;

-- ============================================================================
-- PART 4: Rewrite pre_request() - add home context header reading
-- ============================================================================

CREATE OR REPLACE FUNCTION public.pre_request() RETURNS void
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_api_key TEXT;
  v_user_email TEXT;
  v_active_home_id TEXT;
  v_verified_home_id UUID;
BEGIN
  -- Existing API key auth logic (unchanged)
  v_api_key := current_setting('request.headers', true)::json->>'x-api-key';

  IF v_api_key IS NOT NULL AND v_api_key != '' THEN
    v_user_email := validate_api_key(v_api_key);

    IF v_user_email IS NOT NULL THEN
      SET LOCAL role TO 'authenticated';
      PERFORM set_config(
        'request.jwt.claims',
        json_build_object('email', v_user_email, 'role', 'authenticated')::text,
        true
      );
    ELSE
      RAISE EXCEPTION 'Invalid or expired API key'
        USING ERRCODE = '28000';
    END IF;
  END IF;

  -- NEW: Read x-active-home-id header and verify membership
  v_active_home_id := current_setting('request.headers', true)::json->>'x-active-home-id';

  IF v_active_home_id IS NOT NULL AND v_active_home_id != '' THEN
    -- Get the user email (from JWT or just-set API key claims)
    v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

    IF v_user_email IS NOT NULL THEN
      BEGIN
        -- Verify membership
        SELECT hm.home_id INTO v_verified_home_id
        FROM home_members hm
        WHERE hm.user_email = v_user_email
          AND hm.home_id = v_active_home_id::uuid;

        IF v_verified_home_id IS NOT NULL THEN
          PERFORM set_config('app.active_home_id', v_verified_home_id::text, true);
        END IF;
      EXCEPTION WHEN OTHERS THEN
        -- Invalid UUID or other error - silently ignore, no home context set
        NULL;
      END;
    END IF;
  END IF;
END;
$$;

-- ============================================================================
-- PART 5: Rewrite core helper functions
-- ============================================================================

-- get_current_user_home_id(): now reads from session variable or home_members
CREATE OR REPLACE FUNCTION public.get_current_user_home_id() RETURNS uuid
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_home_id UUID;
  v_active_home_text TEXT;
BEGIN
  -- 1. Try reading app.active_home_id session variable (set by pre_request from header)
  BEGIN
    v_active_home_text := current_setting('app.active_home_id', true);
    IF v_active_home_text IS NOT NULL AND v_active_home_text != '' THEN
      v_home_id := v_active_home_text::uuid;
      RETURN v_home_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Not set or invalid, fall through
    NULL;
  END;

  -- 2. Fall back to first home from home_members (oldest membership)
  SELECT hm.home_id INTO v_home_id
  FROM home_members hm
  WHERE hm.user_email = current_setting('request.jwt.claims', true)::jsonb->>'email'
  ORDER BY hm.joined_at ASC
  LIMIT 1;

  RETURN v_home_id;
END;
$$;

-- is_home_member(): check home_members table
CREATE OR REPLACE FUNCTION public.is_home_member(p_home_id uuid) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF p_home_id IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM home_members
    WHERE user_email = current_setting('request.jwt.claims', true)::jsonb->>'email'
      AND home_id = p_home_id
  );
END;
$$;

-- shares_household_with(): check if two users share ANY home via home_members
CREATE OR REPLACE FUNCTION public.shares_household_with(p_owner_email text) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_current_user_email TEXT;
BEGIN
  v_current_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  -- No JWT = anonymous user, cannot share household
  IF v_current_user_email IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check if they share ANY home via home_members
  RETURN EXISTS (
    SELECT 1
    FROM home_members hm1
    JOIN home_members hm2 ON hm1.home_id = hm2.home_id
    WHERE hm1.user_email = v_current_user_email
      AND hm2.user_email = p_owner_email
  );
END;
$$;

-- NEW: get_user_homes() - list all homes a user belongs to
CREATE FUNCTION public.get_user_homes() RETURNS TABLE(home_id uuid, home_name text, joined_at timestamptz, member_count bigint, role text)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_email TEXT;
BEGIN
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  RETURN QUERY
  SELECT
    h.id AS home_id,
    h.name AS home_name,
    hm.joined_at,
    (SELECT COUNT(*) FROM home_members hm2 WHERE hm2.home_id = h.id) AS member_count,
    hm.role
  FROM home_members hm
  JOIN homes h ON h.id = hm.home_id
  WHERE hm.user_email = v_user_email
  ORDER BY hm.joined_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_homes() TO authenticated;

-- ============================================================================
-- PART 6: Rewrite ALL home management functions
-- ============================================================================

-- create_home(): users can now create multiple homes
CREATE OR REPLACE FUNCTION public.create_home(p_name text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_email TEXT;
  v_home_id UUID;
  v_is_first_home BOOLEAN;
BEGIN
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  -- No longer check for existing home - users can have multiple

  IF p_name IS NULL OR LENGTH(TRIM(p_name)) < 1 THEN
    RAISE EXCEPTION 'invalid-home-name';
  END IF;

  -- Check if this is the user's first home
  v_is_first_home := NOT EXISTS (
    SELECT 1 FROM home_members WHERE user_email = v_user_email
  );

  -- Create the home
  INSERT INTO homes (name, created_by_email)
  VALUES (TRIM(p_name), v_user_email)
  RETURNING id INTO v_home_id;

  -- Insert into home_members with role='admin'
  INSERT INTO home_members (user_email, home_id, role, joined_at)
  VALUES (v_user_email, v_home_id, 'admin', now());

  -- Backward compat: update users.home_id
  UPDATE users SET home_id = v_home_id, home_joined_at = NOW() WHERE email = v_user_email;

  -- Only migrate orphaned data if this is user's FIRST home
  IF v_is_first_home THEN
    UPDATE user_pantry SET home_id = v_home_id WHERE user_email = v_user_email AND home_id IS NULL;

    DELETE FROM shopping_lists
    WHERE user_email = v_user_email AND home_id IS NULL
      AND name IN (SELECT name FROM shopping_lists WHERE home_id = v_home_id);

    UPDATE shopping_lists SET home_id = v_home_id WHERE user_email = v_user_email AND home_id IS NULL;
    UPDATE shopping_list_items SET home_id = v_home_id WHERE user_email = v_user_email AND home_id IS NULL;
  END IF;

  RETURN v_home_id;
END;
$$;

-- join_home_by_code(): users can now join multiple homes
CREATE OR REPLACE FUNCTION public.join_home_by_code(p_code text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_email TEXT;
  v_home_id UUID;
  v_home_record RECORD;
BEGIN
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  -- No longer check for existing home - users can have multiple

  -- Validate and find the home by join code
  SELECT id, join_code_expires_at INTO v_home_record
  FROM homes
  WHERE join_code = UPPER(TRIM(p_code));

  IF v_home_record.id IS NULL THEN
    RAISE EXCEPTION 'invalid-join-code';
  END IF;

  IF v_home_record.join_code_expires_at IS NOT NULL AND v_home_record.join_code_expires_at < now() THEN
    RAISE EXCEPTION 'join-code-expired';
  END IF;

  v_home_id := v_home_record.id;

  -- Check for existing membership to prevent duplicates
  IF EXISTS (SELECT 1 FROM home_members WHERE user_email = v_user_email AND home_id = v_home_id) THEN
    RAISE EXCEPTION 'already-a-member';
  END IF;

  -- Insert into home_members
  INSERT INTO home_members (user_email, home_id, role, joined_at)
  VALUES (v_user_email, v_home_id, 'member', now());

  -- Backward compat: update users.home_id
  UPDATE users SET home_id = v_home_id, home_joined_at = NOW() WHERE email = v_user_email;

  -- Migrate orphaned data
  UPDATE user_pantry SET home_id = v_home_id WHERE user_email = v_user_email AND home_id IS NULL;

  DELETE FROM shopping_lists
  WHERE user_email = v_user_email AND home_id IS NULL
    AND name IN (SELECT name FROM shopping_lists WHERE home_id = v_home_id);

  UPDATE shopping_lists SET home_id = v_home_id WHERE user_email = v_user_email AND home_id IS NULL;
  UPDATE shopping_list_items SET home_id = v_home_id WHERE user_email = v_user_email AND home_id IS NULL;

  RETURN v_home_id;
END;
$$;

-- accept_invitation(): users can now accept invitations to multiple homes
CREATE OR REPLACE FUNCTION public.accept_invitation(p_token text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_email TEXT;
  v_invitation RECORD;
  v_home_id UUID;
BEGIN
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  -- No longer check for existing home - users can have multiple

  -- Find and validate the invitation
  SELECT * INTO v_invitation
  FROM home_invitations
  WHERE token = p_token
    AND status = 'pending';

  IF v_invitation.id IS NULL THEN
    RAISE EXCEPTION 'invalid-invitation-token';
  END IF;

  IF v_invitation.expires_at < now() THEN
    UPDATE home_invitations SET status = 'expired', responded_at = now() WHERE id = v_invitation.id;
    RAISE EXCEPTION 'invitation-expired';
  END IF;

  IF LOWER(v_invitation.invited_email) != LOWER(v_user_email) THEN
    RAISE EXCEPTION 'invitation-not-for-user';
  END IF;

  v_home_id := v_invitation.home_id;

  -- Update invitation status
  UPDATE home_invitations
  SET status = 'accepted', responded_at = now()
  WHERE id = v_invitation.id;

  -- Insert into home_members (ignore if already a member)
  INSERT INTO home_members (user_email, home_id, role, joined_at)
  VALUES (v_user_email, v_home_id, 'member', now())
  ON CONFLICT (user_email, home_id) DO NOTHING;

  -- Backward compat: update users.home_id
  UPDATE users SET home_id = v_home_id, home_joined_at = NOW() WHERE email = v_user_email;

  -- Migrate orphaned data
  UPDATE user_pantry SET home_id = v_home_id WHERE user_email = v_user_email AND home_id IS NULL;

  DELETE FROM shopping_lists
  WHERE user_email = v_user_email AND home_id IS NULL
    AND name IN (SELECT name FROM shopping_lists WHERE home_id = v_home_id);

  UPDATE shopping_lists SET home_id = v_home_id WHERE user_email = v_user_email AND home_id IS NULL;
  UPDATE shopping_list_items SET home_id = v_home_id WHERE user_email = v_user_email AND home_id IS NULL;

  RETURN v_home_id;
END;
$$;

-- leave_home(): signature changes (added p_home_id param) - must DROP then CREATE
DROP FUNCTION IF EXISTS public.leave_home();

CREATE FUNCTION public.leave_home(p_home_id uuid DEFAULT NULL) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_email TEXT;
  v_home_id UUID;
  v_member_count INTEGER;
  v_next_home_id UUID;
BEGIN
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  -- Determine which home to leave
  IF p_home_id IS NOT NULL THEN
    v_home_id := p_home_id;
  ELSE
    v_home_id := get_current_user_home_id();
  END IF;

  IF v_home_id IS NULL THEN
    RAISE EXCEPTION 'user-has-no-home';
  END IF;

  -- Verify the user is a member of this home
  IF NOT EXISTS (SELECT 1 FROM home_members WHERE user_email = v_user_email AND home_id = v_home_id) THEN
    RAISE EXCEPTION 'user-has-no-home';
  END IF;

  -- Count members in the home
  SELECT COUNT(*) INTO v_member_count
  FROM home_members
  WHERE home_id = v_home_id;

  -- Orphan the user's pantry/shopping data for this home
  UPDATE user_pantry SET home_id = NULL WHERE user_email = v_user_email AND home_id = v_home_id;
  UPDATE shopping_lists SET home_id = NULL WHERE user_email = v_user_email AND home_id = v_home_id;
  UPDATE shopping_list_items SET home_id = NULL WHERE user_email = v_user_email AND home_id = v_home_id;

  -- Delete from home_members
  DELETE FROM home_members WHERE user_email = v_user_email AND home_id = v_home_id;

  -- If this was the last member, delete the home
  IF v_member_count <= 1 THEN
    DELETE FROM homes WHERE id = v_home_id;
  END IF;

  -- Update users.home_id to another home (or NULL if no homes left)
  SELECT hm.home_id INTO v_next_home_id
  FROM home_members hm
  WHERE hm.user_email = v_user_email
  ORDER BY hm.joined_at ASC
  LIMIT 1;

  UPDATE users SET
    home_id = v_next_home_id,
    home_joined_at = CASE WHEN v_next_home_id IS NOT NULL THEN home_joined_at ELSE NULL END
  WHERE email = v_user_email;
END;
$$;

GRANT EXECUTE ON FUNCTION public.leave_home(uuid) TO authenticated;

-- remove_home_member(): use home_members
CREATE OR REPLACE FUNCTION public.remove_home_member(p_member_email text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_email TEXT;
  v_home_id UUID;
  v_member_count INTEGER;
  v_target_next_home UUID;
BEGIN
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  -- Use active home from context
  v_home_id := get_current_user_home_id();

  IF v_home_id IS NULL THEN
    RAISE EXCEPTION 'user-has-no-home';
  END IF;

  -- Cannot remove yourself - use leave_home() instead
  IF LOWER(TRIM(p_member_email)) = LOWER(v_user_email) THEN
    RAISE EXCEPTION 'cannot-remove-self';
  END IF;

  -- Verify target user is in the same home (via home_members)
  IF NOT EXISTS (
    SELECT 1 FROM home_members
    WHERE user_email = LOWER(TRIM(p_member_email)) AND home_id = v_home_id
  ) THEN
    RAISE EXCEPTION 'member-not-found';
  END IF;

  -- Count members in the home
  SELECT COUNT(*) INTO v_member_count
  FROM home_members
  WHERE home_id = v_home_id;

  -- Orphan the target user's data for this home
  UPDATE user_pantry SET home_id = NULL
  WHERE user_email = LOWER(TRIM(p_member_email)) AND home_id = v_home_id;

  UPDATE shopping_lists SET home_id = NULL
  WHERE user_email = LOWER(TRIM(p_member_email)) AND home_id = v_home_id;

  UPDATE shopping_list_items SET home_id = NULL
  WHERE user_email = LOWER(TRIM(p_member_email)) AND home_id = v_home_id;

  -- Delete from home_members
  DELETE FROM home_members
  WHERE user_email = LOWER(TRIM(p_member_email)) AND home_id = v_home_id;

  -- Update removed member's users.home_id to another home (or NULL)
  SELECT hm.home_id INTO v_target_next_home
  FROM home_members hm
  WHERE hm.user_email = LOWER(TRIM(p_member_email))
  ORDER BY hm.joined_at ASC
  LIMIT 1;

  UPDATE users SET
    home_id = v_target_next_home,
    home_joined_at = CASE WHEN v_target_next_home IS NOT NULL THEN home_joined_at ELSE NULL END
  WHERE email = LOWER(TRIM(p_member_email));

  -- If this was the last member, delete the home
  IF v_member_count <= 1 THEN
    DELETE FROM homes WHERE id = v_home_id;
  END IF;
END;
$$;

-- get_home_info(): query members from home_members
-- Accepts optional p_home_id; if NULL falls back to default home
DROP FUNCTION IF EXISTS public.get_home_info();
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

  -- Get members from home_members JOIN users
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
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

-- update_home_name(): use get_current_user_home_id()
CREATE OR REPLACE FUNCTION public.update_home_name(p_name text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_email TEXT;
  v_home_id UUID;
BEGIN
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  v_home_id := get_current_user_home_id();

  IF v_home_id IS NULL THEN
    RAISE EXCEPTION 'user-has-no-home';
  END IF;

  IF p_name IS NULL OR LENGTH(TRIM(p_name)) < 1 OR LENGTH(TRIM(p_name)) > 255 THEN
    RAISE EXCEPTION 'invalid-home-name';
  END IF;

  UPDATE homes
  SET name = TRIM(p_name)
  WHERE id = v_home_id;
END;
$$;

-- generate_join_code(): use get_current_user_home_id()
CREATE OR REPLACE FUNCTION public.generate_join_code(p_expires_hours integer DEFAULT 168) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  v_user_email TEXT;
  v_home_id UUID;
  v_join_code TEXT;
  v_attempts INTEGER := 0;
  v_max_attempts INTEGER := 10;
BEGIN
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  v_home_id := get_current_user_home_id();

  IF v_home_id IS NULL THEN
    RAISE EXCEPTION 'user-has-no-home';
  END IF;

  -- Generate unique 8-character alphanumeric code
  LOOP
    v_join_code := UPPER(SUBSTRING(encode(gen_random_bytes(6), 'base64') FROM 1 FOR 8));
    v_join_code := REPLACE(v_join_code, '0', 'X');
    v_join_code := REPLACE(v_join_code, 'O', 'Y');
    v_join_code := REPLACE(v_join_code, 'I', 'Z');
    v_join_code := REPLACE(v_join_code, 'L', 'W');
    v_join_code := REPLACE(v_join_code, '+', 'A');
    v_join_code := REPLACE(v_join_code, '/', 'B');

    v_join_code := SUBSTRING(v_join_code FROM 1 FOR 8);

    IF NOT EXISTS (SELECT 1 FROM homes WHERE join_code = v_join_code AND id != v_home_id) THEN
      EXIT;
    END IF;

    v_attempts := v_attempts + 1;
    IF v_attempts >= v_max_attempts THEN
      RAISE EXCEPTION 'failed-to-generate-unique-code';
    END IF;
  END LOOP;

  UPDATE homes
  SET
    join_code = v_join_code,
    join_code_expires_at = now() + (p_expires_hours || ' hours')::INTERVAL
  WHERE id = v_home_id;

  RETURN v_join_code;
END;
$$;

-- disable_join_code(): use get_current_user_home_id()
CREATE OR REPLACE FUNCTION public.disable_join_code() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_email TEXT;
  v_home_id UUID;
BEGIN
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  v_home_id := get_current_user_home_id();

  IF v_home_id IS NULL THEN
    RAISE EXCEPTION 'user-has-no-home';
  END IF;

  UPDATE homes
  SET
    join_code = NULL,
    join_code_expires_at = NULL
  WHERE id = v_home_id;
END;
$$;

-- invite_to_home(): use get_current_user_home_id() and check home_members for membership
CREATE OR REPLACE FUNCTION public.invite_to_home(p_email text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  v_user_email TEXT;
  v_home_id UUID;
  v_home_name TEXT;
  v_token TEXT;
  v_invitation_id UUID;
  v_base_url TEXT := 'https://matrummet.stenberg.io';
BEGIN
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  -- Get active home and its name
  v_home_id := get_current_user_home_id();

  IF v_home_id IS NULL THEN
    RAISE EXCEPTION 'user-has-no-home';
  END IF;

  SELECT name INTO v_home_name FROM homes WHERE id = v_home_id;

  -- Validate email
  IF p_email IS NULL OR LENGTH(TRIM(p_email)) < 1 THEN
    RAISE EXCEPTION 'invalid-email';
  END IF;

  -- Check if user is trying to invite themselves
  IF LOWER(TRIM(p_email)) = LOWER(v_user_email) THEN
    RAISE EXCEPTION 'cannot-invite-self';
  END IF;

  -- Check if invited user is already a member (via home_members)
  IF EXISTS (SELECT 1 FROM home_members WHERE user_email = LOWER(TRIM(p_email)) AND home_id = v_home_id) THEN
    RAISE EXCEPTION 'user-already-member';
  END IF;

  -- Check for existing pending invitation
  IF EXISTS (
    SELECT 1 FROM home_invitations
    WHERE home_id = v_home_id
      AND invited_email = LOWER(TRIM(p_email))
      AND status = 'pending'
      AND expires_at > now()
  ) THEN
    RAISE EXCEPTION 'invitation-already-pending';
  END IF;

  -- Generate secure token
  v_token := encode(gen_random_bytes(32), 'hex');

  -- Create invitation
  INSERT INTO home_invitations (home_id, invited_email, invited_by_email, token)
  VALUES (v_home_id, LOWER(TRIM(p_email)), v_user_email, v_token)
  RETURNING id INTO v_invitation_id;

  -- Queue invitation email
  PERFORM queue_email(
    'home_invitation',
    LOWER(TRIM(p_email)),
    jsonb_build_object(
      'inviter_email', v_user_email,
      'home_name', v_home_name,
      'accept_link', v_base_url || '/hem/inbjudan/' || v_token
    )
  );

  RETURN v_invitation_id;
END;
$$;

-- cancel_invitation(): no home_id changes needed - uses invitation owner check
-- (verified: does not read users.home_id, just checks invited_by_email)

-- decline_invitation(): no home_id changes needed
-- (verified: does not read users.home_id, just checks invitation token)

-- get_pending_invitations(): no home_id changes needed
-- (verified: queries home_invitations by invited_email, does not read users.home_id)

-- ============================================================================
-- PART 7: Rewrite ALL pantry functions
-- ============================================================================

-- add_to_pantry(): use get_current_user_home_id()
CREATE OR REPLACE FUNCTION public.add_to_pantry(p_food_id uuid, p_quantity numeric DEFAULT NULL::numeric, p_unit text DEFAULT NULL::text, p_expires_at date DEFAULT NULL::date) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_email TEXT;
  v_home_id UUID;
  v_pantry_id UUID;
BEGIN
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  v_home_id := get_current_user_home_id();

  IF v_home_id IS NULL THEN
    RAISE EXCEPTION 'user-has-no-home';
  END IF;

  -- Validate food_id exists
  IF NOT EXISTS (SELECT 1 FROM foods WHERE id = p_food_id) THEN
    RAISE EXCEPTION 'food-not-found';
  END IF;

  -- Upsert into pantry (keyed by home_id + food_id)
  INSERT INTO user_pantry (user_email, home_id, food_id, quantity, unit, expires_at)
  VALUES (v_user_email, v_home_id, p_food_id, p_quantity, p_unit, p_expires_at)
  ON CONFLICT (home_id, food_id) DO UPDATE SET
    quantity = EXCLUDED.quantity,
    unit = EXCLUDED.unit,
    expires_at = EXCLUDED.expires_at,
    added_at = NOW(),
    user_email = EXCLUDED.user_email
  RETURNING id INTO v_pantry_id;

  RETURN v_pantry_id;
END;
$$;

-- remove_from_pantry(): use get_current_user_home_id()
CREATE OR REPLACE FUNCTION public.remove_from_pantry(p_food_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_email TEXT;
  v_home_id UUID;
  v_deleted INTEGER;
BEGIN
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  v_home_id := get_current_user_home_id();

  IF v_home_id IS NULL THEN
    RAISE EXCEPTION 'user-has-no-home';
  END IF;

  DELETE FROM user_pantry
  WHERE home_id = v_home_id AND food_id = p_food_id;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN v_deleted > 0;
END;
$$;

-- get_user_pantry(): use get_current_user_home_id()
CREATE OR REPLACE FUNCTION public.get_user_pantry() RETURNS TABLE(id uuid, food_id uuid, food_name text, quantity numeric, unit text, added_at timestamp with time zone, expires_at date, is_expired boolean, added_by text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_email TEXT;
  v_home_id UUID;
BEGIN
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  v_home_id := get_current_user_home_id();

  -- If user has no home, return empty result (not an error)
  IF v_home_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    up.id,
    up.food_id,
    f.name AS food_name,
    up.quantity,
    up.unit,
    up.added_at,
    up.expires_at,
    CASE
      WHEN up.expires_at IS NULL THEN FALSE
      ELSE up.expires_at < CURRENT_DATE
    END AS is_expired,
    up.user_email AS added_by
  FROM user_pantry up
  JOIN foods f ON f.id = up.food_id
  WHERE up.home_id = v_home_id
  ORDER BY
    CASE WHEN up.expires_at IS NOT NULL AND up.expires_at < CURRENT_DATE THEN 0 ELSE 1 END,
    up.expires_at NULLS LAST,
    f.name;
END;
$$;

-- find_recipes_from_pantry(): use get_current_user_home_id()
CREATE OR REPLACE FUNCTION public.find_recipes_from_pantry(p_min_match_percentage integer DEFAULT 50, p_limit integer DEFAULT 20) RETURNS TABLE(recipe_id uuid, name text, description text, image text, categories text[], total_ingredients integer, matching_ingredients integer, match_percentage integer, missing_food_ids uuid[], missing_food_names text[], owner text, prep_time integer, cook_time integer, recipe_yield integer, recipe_yield_name text)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_email TEXT;
  v_home_id UUID;
  v_pantry_food_ids UUID[];
BEGIN
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  v_home_id := get_current_user_home_id();

  -- If user has no home, return empty result (not an error)
  IF v_home_id IS NULL THEN
    RETURN;
  END IF;

  -- Get all food_ids from home's pantry
  SELECT ARRAY_AGG(up.food_id)
  INTO v_pantry_food_ids
  FROM user_pantry up
  WHERE up.home_id = v_home_id;

  -- If pantry is empty, return no results
  IF v_pantry_food_ids IS NULL OR array_length(v_pantry_food_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  -- Use the main function to find matching recipes
  RETURN QUERY
  SELECT *
  FROM find_recipes_by_ingredients(v_pantry_food_ids, NULL, p_min_match_percentage, p_limit);
END;
$$;

-- deduct_from_pantry() [defined in V8]: use get_current_user_home_id()
CREATE OR REPLACE FUNCTION public.deduct_from_pantry(p_deductions jsonb) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_email TEXT;
  v_home_id UUID;
  v_updated_count INTEGER := 0;
  v_deduction RECORD;
  v_food_id UUID;
  v_canonical_food_id UUID;
  v_amount NUMERIC;
  v_current_quantity NUMERIC;
BEGIN
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  v_home_id := get_current_user_home_id();

  IF v_home_id IS NULL THEN
    RAISE EXCEPTION 'user-has-no-home';
  END IF;

  -- Validate input
  IF p_deductions IS NULL OR jsonb_array_length(p_deductions) = 0 THEN
    RAISE EXCEPTION 'invalid-deductions: empty array';
  END IF;

  -- Process each deduction
  FOR v_deduction IN SELECT * FROM jsonb_array_elements(p_deductions)
  LOOP
    -- Parse and validate food_id
    BEGIN
      v_food_id := (v_deduction.value->>'food_id')::UUID;
    EXCEPTION WHEN OTHERS THEN
      CONTINUE;
    END;

    -- Parse and validate amount
    v_amount := (v_deduction.value->>'amount')::NUMERIC;
    IF v_amount IS NULL OR v_amount <= 0 THEN
      CONTINUE;
    END IF;

    -- Resolve canonical food ID
    v_canonical_food_id := resolve_canonical(v_food_id);

    -- Get current quantity
    SELECT quantity INTO v_current_quantity
    FROM user_pantry
    WHERE home_id = v_home_id AND food_id = v_canonical_food_id;

    -- Skip if item not in pantry
    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    -- If quantity is NULL (untracked) or would go to zero or below, remove the item
    IF v_current_quantity IS NULL OR (v_current_quantity - v_amount) <= 0 THEN
      DELETE FROM user_pantry
      WHERE home_id = v_home_id AND food_id = v_canonical_food_id;
      v_updated_count := v_updated_count + 1;
    ELSE
      -- Subtract the amount
      UPDATE user_pantry
      SET quantity = quantity - v_amount
      WHERE home_id = v_home_id AND food_id = v_canonical_food_id;
      v_updated_count := v_updated_count + 1;
    END IF;
  END LOOP;

  RETURN v_updated_count;
END;
$$;

-- ============================================================================
-- PART 8: Rewrite ALL shopping list functions
-- ============================================================================

-- create_shopping_list(): use get_current_user_home_id()
CREATE OR REPLACE FUNCTION public.create_shopping_list(p_name text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_email TEXT;
  v_home_id UUID;
  v_list_id UUID;
  v_is_first_list BOOLEAN;
BEGIN
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  v_home_id := get_current_user_home_id();

  -- Validate name
  IF p_name IS NULL OR LENGTH(TRIM(p_name)) < 1 THEN
    RAISE EXCEPTION 'invalid-list-name';
  END IF;

  -- Check if this is the first list for the user/home
  IF v_home_id IS NOT NULL THEN
    SELECT NOT EXISTS (
      SELECT 1 FROM shopping_lists WHERE home_id = v_home_id
    ) INTO v_is_first_list;
  ELSE
    SELECT NOT EXISTS (
      SELECT 1 FROM shopping_lists WHERE home_id IS NULL AND user_email = v_user_email
    ) INTO v_is_first_list;
  END IF;

  INSERT INTO shopping_lists (user_email, home_id, name, is_default)
  VALUES (v_user_email, v_home_id, TRIM(p_name), v_is_first_list)
  RETURNING id INTO v_list_id;

  RETURN v_list_id;
END;
$$;

-- get_user_shopping_lists(): use get_current_user_home_id()
CREATE OR REPLACE FUNCTION public.get_user_shopping_lists() RETURNS TABLE(id uuid, name text, is_default boolean, item_count bigint, checked_count bigint, date_published timestamp with time zone, date_modified timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_email TEXT;
  v_home_id UUID;
BEGIN
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  v_home_id := get_current_user_home_id();

  RETURN QUERY
  SELECT
    sl.id,
    sl.name,
    sl.is_default,
    COUNT(sli.id) AS item_count,
    COUNT(sli.id) FILTER (WHERE sli.is_checked) AS checked_count,
    sl.date_published,
    sl.date_modified
  FROM shopping_lists sl
  LEFT JOIN shopping_list_items sli ON sli.shopping_list_id = sl.id
  WHERE (
    (sl.home_id IS NOT NULL AND sl.home_id = v_home_id)
    OR (sl.home_id IS NULL AND sl.user_email = v_user_email)
  )
  GROUP BY sl.id
  ORDER BY sl.is_default DESC, sl.date_modified DESC;
END;
$$;

-- get_or_create_default_shopping_list(): use get_current_user_home_id()
CREATE OR REPLACE FUNCTION public.get_or_create_default_shopping_list() RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_email TEXT;
  v_home_id UUID;
  v_list_id UUID;
BEGIN
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  v_home_id := get_current_user_home_id();

  IF v_home_id IS NOT NULL THEN
    -- Home-based: find default list for the home
    SELECT id INTO v_list_id
    FROM shopping_lists
    WHERE home_id = v_home_id AND is_default = true;

    IF v_list_id IS NOT NULL THEN
      RETURN v_list_id;
    END IF;

    INSERT INTO shopping_lists (user_email, home_id, name, is_default)
    VALUES (v_user_email, v_home_id, 'Inköpslista', true)
    ON CONFLICT (home_id, name) DO UPDATE SET is_default = true
    RETURNING id INTO v_list_id;
  ELSE
    -- Personal: find default list for the user (no home)
    SELECT id INTO v_list_id
    FROM shopping_lists
    WHERE home_id IS NULL AND user_email = v_user_email AND is_default = true;

    IF v_list_id IS NOT NULL THEN
      RETURN v_list_id;
    END IF;

    INSERT INTO shopping_lists (user_email, home_id, name, is_default)
    VALUES (v_user_email, NULL, 'Inköpslista', true)
    RETURNING id INTO v_list_id;
  END IF;

  RETURN v_list_id;
END;
$$;

-- add_recipe_to_shopping_list(): use get_current_user_home_id()
CREATE OR REPLACE FUNCTION public.add_recipe_to_shopping_list(p_recipe_id uuid, p_shopping_list_id uuid DEFAULT NULL::uuid, p_servings integer DEFAULT NULL::integer, p_ingredient_ids uuid[] DEFAULT NULL::uuid[]) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_email TEXT;
  v_home_id UUID;
  v_list_id UUID;
  v_recipe_name TEXT;
  v_recipe_yield INTEGER;
  v_scale_factor NUMERIC;
  v_added_count INTEGER := 0;
  v_ingredient RECORD;
  v_existing_item_id UUID;
  v_new_item_id UUID;
  v_ingredient_quantity NUMERIC;
  v_scaled_quantity NUMERIC;
  v_canonical_food_id UUID;
  v_valid_unit_id UUID;
BEGIN
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  -- Get user's home_id (may be NULL for personal use)
  v_home_id := get_current_user_home_id();

  -- Get recipe details
  SELECT name, recipe_yield INTO v_recipe_name, v_recipe_yield
  FROM recipes
  WHERE id = p_recipe_id;

  IF v_recipe_name IS NULL THEN
    RAISE EXCEPTION 'recipe-not-found';
  END IF;

  -- Get or create shopping list
  IF p_shopping_list_id IS NOT NULL THEN
    SELECT id INTO v_list_id
    FROM shopping_lists
    WHERE id = p_shopping_list_id
      AND (
        (home_id IS NOT NULL AND home_id = v_home_id)
        OR (home_id IS NULL AND user_email = v_user_email)
      );

    IF v_list_id IS NULL THEN
      RAISE EXCEPTION 'shopping-list-not-found';
    END IF;
  ELSE
    v_list_id := get_or_create_default_shopping_list();
  END IF;

  -- Calculate scale factor
  IF p_servings IS NOT NULL AND v_recipe_yield IS NOT NULL AND v_recipe_yield > 0 THEN
    v_scale_factor := p_servings::NUMERIC / v_recipe_yield::NUMERIC;
  ELSE
    v_scale_factor := 1.0;
  END IF;

  -- Process each ingredient
  FOR v_ingredient IN
    SELECT
      i.id,
      i.name,
      i.measurement,
      i.quantity,
      i.food_id,
      i.unit_id
    FROM ingredients i
    WHERE i.recipe_id = p_recipe_id
      AND (p_ingredient_ids IS NULL OR i.id = ANY(p_ingredient_ids))
  LOOP
    -- Parse quantity
    BEGIN
      v_ingredient_quantity := v_ingredient.quantity::NUMERIC;
    EXCEPTION WHEN OTHERS THEN
      v_ingredient_quantity := 1;
    END;

    v_scaled_quantity := v_ingredient_quantity * v_scale_factor;

    -- Validate unit_id exists in units table, fallback to NULL
    IF v_ingredient.unit_id IS NOT NULL THEN
      SELECT id INTO v_valid_unit_id FROM units WHERE id = v_ingredient.unit_id;
    ELSE
      v_valid_unit_id := NULL;
    END IF;

    -- Resolve ingredient food_id to canonical for merge check
    IF v_ingredient.food_id IS NOT NULL THEN
      v_canonical_food_id := resolve_canonical(v_ingredient.food_id);

      SELECT sli.id INTO v_existing_item_id
      FROM shopping_list_items sli
      LEFT JOIN foods f ON f.id = sli.food_id
      WHERE sli.shopping_list_id = v_list_id
        AND COALESCE(f.canonical_food_id, sli.food_id) = v_canonical_food_id
        AND sli.unit_id IS NOT DISTINCT FROM v_valid_unit_id
        AND sli.is_checked = false;
    ELSE
      v_existing_item_id := NULL;
    END IF;

    IF v_existing_item_id IS NOT NULL THEN
      UPDATE shopping_list_items
      SET quantity = quantity + v_scaled_quantity
      WHERE id = v_existing_item_id;

      v_new_item_id := v_existing_item_id;
    ELSE
      INSERT INTO shopping_list_items (
        shopping_list_id,
        home_id,
        food_id,
        unit_id,
        display_name,
        display_unit,
        quantity,
        user_email,
        sort_order
      )
      VALUES (
        v_list_id,
        v_home_id,
        v_ingredient.food_id,
        v_valid_unit_id,
        v_ingredient.name,
        COALESCE(v_ingredient.measurement, ''),
        v_scaled_quantity,
        v_user_email,
        (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM shopping_list_items WHERE shopping_list_id = v_list_id)
      )
      RETURNING id INTO v_new_item_id;
    END IF;

    -- Insert source tracking record
    INSERT INTO shopping_list_item_sources (
      shopping_list_item_id,
      recipe_id,
      recipe_name,
      quantity_added,
      servings_used,
      user_email
    )
    VALUES (
      v_new_item_id,
      p_recipe_id,
      v_recipe_name,
      v_scaled_quantity,
      p_servings,
      v_user_email
    );

    v_added_count := v_added_count + 1;
  END LOOP;

  -- Update shopping list modified timestamp
  UPDATE shopping_lists SET date_modified = now() WHERE id = v_list_id;

  RETURN jsonb_build_object(
    'added_count', v_added_count,
    'list_id', v_list_id
  );
END;
$$;

-- add_custom_shopping_list_item() [defined in V10, updated in V18]: use get_current_user_home_id()
CREATE OR REPLACE FUNCTION public.add_custom_shopping_list_item(
  p_name TEXT,
  p_shopping_list_id UUID DEFAULT NULL::UUID,
  p_food_id UUID DEFAULT NULL::UUID
) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_email TEXT;
  v_home_id UUID;
  v_list_id UUID;
  v_trimmed_name TEXT;
  v_new_item_id UUID;
  v_existing_item_id UUID;
  v_canonical_food_id UUID;
BEGIN
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  v_home_id := get_current_user_home_id();

  -- Validate name
  v_trimmed_name := btrim(p_name);
  IF v_trimmed_name = '' THEN
    RAISE EXCEPTION 'name-is-empty';
  END IF;

  -- Get or create shopping list
  IF p_shopping_list_id IS NOT NULL THEN
    SELECT id INTO v_list_id
    FROM shopping_lists
    WHERE id = p_shopping_list_id
      AND (
        (home_id IS NOT NULL AND home_id = v_home_id)
        OR (home_id IS NULL AND user_email = v_user_email)
      );

    IF v_list_id IS NULL THEN
      RAISE EXCEPTION 'shopping-list-not-found';
    END IF;
  ELSE
    v_list_id := get_or_create_default_shopping_list();
  END IF;

  -- If food_id provided, check for existing unchecked item to merge
  IF p_food_id IS NOT NULL THEN
    v_canonical_food_id := resolve_canonical(p_food_id);

    SELECT sli.id INTO v_existing_item_id
    FROM shopping_list_items sli
    LEFT JOIN foods f ON f.id = sli.food_id
    WHERE sli.shopping_list_id = v_list_id
      AND COALESCE(f.canonical_food_id, sli.food_id) = v_canonical_food_id
      AND sli.is_checked = false;
  END IF;

  IF v_existing_item_id IS NOT NULL THEN
    UPDATE shopping_list_items
    SET quantity = quantity + 1
    WHERE id = v_existing_item_id;

    v_new_item_id := v_existing_item_id;
  ELSE
    INSERT INTO shopping_list_items (
      shopping_list_id,
      home_id,
      food_id,
      unit_id,
      display_name,
      display_unit,
      quantity,
      user_email,
      sort_order
    )
    VALUES (
      v_list_id,
      v_home_id,
      p_food_id,
      NULL,
      v_trimmed_name,
      '',
      1,
      v_user_email,
      (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM shopping_list_items WHERE shopping_list_id = v_list_id)
    )
    RETURNING id INTO v_new_item_id;
  END IF;

  UPDATE shopping_lists SET date_modified = now() WHERE id = v_list_id;

  RETURN jsonb_build_object(
    'item_id', v_new_item_id,
    'list_id', v_list_id
  );
END;
$$;

-- toggle_shopping_list_item(): use get_current_user_home_id()
CREATE OR REPLACE FUNCTION public.toggle_shopping_list_item(p_item_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_email TEXT;
  v_home_id UUID;
  v_is_checked BOOLEAN;
  v_list_id UUID;
  v_food_id UUID;
  v_quantity DECIMAL;
  v_unit TEXT;
BEGIN
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  v_home_id := get_current_user_home_id();

  -- Get current state and verify ownership
  SELECT is_checked, shopping_list_id, food_id, quantity, display_unit
  INTO v_is_checked, v_list_id, v_food_id, v_quantity, v_unit
  FROM shopping_list_items
  WHERE id = p_item_id
    AND (
      (home_id IS NOT NULL AND home_id = v_home_id)
      OR (home_id IS NULL AND user_email = v_user_email)
    );

  IF v_is_checked IS NULL THEN
    RAISE EXCEPTION 'item-not-found';
  END IF;

  -- Toggle the checked state
  UPDATE shopping_list_items
  SET
    is_checked = NOT v_is_checked,
    checked_at = CASE WHEN v_is_checked THEN NULL ELSE now() END
  WHERE id = p_item_id;

  UPDATE shopping_lists SET date_modified = now() WHERE id = v_list_id;

  -- If checking the item and it has a food_id and user has a home, add to pantry
  IF NOT v_is_checked AND v_food_id IS NOT NULL AND v_home_id IS NOT NULL THEN
    INSERT INTO user_pantry (user_email, home_id, food_id, quantity, unit)
    VALUES (v_user_email, v_home_id, v_food_id, v_quantity, v_unit)
    ON CONFLICT (home_id, food_id) DO UPDATE SET
      quantity = COALESCE(user_pantry.quantity, 0) + COALESCE(EXCLUDED.quantity, 0),
      unit = COALESCE(EXCLUDED.unit, user_pantry.unit),
      added_at = NOW(),
      user_email = EXCLUDED.user_email;
  END IF;

  RETURN jsonb_build_object('is_checked', NOT v_is_checked);
END;
$$;

-- clear_checked_items(): use get_current_user_home_id()
CREATE OR REPLACE FUNCTION public.clear_checked_items(p_shopping_list_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_email TEXT;
  v_home_id UUID;
  v_list_id UUID;
  v_deleted_count INTEGER;
BEGIN
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  v_home_id := get_current_user_home_id();

  IF p_shopping_list_id IS NOT NULL THEN
    SELECT id INTO v_list_id
    FROM shopping_lists
    WHERE id = p_shopping_list_id
      AND (
        (home_id IS NOT NULL AND home_id = v_home_id)
        OR (home_id IS NULL AND user_email = v_user_email)
      );

    IF v_list_id IS NULL THEN
      RAISE EXCEPTION 'shopping-list-not-found';
    END IF;
  ELSE
    v_list_id := get_or_create_default_shopping_list();
  END IF;

  DELETE FROM shopping_list_items
  WHERE shopping_list_id = v_list_id AND is_checked = true;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  UPDATE shopping_lists SET date_modified = now() WHERE id = v_list_id;

  RETURN jsonb_build_object('deleted_count', v_deleted_count);
END;
$$;

-- delete_shopping_list(): use get_current_user_home_id()
CREATE OR REPLACE FUNCTION public.delete_shopping_list(p_list_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_email TEXT;
  v_home_id UUID;
  v_list_record RECORD;
  v_list_count INTEGER;
  v_new_default_id UUID;
BEGIN
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  v_home_id := get_current_user_home_id();

  -- Get the list details and verify ownership
  SELECT id, is_default INTO v_list_record
  FROM shopping_lists
  WHERE id = p_list_id
    AND (
      (home_id IS NOT NULL AND home_id = v_home_id)
      OR (home_id IS NULL AND user_email = v_user_email)
    );

  IF v_list_record.id IS NULL THEN
    RAISE EXCEPTION 'shopping-list-not-found';
  END IF;

  -- Count user's/home's lists
  IF v_home_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_list_count
    FROM shopping_lists WHERE home_id = v_home_id;
  ELSE
    SELECT COUNT(*) INTO v_list_count
    FROM shopping_lists WHERE home_id IS NULL AND user_email = v_user_email;
  END IF;

  -- If deleting the default list and there are other lists, assign a new default
  IF v_list_record.is_default AND v_list_count > 1 THEN
    IF v_home_id IS NOT NULL THEN
      SELECT id INTO v_new_default_id
      FROM shopping_lists
      WHERE home_id = v_home_id AND id != p_list_id
      ORDER BY date_modified DESC LIMIT 1;
    ELSE
      SELECT id INTO v_new_default_id
      FROM shopping_lists
      WHERE home_id IS NULL AND user_email = v_user_email AND id != p_list_id
      ORDER BY date_modified DESC LIMIT 1;
    END IF;

    UPDATE shopping_lists SET is_default = true WHERE id = v_new_default_id;
  END IF;

  DELETE FROM shopping_lists WHERE id = p_list_id;
END;
$$;

-- rename_shopping_list(): use get_current_user_home_id()
CREATE OR REPLACE FUNCTION public.rename_shopping_list(p_list_id uuid, p_name text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_email TEXT;
  v_home_id UUID;
  v_list_exists BOOLEAN;
BEGIN
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  v_home_id := get_current_user_home_id();

  IF p_name IS NULL OR LENGTH(TRIM(p_name)) < 1 THEN
    RAISE EXCEPTION 'invalid-list-name';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM shopping_lists
    WHERE id = p_list_id
      AND (
        (home_id IS NOT NULL AND home_id = v_home_id)
        OR (home_id IS NULL AND user_email = v_user_email)
      )
  ) INTO v_list_exists;

  IF NOT v_list_exists THEN
    RAISE EXCEPTION 'shopping-list-not-found';
  END IF;

  UPDATE shopping_lists
  SET name = TRIM(p_name)
  WHERE id = p_list_id;
END;
$$;

-- set_default_shopping_list(): use get_current_user_home_id()
CREATE OR REPLACE FUNCTION public.set_default_shopping_list(p_list_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_email TEXT;
  v_home_id UUID;
  v_list_exists BOOLEAN;
BEGIN
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  v_home_id := get_current_user_home_id();

  SELECT EXISTS (
    SELECT 1 FROM shopping_lists
    WHERE id = p_list_id
      AND (
        (home_id IS NOT NULL AND home_id = v_home_id)
        OR (home_id IS NULL AND user_email = v_user_email)
      )
  ) INTO v_list_exists;

  IF NOT v_list_exists THEN
    RAISE EXCEPTION 'shopping-list-not-found';
  END IF;

  -- Remove default from all other lists in the same scope
  IF v_home_id IS NOT NULL THEN
    UPDATE shopping_lists SET is_default = false
    WHERE home_id = v_home_id AND is_default = true;
  ELSE
    UPDATE shopping_lists SET is_default = false
    WHERE home_id IS NULL AND user_email = v_user_email AND is_default = true;
  END IF;

  UPDATE shopping_lists SET is_default = true WHERE id = p_list_id;
END;
$$;

-- ============================================================================
-- PART 9: Recreate user_recipes view
-- ============================================================================

-- The pantry lateral join currently uses up.user_email = jwt_email.
-- Change to up.home_id = get_current_user_home_id().
DROP VIEW IF EXISTS public.user_recipes CASCADE;

CREATE VIEW public.user_recipes WITH (security_invoker='on') AS
 SELECT recipes.id,
    recipes.name,
    recipes.description,
    recipes.author,
    recipes.url,
    recipes.image,
    recipes.thumbnail,
    recipes.recipe_yield,
    recipes.recipe_yield_name,
    recipes.prep_time,
    recipes.cook_time,
    recipes.cuisine,
    recipes.date_published,
    recipes.date_modified,
    recipes.visibility,
    recipes.copied_from_recipe_id,
    recipes.copied_from_author_name,
    recipes.is_featured,
    COALESCE(ARRAY( SELECT jsonb_array_elements_text(rc.categories) AS jsonb_array_elements_text), ARRAY[]::text[]) AS categories,
    ing_grp.ingredient_groups,
    ing.ingredients,
    ins_grp.instruction_groups,
    ins.instructions,
    to_tsvector('swedish'::regconfig, concat_ws(' '::text, recipes.name, recipes.description, ing.names, ing.forms, jsonb_path_query_array(rc.categories, '$'::jsonpath), ins.steps)) AS full_tsv,
    (EXISTS ( SELECT 1
           FROM public.recipe_likes
          WHERE ((recipe_likes.recipe_id = recipes.id) AND (recipe_likes.user_email = ((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'email'::text))))) AS is_liked,
    COALESCE(pantry_stats.matching_count, (0)::bigint) AS pantry_matching_count,
    COALESCE(pantry_stats.total_count, (0)::bigint) AS pantry_total_count,
        CASE
            WHEN (COALESCE(pantry_stats.total_count, (0)::bigint) = 0) THEN 0
            ELSE (((COALESCE(pantry_stats.matching_count, (0)::bigint) * 100) / pantry_stats.total_count))::integer
        END AS pantry_match_percentage,
    public.get_user_display_name(recipes.owner) AS owner_name,
    public.get_user_id(recipes.owner) AS owner_id,
    (recipes.copied_from_recipe_id IS NOT NULL) AS is_copy,
    (recipes.owner = ((current_setting('request.jwt.claims'::text, true))::jsonb ->> 'email'::text)) AS is_owner
   FROM (((((((public.recipes
     LEFT JOIN LATERAL ( SELECT jsonb_agg(rc_categories.name) AS categories
           FROM ( SELECT categories.name
                   FROM public.categories,
                    public.recipe_categories
                  WHERE ((recipe_categories.category = categories.id) AND (recipe_categories.recipe = recipes.id))) rc_categories) rc ON (true))
     LEFT JOIN LATERAL ( SELECT COALESCE(array_agg(DISTINCT COALESCE(f.canonical_food_id, up.food_id)), ARRAY[]::uuid[]) AS food_ids
           FROM (public.user_pantry up
             LEFT JOIN public.foods f ON ((f.id = up.food_id)))
          WHERE (up.home_id = public.get_current_user_home_id())) pantry ON (true))
     LEFT JOIN LATERAL ( SELECT jsonb_agg(jsonb_build_object('id', ig.id, 'name', ig.name, 'sort_order', ig.sort_order) ORDER BY ig.sort_order) AS ingredient_groups
           FROM public.ingredient_groups ig
          WHERE (ig.recipe_id = recipes.id)) ing_grp ON (true))
     LEFT JOIN LATERAL ( SELECT jsonb_agg(jsonb_build_object('id', ingredient.id, 'name', COALESCE(food.name, ingredient.name), 'measurement', COALESCE(NULLIF(unit.abbreviation, ''::text), unit.name, ingredient.measurement), 'quantity', ingredient.quantity, 'form', ingredient.form, 'group_id', ingredient.group_id, 'sort_order', ingredient.sort_order, 'food_id', ingredient.food_id, 'unit_id', ingredient.unit_id, 'in_pantry',
                CASE
                    WHEN (ingredient.food_id IS NULL) THEN false
                    WHEN (COALESCE(food.canonical_food_id, ingredient.food_id) = ANY (pantry.food_ids)) THEN true
                    ELSE false
                END) ORDER BY ig.sort_order NULLS FIRST, ingredient.sort_order) AS ingredients,
            string_agg(DISTINCT COALESCE(food.name, ingredient.name), ' '::text) AS names,
            string_agg(DISTINCT ingredient.form, ' '::text) FILTER (WHERE (ingredient.form IS NOT NULL)) AS forms
           FROM (((public.ingredients ingredient
             LEFT JOIN public.ingredient_groups ig ON ((ig.id = ingredient.group_id)))
             LEFT JOIN public.foods food ON ((food.id = ingredient.food_id)))
             LEFT JOIN public.units unit ON ((unit.id = ingredient.unit_id)))
          WHERE (ingredient.recipe_id = recipes.id)) ing ON (true))
     LEFT JOIN LATERAL ( SELECT jsonb_agg(jsonb_build_object('id', ig.id, 'name', ig.name, 'sort_order', ig.sort_order) ORDER BY ig.sort_order) AS instruction_groups
           FROM public.instruction_groups ig
          WHERE (ig.recipe_id = recipes.id)) ins_grp ON (true))
     LEFT JOIN LATERAL ( SELECT jsonb_agg(jsonb_build_object('id', instruction.id, 'step', instruction.step, 'group_id', instruction.group_id, 'sort_order', instruction.sort_order) ORDER BY ig.sort_order NULLS FIRST, instruction.sort_order) AS instructions,
            string_agg(instruction.step, ' '::text) AS steps
           FROM (public.instructions instruction
             LEFT JOIN public.instruction_groups ig ON ((ig.id = instruction.group_id)))
          WHERE (instruction.recipe_id = recipes.id)) ins ON (true))
     LEFT JOIN LATERAL ( SELECT count(*) FILTER (WHERE (COALESCE(f.canonical_food_id, i.food_id) = ANY (pantry.food_ids))) AS matching_count,
            count(*) AS total_count
           FROM (public.ingredients i
             LEFT JOIN public.foods f ON ((f.id = i.food_id)))
          WHERE ((i.recipe_id = recipes.id) AND (i.food_id IS NOT NULL))) pantry_stats ON (true));

-- Re-grant permissions on user_recipes
GRANT SELECT ON user_recipes TO authenticated;

-- Recreate search_recipes function that depends on user_recipes view
-- (It was dropped by CASCADE when we dropped user_recipes)
CREATE OR REPLACE FUNCTION public.search_recipes(p_query text, p_owner_only boolean DEFAULT false, p_category text DEFAULT NULL::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0) RETURNS SETOF public.user_recipes
    LANGUAGE sql STABLE
    SET search_path TO 'public', 'extensions'
    AS $$
  SELECT ur.* FROM user_recipes ur JOIN recipes r ON r.id = ur.id
  WHERE COALESCE(trim(p_query), '') != '' AND r.search_text ILIKE '%' || escape_like_pattern(p_query) || '%'
    AND (NOT p_owner_only OR ur.is_owner = TRUE)
    AND (p_category IS NULL OR p_category = ANY(ur.categories))
  ORDER BY CASE WHEN ur.name ILIKE escape_like_pattern(p_query) THEN 0 WHEN ur.name ILIKE escape_like_pattern(p_query) || '%' THEN 1 WHEN ur.name ILIKE '%' || escape_like_pattern(p_query) || '%' THEN 2 ELSE 3 END, word_similarity(p_query, ur.name) DESC, ur.date_published DESC
  LIMIT p_limit OFFSET p_offset;
$$;

GRANT ALL ON FUNCTION public.search_recipes(text, boolean, text, integer, integer) TO authenticated;

-- ============================================================================
-- PART 10: Grants
-- ============================================================================

GRANT SELECT ON home_members TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_homes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_home_info(UUID) TO authenticated;
