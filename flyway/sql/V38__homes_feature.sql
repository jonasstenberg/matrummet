-- V38: Homes Feature
-- Implements shared households for pantry and shopping lists
-- Allows multiple users to share a home and access shared resources

-- =============================================================================
-- 1. Homes Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS homes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (LENGTH(name) >= 1 AND LENGTH(name) <= 255),
  join_code TEXT UNIQUE CHECK (join_code IS NULL OR LENGTH(join_code) = 8),
  join_code_expires_at TIMESTAMPTZ,
  created_by_email TEXT REFERENCES users(email) ON DELETE SET NULL,
  date_published TIMESTAMPTZ DEFAULT now() NOT NULL,
  date_modified TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS homes_join_code_idx ON homes (join_code) WHERE join_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS homes_created_by_email_idx ON homes (created_by_email);

GRANT SELECT, INSERT, UPDATE, DELETE ON homes TO "authenticated";

DROP TRIGGER IF EXISTS set_timestamptz ON homes;
CREATE TRIGGER set_timestamptz
    BEFORE UPDATE ON homes
    FOR EACH ROW
    EXECUTE FUNCTION set_timestamptz();

ALTER TABLE homes ENABLE ROW LEVEL SECURITY;
ALTER TABLE homes FORCE ROW LEVEL SECURITY;

-- =============================================================================
-- 2. Home Invitations Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS home_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  home_id UUID NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  invited_by_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL CHECK (LENGTH(token) = 64),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'cancelled')),
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '7 days') NOT NULL,
  responded_at TIMESTAMPTZ,
  date_published TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS home_invitations_home_id_idx ON home_invitations (home_id);
CREATE INDEX IF NOT EXISTS home_invitations_invited_email_idx ON home_invitations (invited_email);
CREATE INDEX IF NOT EXISTS home_invitations_invited_by_email_idx ON home_invitations (invited_by_email);
CREATE INDEX IF NOT EXISTS home_invitations_token_idx ON home_invitations (token) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS home_invitations_status_idx ON home_invitations (status) WHERE status = 'pending';

GRANT SELECT, INSERT, UPDATE, DELETE ON home_invitations TO "authenticated";

ALTER TABLE home_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE home_invitations FORCE ROW LEVEL SECURITY;

-- =============================================================================
-- 3. Add home_id and home_joined_at to users table
-- =============================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS home_id UUID REFERENCES homes(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS home_joined_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS users_home_id_idx ON users (home_id) WHERE home_id IS NOT NULL;

-- =============================================================================
-- 4. Add home_id to user_pantry table
-- =============================================================================

ALTER TABLE user_pantry ADD COLUMN IF NOT EXISTS home_id UUID REFERENCES homes(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS user_pantry_home_id_idx ON user_pantry (home_id) WHERE home_id IS NOT NULL;

-- =============================================================================
-- 5. Add home_id to shopping_lists table
-- =============================================================================

ALTER TABLE shopping_lists ADD COLUMN IF NOT EXISTS home_id UUID REFERENCES homes(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS shopping_lists_home_id_idx ON shopping_lists (home_id) WHERE home_id IS NOT NULL;

-- =============================================================================
-- 6. Add home_id to shopping_list_items table
-- =============================================================================

ALTER TABLE shopping_list_items ADD COLUMN IF NOT EXISTS home_id UUID REFERENCES homes(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS shopping_list_items_home_id_idx ON shopping_list_items (home_id) WHERE home_id IS NOT NULL;

-- =============================================================================
-- 7. RLS Helper Functions
-- =============================================================================

-- Get the home_id for the current JWT user
CREATE OR REPLACE FUNCTION get_current_user_home_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_home_id UUID;
BEGIN
  SELECT home_id INTO v_home_id
  FROM users
  WHERE email = current_setting('request.jwt.claims', true)::jsonb->>'email';

  RETURN v_home_id;
END;
$func$;

GRANT EXECUTE ON FUNCTION get_current_user_home_id() TO "authenticated";

-- Check if current user is a member of the given home
CREATE OR REPLACE FUNCTION is_home_member(p_home_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user_home_id UUID;
BEGIN
  IF p_home_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT home_id INTO v_user_home_id
  FROM users
  WHERE email = current_setting('request.jwt.claims', true)::jsonb->>'email';

  RETURN v_user_home_id IS NOT NULL AND v_user_home_id = p_home_id;
END;
$func$;

GRANT EXECUTE ON FUNCTION is_home_member(UUID) TO "authenticated";

-- =============================================================================
-- 8. Homes RLS Policies
-- =============================================================================

DROP POLICY IF EXISTS homes_policy_select ON homes;
DROP POLICY IF EXISTS homes_policy_insert ON homes;
DROP POLICY IF EXISTS homes_policy_update ON homes;
DROP POLICY IF EXISTS homes_policy_delete ON homes;

-- Users can see homes they are members of
CREATE POLICY homes_policy_select
  ON homes
  FOR SELECT
  USING (is_home_member(id));

-- Users can insert homes (handled via create_home function)
CREATE POLICY homes_policy_insert
  ON homes
  FOR INSERT
  WITH CHECK (created_by_email = current_setting('request.jwt.claims', true)::jsonb->>'email');

-- Only members can update their home
CREATE POLICY homes_policy_update
  ON homes
  FOR UPDATE
  USING (is_home_member(id));

-- Only the creator can delete the home (or last member leaving)
CREATE POLICY homes_policy_delete
  ON homes
  FOR DELETE
  USING (created_by_email = current_setting('request.jwt.claims', true)::jsonb->>'email');

-- =============================================================================
-- 9. Home Invitations RLS Policies
-- =============================================================================

DROP POLICY IF EXISTS home_invitations_policy_select ON home_invitations;
DROP POLICY IF EXISTS home_invitations_policy_insert ON home_invitations;
DROP POLICY IF EXISTS home_invitations_policy_update ON home_invitations;
DROP POLICY IF EXISTS home_invitations_policy_delete ON home_invitations;

-- Users can see invitations they sent or received
CREATE POLICY home_invitations_policy_select
  ON home_invitations
  FOR SELECT
  USING (
    invited_by_email = current_setting('request.jwt.claims', true)::jsonb->>'email'
    OR invited_email = current_setting('request.jwt.claims', true)::jsonb->>'email'
  );

-- Only home members can create invitations
CREATE POLICY home_invitations_policy_insert
  ON home_invitations
  FOR INSERT
  WITH CHECK (
    invited_by_email = current_setting('request.jwt.claims', true)::jsonb->>'email'
    AND is_home_member(home_id)
  );

-- Users can update invitations they sent or received
CREATE POLICY home_invitations_policy_update
  ON home_invitations
  FOR UPDATE
  USING (
    invited_by_email = current_setting('request.jwt.claims', true)::jsonb->>'email'
    OR invited_email = current_setting('request.jwt.claims', true)::jsonb->>'email'
  );

-- Only the inviter can delete/cancel invitations
CREATE POLICY home_invitations_policy_delete
  ON home_invitations
  FOR DELETE
  USING (invited_by_email = current_setting('request.jwt.claims', true)::jsonb->>'email');

-- =============================================================================
-- 10. Home Management Functions
-- =============================================================================

-- Create a new home and add the current user as a member
CREATE OR REPLACE FUNCTION create_home(p_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user_email TEXT;
  v_existing_home_id UUID;
  v_home_id UUID;
BEGIN
  -- Get current user email from JWT
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  -- Check if user already has a home
  SELECT home_id INTO v_existing_home_id
  FROM users
  WHERE email = v_user_email;

  IF v_existing_home_id IS NOT NULL THEN
    RAISE EXCEPTION 'user-already-has-home';
  END IF;

  -- Validate name
  IF p_name IS NULL OR LENGTH(TRIM(p_name)) < 1 THEN
    RAISE EXCEPTION 'invalid-home-name';
  END IF;

  -- Create the home
  INSERT INTO homes (name, created_by_email)
  VALUES (TRIM(p_name), v_user_email)
  RETURNING id INTO v_home_id;

  -- Update user's home_id and home_joined_at
  UPDATE users SET home_id = v_home_id, home_joined_at = NOW() WHERE email = v_user_email;

  -- Migrate user's orphaned pantry items (home_id IS NULL) to the new home
  UPDATE user_pantry SET home_id = v_home_id WHERE user_email = v_user_email AND home_id IS NULL;

  -- Migrate user's orphaned shopping lists to the new home
  UPDATE shopping_lists SET home_id = v_home_id WHERE user_email = v_user_email AND home_id IS NULL;

  -- Migrate user's orphaned shopping list items to the new home
  UPDATE shopping_list_items SET home_id = v_home_id WHERE user_email = v_user_email AND home_id IS NULL;

  RETURN v_home_id;
END;
$func$;

GRANT EXECUTE ON FUNCTION create_home(TEXT) TO "authenticated";

-- Generate a join code for the current user's home
CREATE OR REPLACE FUNCTION generate_join_code(p_expires_hours INTEGER DEFAULT 168)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user_email TEXT;
  v_home_id UUID;
  v_join_code TEXT;
  v_attempts INTEGER := 0;
  v_max_attempts INTEGER := 10;
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

  -- Generate unique 8-character alphanumeric code
  LOOP
    v_join_code := UPPER(SUBSTRING(encode(gen_random_bytes(6), 'base64') FROM 1 FOR 8));
    -- Remove ambiguous characters (0, O, I, L) and replace with safe ones
    v_join_code := REPLACE(v_join_code, '0', 'X');
    v_join_code := REPLACE(v_join_code, 'O', 'Y');
    v_join_code := REPLACE(v_join_code, 'I', 'Z');
    v_join_code := REPLACE(v_join_code, 'L', 'W');
    v_join_code := REPLACE(v_join_code, '+', 'A');
    v_join_code := REPLACE(v_join_code, '/', 'B');

    -- Ensure exactly 8 characters
    v_join_code := SUBSTRING(v_join_code FROM 1 FOR 8);

    -- Check if code is unique
    IF NOT EXISTS (SELECT 1 FROM homes WHERE join_code = v_join_code AND id != v_home_id) THEN
      EXIT;
    END IF;

    v_attempts := v_attempts + 1;
    IF v_attempts >= v_max_attempts THEN
      RAISE EXCEPTION 'failed-to-generate-unique-code';
    END IF;
  END LOOP;

  -- Update the home with the new join code
  UPDATE homes
  SET
    join_code = v_join_code,
    join_code_expires_at = now() + (p_expires_hours || ' hours')::INTERVAL
  WHERE id = v_home_id;

  RETURN v_join_code;
END;
$func$;

GRANT EXECUTE ON FUNCTION generate_join_code(INTEGER) TO "authenticated";

-- Disable join code for the current user's home
CREATE OR REPLACE FUNCTION disable_join_code()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user_email TEXT;
  v_home_id UUID;
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

  -- Clear the join code
  UPDATE homes
  SET
    join_code = NULL,
    join_code_expires_at = NULL
  WHERE id = v_home_id;
END;
$func$;

GRANT EXECUTE ON FUNCTION disable_join_code() TO "authenticated";

-- Join a home using a join code
CREATE OR REPLACE FUNCTION join_home_by_code(p_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user_email TEXT;
  v_existing_home_id UUID;
  v_home_id UUID;
  v_home_record RECORD;
BEGIN
  -- Get current user email from JWT
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  -- Check if user already has a home
  SELECT home_id INTO v_existing_home_id
  FROM users
  WHERE email = v_user_email;

  IF v_existing_home_id IS NOT NULL THEN
    RAISE EXCEPTION 'user-already-has-home';
  END IF;

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

  -- Update user's home_id and home_joined_at
  UPDATE users SET home_id = v_home_id, home_joined_at = NOW() WHERE email = v_user_email;

  -- Migrate user's orphaned pantry items (home_id IS NULL) to the new home
  UPDATE user_pantry SET home_id = v_home_id WHERE user_email = v_user_email AND home_id IS NULL;

  -- Migrate user's orphaned shopping lists to the new home
  UPDATE shopping_lists SET home_id = v_home_id WHERE user_email = v_user_email AND home_id IS NULL;

  -- Migrate user's orphaned shopping list items to the new home
  UPDATE shopping_list_items SET home_id = v_home_id WHERE user_email = v_user_email AND home_id IS NULL;

  RETURN v_home_id;
END;
$func$;

GRANT EXECUTE ON FUNCTION join_home_by_code(TEXT) TO "authenticated";

-- Invite a user to the current user's home via email
CREATE OR REPLACE FUNCTION invite_to_home(p_email TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user_email TEXT;
  v_home_id UUID;
  v_token TEXT;
  v_invitation_id UUID;
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

  -- Validate email
  IF p_email IS NULL OR LENGTH(TRIM(p_email)) < 1 THEN
    RAISE EXCEPTION 'invalid-email';
  END IF;

  -- Check if user is trying to invite themselves
  IF LOWER(TRIM(p_email)) = LOWER(v_user_email) THEN
    RAISE EXCEPTION 'cannot-invite-self';
  END IF;

  -- Check if invited user is already a member
  IF EXISTS (SELECT 1 FROM users WHERE email = LOWER(TRIM(p_email)) AND home_id = v_home_id) THEN
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

  -- Generate secure token (64 hex characters = 32 bytes)
  v_token := encode(gen_random_bytes(32), 'hex');

  -- Create invitation
  INSERT INTO home_invitations (home_id, invited_email, invited_by_email, token)
  VALUES (v_home_id, LOWER(TRIM(p_email)), v_user_email, v_token)
  RETURNING id INTO v_invitation_id;

  RETURN v_invitation_id;
END;
$func$;

GRANT EXECUTE ON FUNCTION invite_to_home(TEXT) TO "authenticated";

-- Accept a home invitation using the token
CREATE OR REPLACE FUNCTION accept_invitation(p_token TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user_email TEXT;
  v_existing_home_id UUID;
  v_invitation RECORD;
  v_home_id UUID;
BEGIN
  -- Get current user email from JWT
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  -- Check if user already has a home
  SELECT home_id INTO v_existing_home_id
  FROM users
  WHERE email = v_user_email;

  IF v_existing_home_id IS NOT NULL THEN
    RAISE EXCEPTION 'user-already-has-home';
  END IF;

  -- Find and validate the invitation
  SELECT * INTO v_invitation
  FROM home_invitations
  WHERE token = p_token
    AND status = 'pending';

  IF v_invitation.id IS NULL THEN
    RAISE EXCEPTION 'invalid-invitation-token';
  END IF;

  -- Check if invitation has expired
  IF v_invitation.expires_at < now() THEN
    -- Mark as expired
    UPDATE home_invitations SET status = 'expired', responded_at = now() WHERE id = v_invitation.id;
    RAISE EXCEPTION 'invitation-expired';
  END IF;

  -- Check if the invitation is for this user
  IF LOWER(v_invitation.invited_email) != LOWER(v_user_email) THEN
    RAISE EXCEPTION 'invitation-not-for-user';
  END IF;

  v_home_id := v_invitation.home_id;

  -- Update invitation status
  UPDATE home_invitations
  SET status = 'accepted', responded_at = now()
  WHERE id = v_invitation.id;

  -- Update user's home_id and home_joined_at
  UPDATE users SET home_id = v_home_id, home_joined_at = NOW() WHERE email = v_user_email;

  -- Migrate user's orphaned pantry items (home_id IS NULL) to the new home
  UPDATE user_pantry SET home_id = v_home_id WHERE user_email = v_user_email AND home_id IS NULL;

  -- Migrate user's orphaned shopping lists to the new home
  UPDATE shopping_lists SET home_id = v_home_id WHERE user_email = v_user_email AND home_id IS NULL;

  -- Migrate user's orphaned shopping list items to the new home
  UPDATE shopping_list_items SET home_id = v_home_id WHERE user_email = v_user_email AND home_id IS NULL;

  RETURN v_home_id;
END;
$func$;

GRANT EXECUTE ON FUNCTION accept_invitation(TEXT) TO "authenticated";

-- Decline a home invitation using the token
CREATE OR REPLACE FUNCTION decline_invitation(p_token TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user_email TEXT;
  v_invitation RECORD;
BEGIN
  -- Get current user email from JWT
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  -- Find the invitation
  SELECT * INTO v_invitation
  FROM home_invitations
  WHERE token = p_token
    AND status = 'pending';

  IF v_invitation.id IS NULL THEN
    RAISE EXCEPTION 'invalid-invitation-token';
  END IF;

  -- Check if the invitation is for this user
  IF LOWER(v_invitation.invited_email) != LOWER(v_user_email) THEN
    RAISE EXCEPTION 'invitation-not-for-user';
  END IF;

  -- Update invitation status
  UPDATE home_invitations
  SET status = 'declined', responded_at = now()
  WHERE id = v_invitation.id;
END;
$func$;

GRANT EXECUTE ON FUNCTION decline_invitation(TEXT) TO "authenticated";

-- Leave the current home
-- NOTE: Does NOT auto-create a new home. User will have no home until they create or join one.
CREATE OR REPLACE FUNCTION leave_home()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user_email TEXT;
  v_home_id UUID;
  v_member_count INTEGER;
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

  -- Count members in the home
  SELECT COUNT(*) INTO v_member_count
  FROM users
  WHERE home_id = v_home_id;

  -- Clear home_id from user's pantry items (they lose access to shared pantry)
  UPDATE user_pantry SET home_id = NULL WHERE user_email = v_user_email AND home_id = v_home_id;

  -- Clear home_id from user's shopping lists
  UPDATE shopping_lists SET home_id = NULL WHERE user_email = v_user_email AND home_id = v_home_id;

  -- Clear home_id from user's shopping list items
  UPDATE shopping_list_items SET home_id = NULL WHERE user_email = v_user_email AND home_id = v_home_id;

  -- Remove user from home (set home_id and home_joined_at to NULL)
  UPDATE users SET home_id = NULL, home_joined_at = NULL WHERE email = v_user_email;

  -- If this was the last member, delete the home
  IF v_member_count <= 1 THEN
    DELETE FROM homes WHERE id = v_home_id;
  END IF;

  -- User now has no home - they can create or join one manually
END;
$func$;

GRANT EXECUTE ON FUNCTION leave_home() TO "authenticated";

-- Remove a member from the current user's home
CREATE OR REPLACE FUNCTION remove_home_member(p_member_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user_email TEXT;
  v_home_id UUID;
  v_target_home_id UUID;
  v_member_count INTEGER;
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

  -- Cannot remove yourself - use leave_home() instead
  IF LOWER(TRIM(p_member_email)) = LOWER(v_user_email) THEN
    RAISE EXCEPTION 'cannot-remove-self';
  END IF;

  -- Verify target user is in the same home
  SELECT home_id INTO v_target_home_id
  FROM users
  WHERE email = LOWER(TRIM(p_member_email));

  IF v_target_home_id IS NULL OR v_target_home_id != v_home_id THEN
    RAISE EXCEPTION 'member-not-found';
  END IF;

  -- Count members in the home
  SELECT COUNT(*) INTO v_member_count
  FROM users
  WHERE home_id = v_home_id;

  -- Orphan the target user's pantry items (set home_id to NULL)
  UPDATE user_pantry SET home_id = NULL
  WHERE user_email = LOWER(TRIM(p_member_email)) AND home_id = v_home_id;

  -- Orphan the target user's shopping lists
  UPDATE shopping_lists SET home_id = NULL
  WHERE user_email = LOWER(TRIM(p_member_email)) AND home_id = v_home_id;

  -- Orphan the target user's shopping list items
  UPDATE shopping_list_items SET home_id = NULL
  WHERE user_email = LOWER(TRIM(p_member_email)) AND home_id = v_home_id;

  -- Remove user from home (set home_id and home_joined_at to NULL)
  UPDATE users SET home_id = NULL, home_joined_at = NULL
  WHERE email = LOWER(TRIM(p_member_email));

  -- If this was the last member, delete the home
  IF v_member_count <= 1 THEN
    DELETE FROM homes WHERE id = v_home_id;
  END IF;
END;
$func$;

GRANT EXECUTE ON FUNCTION remove_home_member(TEXT) TO "authenticated";

-- Get information about the current user's home including members
CREATE OR REPLACE FUNCTION get_home_info()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user_email TEXT;
  v_home_id UUID;
  v_home RECORD;
  v_members JSONB;
  v_pending_invitations JSONB;
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
    RETURN NULL;
  END IF;

  -- Get home details
  SELECT * INTO v_home
  FROM homes
  WHERE id = v_home_id;

  -- Get members
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'email', u.email,
    'name', u.name,
    'joined_at', u.home_joined_at,
    'is_creator', u.email = v_home.created_by_email,
    'is_current_user', u.email = v_user_email
  ) ORDER BY
    CASE WHEN u.email = v_home.created_by_email THEN 0 ELSE 1 END,
    u.name
  ), '[]'::jsonb) INTO v_members
  FROM users u
  WHERE u.home_id = v_home_id;

  -- Get pending invitations (only if current user is a member)
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
$func$;

GRANT EXECUTE ON FUNCTION get_home_info() TO "authenticated";

-- =============================================================================
-- 11. Update RLS Policies for Home-Scoped Tables
-- =============================================================================

-- Drop existing user_pantry policies
DROP POLICY IF EXISTS user_pantry_policy_select ON user_pantry;
DROP POLICY IF EXISTS user_pantry_policy_insert ON user_pantry;
DROP POLICY IF EXISTS user_pantry_policy_update ON user_pantry;
DROP POLICY IF EXISTS user_pantry_policy_delete ON user_pantry;

-- New user_pantry policies using home_id
-- NOTE: Policies handle NULL home_id gracefully - users without homes see empty results
CREATE POLICY user_pantry_policy_select
  ON user_pantry
  FOR SELECT
  USING (home_id IS NOT NULL AND home_id = get_current_user_home_id());

CREATE POLICY user_pantry_policy_insert
  ON user_pantry
  FOR INSERT
  WITH CHECK (home_id IS NOT NULL AND home_id = get_current_user_home_id());

CREATE POLICY user_pantry_policy_update
  ON user_pantry
  FOR UPDATE
  USING (home_id IS NOT NULL AND home_id = get_current_user_home_id());

CREATE POLICY user_pantry_policy_delete
  ON user_pantry
  FOR DELETE
  USING (home_id IS NOT NULL AND home_id = get_current_user_home_id());

-- Drop existing shopping_lists policies
DROP POLICY IF EXISTS shopping_lists_policy_select ON shopping_lists;
DROP POLICY IF EXISTS shopping_lists_policy_insert ON shopping_lists;
DROP POLICY IF EXISTS shopping_lists_policy_update ON shopping_lists;
DROP POLICY IF EXISTS shopping_lists_policy_delete ON shopping_lists;

-- New shopping_lists policies using home_id
-- NOTE: Policies handle NULL home_id gracefully - users without homes see empty results
CREATE POLICY shopping_lists_policy_select
  ON shopping_lists
  FOR SELECT
  USING (home_id IS NOT NULL AND home_id = get_current_user_home_id());

CREATE POLICY shopping_lists_policy_insert
  ON shopping_lists
  FOR INSERT
  WITH CHECK (home_id IS NOT NULL AND home_id = get_current_user_home_id());

CREATE POLICY shopping_lists_policy_update
  ON shopping_lists
  FOR UPDATE
  USING (home_id IS NOT NULL AND home_id = get_current_user_home_id());

CREATE POLICY shopping_lists_policy_delete
  ON shopping_lists
  FOR DELETE
  USING (home_id IS NOT NULL AND home_id = get_current_user_home_id());

-- Drop existing shopping_list_items policies
DROP POLICY IF EXISTS shopping_list_items_policy_select ON shopping_list_items;
DROP POLICY IF EXISTS shopping_list_items_policy_insert ON shopping_list_items;
DROP POLICY IF EXISTS shopping_list_items_policy_update ON shopping_list_items;
DROP POLICY IF EXISTS shopping_list_items_policy_delete ON shopping_list_items;

-- New shopping_list_items policies using home_id
-- NOTE: Policies handle NULL home_id gracefully - users without homes see empty results
CREATE POLICY shopping_list_items_policy_select
  ON shopping_list_items
  FOR SELECT
  USING (home_id IS NOT NULL AND home_id = get_current_user_home_id());

CREATE POLICY shopping_list_items_policy_insert
  ON shopping_list_items
  FOR INSERT
  WITH CHECK (home_id IS NOT NULL AND home_id = get_current_user_home_id());

CREATE POLICY shopping_list_items_policy_update
  ON shopping_list_items
  FOR UPDATE
  USING (home_id IS NOT NULL AND home_id = get_current_user_home_id());

CREATE POLICY shopping_list_items_policy_delete
  ON shopping_list_items
  FOR DELETE
  USING (home_id IS NOT NULL AND home_id = get_current_user_home_id());

-- =============================================================================
-- 12. Update Pantry Functions for Home-Based Access
-- =============================================================================

-- Drop functions that have changed return types (can't use CREATE OR REPLACE when return type changes)
DROP FUNCTION IF EXISTS get_user_pantry();

-- Add or update pantry item (upsert) - now home-scoped
CREATE OR REPLACE FUNCTION add_to_pantry(
  p_food_id UUID,
  p_quantity DECIMAL DEFAULT NULL,
  p_unit TEXT DEFAULT NULL,
  p_expires_at DATE DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user_email TEXT;
  v_home_id UUID;
  v_pantry_id UUID;
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

  -- Validate food_id exists
  IF NOT EXISTS (SELECT 1 FROM foods WHERE id = p_food_id) THEN
    RAISE EXCEPTION 'food-not-found';
  END IF;

  -- Upsert into pantry (now keyed by home_id + food_id)
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
$func$;

-- Remove item from pantry - now home-scoped
CREATE OR REPLACE FUNCTION remove_from_pantry(p_food_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user_email TEXT;
  v_home_id UUID;
  v_deleted INTEGER;
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

  DELETE FROM user_pantry
  WHERE home_id = v_home_id AND food_id = p_food_id;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN v_deleted > 0;
END;
$func$;

-- Get home's pantry with food names
-- NOTE: Returns empty result if user has no home (not an error)
CREATE OR REPLACE FUNCTION get_user_pantry()
RETURNS TABLE (
  id UUID,
  food_id UUID,
  food_name TEXT,
  quantity DECIMAL,
  unit TEXT,
  added_at TIMESTAMPTZ,
  expires_at DATE,
  is_expired BOOLEAN,
  added_by TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user_email TEXT;
  v_home_id UUID;
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
    -- Expired items first (for attention)
    CASE WHEN up.expires_at IS NOT NULL AND up.expires_at < CURRENT_DATE THEN 0 ELSE 1 END,
    -- Then by expiration date (soonest first)
    up.expires_at NULLS LAST,
    -- Then alphabetically
    f.name;
END;
$func$;

-- Find recipes from pantry - now home-scoped
-- NOTE: Returns empty result if user has no home (not an error)
CREATE OR REPLACE FUNCTION find_recipes_from_pantry(
  p_min_match_percentage INTEGER DEFAULT 50,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  recipe_id UUID,
  title TEXT,
  total_ingredients INTEGER,
  matching_ingredients INTEGER,
  match_percentage INTEGER,
  missing_food_ids UUID[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user_email TEXT;
  v_home_id UUID;
  v_pantry_food_ids UUID[];
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
$func$;

-- =============================================================================
-- 13. Update Shopping List Functions for Home-Based Access
-- =============================================================================

-- Get or create default shopping list - now home-scoped
CREATE OR REPLACE FUNCTION get_or_create_default_shopping_list()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
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
  VALUES (v_user_email, v_home_id, 'Inkopslista', true)
  ON CONFLICT (user_email, name) DO UPDATE SET is_default = true
  RETURNING id INTO v_list_id;

  RETURN v_list_id;
END;
$func$;

-- Add recipe to shopping list - now home-scoped
CREATE OR REPLACE FUNCTION add_recipe_to_shopping_list(
  p_recipe_id UUID,
  p_shopping_list_id UUID DEFAULT NULL,
  p_servings INTEGER DEFAULT NULL,
  p_ingredient_ids UUID[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
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

  -- Get recipe details
  SELECT name, recipe_yield INTO v_recipe_name, v_recipe_yield
  FROM recipes
  WHERE id = p_recipe_id;

  IF v_recipe_name IS NULL THEN
    RAISE EXCEPTION 'recipe-not-found';
  END IF;

  -- Get or create shopping list
  IF p_shopping_list_id IS NOT NULL THEN
    -- Verify the list exists and belongs to the home
    SELECT id INTO v_list_id
    FROM shopping_lists
    WHERE id = p_shopping_list_id AND home_id = v_home_id;

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
    -- Parse quantity (handle text values like "1/2", "1-2", etc.)
    BEGIN
      v_ingredient_quantity := v_ingredient.quantity::NUMERIC;
    EXCEPTION WHEN OTHERS THEN
      -- If quantity can't be parsed, default to 1
      v_ingredient_quantity := 1;
    END;

    v_scaled_quantity := v_ingredient_quantity * v_scale_factor;

    -- Check for existing unchecked item with same food_id AND unit_id
    IF v_ingredient.food_id IS NOT NULL THEN
      SELECT id INTO v_existing_item_id
      FROM shopping_list_items
      WHERE shopping_list_id = v_list_id
        AND food_id = v_ingredient.food_id
        AND unit_id IS NOT DISTINCT FROM v_ingredient.unit_id
        AND is_checked = false;
    ELSE
      v_existing_item_id := NULL;
    END IF;

    IF v_existing_item_id IS NOT NULL THEN
      -- Add quantity to existing item
      UPDATE shopping_list_items
      SET quantity = quantity + v_scaled_quantity
      WHERE id = v_existing_item_id;

      v_new_item_id := v_existing_item_id;
    ELSE
      -- Insert new item
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
        v_ingredient.unit_id,
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
$func$;

-- Toggle shopping list item - now home-scoped
CREATE OR REPLACE FUNCTION toggle_shopping_list_item(p_item_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user_email TEXT;
  v_home_id UUID;
  v_is_checked BOOLEAN;
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

  -- Get current state and verify home membership
  SELECT is_checked, shopping_list_id INTO v_is_checked, v_list_id
  FROM shopping_list_items
  WHERE id = p_item_id AND home_id = v_home_id;

  IF v_is_checked IS NULL THEN
    RAISE EXCEPTION 'item-not-found';
  END IF;

  -- Toggle the checked state
  UPDATE shopping_list_items
  SET
    is_checked = NOT v_is_checked,
    checked_at = CASE WHEN v_is_checked THEN NULL ELSE now() END
  WHERE id = p_item_id;

  -- Update shopping list modified timestamp
  UPDATE shopping_lists SET date_modified = now() WHERE id = v_list_id;

  RETURN jsonb_build_object('is_checked', NOT v_is_checked);
END;
$func$;

-- Clear checked items - now home-scoped
CREATE OR REPLACE FUNCTION clear_checked_items(p_shopping_list_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user_email TEXT;
  v_home_id UUID;
  v_list_id UUID;
  v_deleted_count INTEGER;
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

  -- Get or default to default shopping list
  IF p_shopping_list_id IS NOT NULL THEN
    -- Verify the list exists and belongs to the home
    SELECT id INTO v_list_id
    FROM shopping_lists
    WHERE id = p_shopping_list_id AND home_id = v_home_id;

    IF v_list_id IS NULL THEN
      RAISE EXCEPTION 'shopping-list-not-found';
    END IF;
  ELSE
    v_list_id := get_or_create_default_shopping_list();
  END IF;

  -- Delete checked items (sources will cascade delete)
  DELETE FROM shopping_list_items
  WHERE shopping_list_id = v_list_id AND is_checked = true;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  -- Update shopping list modified timestamp
  UPDATE shopping_lists SET date_modified = now() WHERE id = v_list_id;

  RETURN jsonb_build_object('deleted_count', v_deleted_count);
END;
$func$;

-- Get user shopping lists - now home-scoped
CREATE OR REPLACE FUNCTION get_user_shopping_lists()
RETURNS TABLE (
  id UUID,
  name TEXT,
  is_default BOOLEAN,
  item_count BIGINT,
  checked_count BIGINT,
  date_published TIMESTAMPTZ,
  date_modified TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_home_id UUID;
BEGIN
  -- Get user's home_id
  SELECT u.home_id INTO v_home_id
  FROM users u
  WHERE u.email = current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_home_id IS NULL THEN
    RETURN;
  END IF;

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
  WHERE sl.home_id = v_home_id
  GROUP BY sl.id
  ORDER BY sl.is_default DESC, sl.date_modified DESC;
END;
$func$;

-- Create shopping list - now home-scoped
CREATE OR REPLACE FUNCTION create_shopping_list(p_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user_email TEXT;
  v_home_id UUID;
  v_list_id UUID;
  v_is_first_list BOOLEAN;
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

  -- Validate name
  IF p_name IS NULL OR LENGTH(TRIM(p_name)) < 1 THEN
    RAISE EXCEPTION 'invalid-list-name';
  END IF;

  -- Check if this is the first list for the home
  SELECT NOT EXISTS (
    SELECT 1 FROM shopping_lists WHERE home_id = v_home_id
  ) INTO v_is_first_list;

  -- Insert the new list
  INSERT INTO shopping_lists (user_email, home_id, name, is_default)
  VALUES (v_user_email, v_home_id, TRIM(p_name), v_is_first_list)
  RETURNING id INTO v_list_id;

  RETURN v_list_id;
END;
$func$;

-- Rename shopping list - now home-scoped
CREATE OR REPLACE FUNCTION rename_shopping_list(p_list_id UUID, p_name TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user_email TEXT;
  v_home_id UUID;
  v_list_exists BOOLEAN;
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

  -- Validate name
  IF p_name IS NULL OR LENGTH(TRIM(p_name)) < 1 THEN
    RAISE EXCEPTION 'invalid-list-name';
  END IF;

  -- Check if list exists and belongs to home
  SELECT EXISTS (
    SELECT 1 FROM shopping_lists
    WHERE id = p_list_id AND home_id = v_home_id
  ) INTO v_list_exists;

  IF NOT v_list_exists THEN
    RAISE EXCEPTION 'shopping-list-not-found';
  END IF;

  -- Update the list name
  UPDATE shopping_lists
  SET name = TRIM(p_name)
  WHERE id = p_list_id AND home_id = v_home_id;
END;
$func$;

-- Delete shopping list - now home-scoped
CREATE OR REPLACE FUNCTION delete_shopping_list(p_list_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user_email TEXT;
  v_home_id UUID;
  v_list_record RECORD;
  v_list_count INTEGER;
  v_new_default_id UUID;
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

  -- Get the list details
  SELECT id, is_default INTO v_list_record
  FROM shopping_lists
  WHERE id = p_list_id AND home_id = v_home_id;

  IF v_list_record.id IS NULL THEN
    RAISE EXCEPTION 'shopping-list-not-found';
  END IF;

  -- Count home's lists
  SELECT COUNT(*) INTO v_list_count
  FROM shopping_lists
  WHERE home_id = v_home_id;

  -- If deleting the default list and there are other lists, assign a new default
  IF v_list_record.is_default AND v_list_count > 1 THEN
    -- Find another list to make default (most recently modified)
    SELECT id INTO v_new_default_id
    FROM shopping_lists
    WHERE home_id = v_home_id AND id != p_list_id
    ORDER BY date_modified DESC
    LIMIT 1;

    UPDATE shopping_lists
    SET is_default = true
    WHERE id = v_new_default_id;
  END IF;

  -- Delete the list (items will cascade delete)
  DELETE FROM shopping_lists
  WHERE id = p_list_id AND home_id = v_home_id;
END;
$func$;

-- Set default shopping list - now home-scoped
CREATE OR REPLACE FUNCTION set_default_shopping_list(p_list_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user_email TEXT;
  v_home_id UUID;
  v_list_exists BOOLEAN;
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

  -- Check if list exists and belongs to home
  SELECT EXISTS (
    SELECT 1 FROM shopping_lists
    WHERE id = p_list_id AND home_id = v_home_id
  ) INTO v_list_exists;

  IF NOT v_list_exists THEN
    RAISE EXCEPTION 'shopping-list-not-found';
  END IF;

  -- Remove default from all other lists
  UPDATE shopping_lists
  SET is_default = false
  WHERE home_id = v_home_id AND is_default = true;

  -- Set the new default
  UPDATE shopping_lists
  SET is_default = true
  WHERE id = p_list_id AND home_id = v_home_id;
END;
$func$;

-- =============================================================================
-- 14. Update Shopping List View for Home-Based Access
-- =============================================================================

-- Need to DROP and recreate view because column order/names are changing
DROP VIEW IF EXISTS shopping_list_view;

-- NOTE: View handles NULL home_id gracefully - users without homes see empty results
CREATE VIEW shopping_list_view AS
SELECT
  sli.id,
  sli.shopping_list_id,
  sli.home_id,
  sli.food_id,
  sli.unit_id,
  sli.display_name,
  sli.display_unit,
  sli.quantity,
  sli.is_checked,
  sli.checked_at,
  sli.sort_order,
  sli.user_email,
  sli.date_published,
  COALESCE(f.name, sli.display_name) AS item_name,
  COALESCE(u.abbreviation, u.name, sli.display_unit) AS unit_name,
  sl.name AS list_name,
  array_agg(DISTINCT slis.recipe_name) FILTER (WHERE slis.recipe_name IS NOT NULL) AS source_recipes
FROM shopping_list_items sli
JOIN shopping_lists sl ON sl.id = sli.shopping_list_id
LEFT JOIN foods f ON sli.food_id = f.id
LEFT JOIN units u ON sli.unit_id = u.id
LEFT JOIN shopping_list_item_sources slis ON slis.shopping_list_item_id = sli.id
WHERE sli.home_id IS NOT NULL AND sli.home_id = get_current_user_home_id()
GROUP BY sli.id, f.name, u.abbreviation, u.name, sl.name;

-- =============================================================================
-- 15. Data Migration - Create Personal Homes for Existing Users
-- =============================================================================
-- NOTE: Auto-home creation removed in V39. Users start without homes and can
-- create or join one manually. This allows users to join existing homes.

-- First, drop the old unique constraint on user_pantry that uses user_email
ALTER TABLE user_pantry DROP CONSTRAINT IF EXISTS user_pantry_user_email_food_id_key;

-- Add new unique constraint based on home_id and food_id
-- We'll add this after migration to avoid conflicts during data migration

-- REMOVED: Auto-home creation for existing users
-- Users should start without a home so they can join existing homes.
-- See V39__remove_auto_homes.sql for the updated approach.

-- =============================================================================
-- 16. Add NOT NULL Constraints and New Unique Constraints
-- =============================================================================
-- NOTE: NOT NULL constraints removed in V39 to allow users without homes.

-- Skip NOT NULL constraints - users can exist without homes
-- ALTER TABLE user_pantry ALTER COLUMN home_id SET NOT NULL;
-- ALTER TABLE shopping_lists ALTER COLUMN home_id SET NOT NULL;
-- ALTER TABLE shopping_list_items ALTER COLUMN home_id SET NOT NULL;

-- Add new unique constraint for pantry (home_id + food_id)
-- Use partial index to allow multiple NULL home_ids
DO $$ BEGIN
  ALTER TABLE user_pantry ADD CONSTRAINT user_pantry_home_id_food_id_key UNIQUE (home_id, food_id);
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

-- Drop old unique constraint on shopping_lists (user_email + name)
ALTER TABLE shopping_lists DROP CONSTRAINT IF EXISTS shopping_lists_user_email_name_key;

-- Add new unique constraint for shopping_lists (home_id + name)
DO $$ BEGIN
  ALTER TABLE shopping_lists ADD CONSTRAINT shopping_lists_home_id_name_key UNIQUE (home_id, name);
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

-- =============================================================================
-- 17. Cancel Invitation Function
-- =============================================================================

CREATE OR REPLACE FUNCTION cancel_invitation(p_invitation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user_email TEXT;
  v_invitation RECORD;
BEGIN
  -- Get current user email from JWT
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  -- Find the invitation
  SELECT * INTO v_invitation
  FROM home_invitations
  WHERE id = p_invitation_id
    AND status = 'pending';

  IF v_invitation.id IS NULL THEN
    RAISE EXCEPTION 'invitation-not-found';
  END IF;

  -- Check if the user is the inviter
  IF v_invitation.invited_by_email != v_user_email THEN
    RAISE EXCEPTION 'not-invitation-owner';
  END IF;

  -- Update invitation status
  UPDATE home_invitations
  SET status = 'cancelled', responded_at = now()
  WHERE id = p_invitation_id;
END;
$func$;

GRANT EXECUTE ON FUNCTION cancel_invitation(UUID) TO "authenticated";

-- =============================================================================
-- 18. Get Pending Invitations for Current User
-- =============================================================================

CREATE OR REPLACE FUNCTION get_pending_invitations()
RETURNS TABLE (
  id UUID,
  home_id UUID,
  home_name TEXT,
  invited_by_email TEXT,
  invited_by_name TEXT,
  token TEXT,
  expires_at TIMESTAMPTZ,
  date_published TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user_email TEXT;
BEGIN
  -- Get current user email from JWT
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  RETURN QUERY
  SELECT
    hi.id,
    hi.home_id,
    h.name AS home_name,
    hi.invited_by_email,
    u.name AS invited_by_name,
    hi.token,
    hi.expires_at,
    hi.date_published
  FROM home_invitations hi
  JOIN homes h ON h.id = hi.home_id
  JOIN users u ON u.email = hi.invited_by_email
  WHERE hi.invited_email = LOWER(v_user_email)
    AND hi.status = 'pending'
    AND hi.expires_at > now()
  ORDER BY hi.date_published DESC;
END;
$func$;

GRANT EXECUTE ON FUNCTION get_pending_invitations() TO "authenticated";

-- =============================================================================
-- 19. Update Home Name Function
-- =============================================================================

CREATE OR REPLACE FUNCTION update_home_name(p_name TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user_email TEXT;
  v_home_id UUID;
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

  -- Validate name
  IF p_name IS NULL OR LENGTH(TRIM(p_name)) < 1 OR LENGTH(TRIM(p_name)) > 255 THEN
    RAISE EXCEPTION 'invalid-home-name';
  END IF;

  -- Update the home name
  UPDATE homes
  SET name = TRIM(p_name)
  WHERE id = v_home_id;
END;
$func$;

GRANT EXECUTE ON FUNCTION update_home_name(TEXT) TO "authenticated";

-- =============================================================================
-- 20. Comments
-- =============================================================================

COMMENT ON TABLE homes IS 'Shared households that group users for shared pantry and shopping lists';
COMMENT ON TABLE home_invitations IS 'Email-based invitations to join a home';
COMMENT ON FUNCTION create_home(TEXT) IS 'Creates a new home and adds the current user as its first member';
COMMENT ON FUNCTION generate_join_code(INTEGER) IS 'Generates a shareable join code for the current user''s home';
COMMENT ON FUNCTION join_home_by_code(TEXT) IS 'Allows a user to join a home using a valid join code';
COMMENT ON FUNCTION invite_to_home(TEXT) IS 'Sends an invitation to join the current user''s home via email';
COMMENT ON FUNCTION accept_invitation(TEXT) IS 'Accepts a home invitation using the token from the invitation email';
COMMENT ON FUNCTION decline_invitation(TEXT) IS 'Declines a home invitation';
COMMENT ON FUNCTION leave_home() IS 'Removes the current user from their home. User will have no home until they create or join one manually.';
COMMENT ON FUNCTION remove_home_member(TEXT) IS 'Removes another member from the current user''s home. Use leave_home() to remove yourself.';
COMMENT ON FUNCTION get_home_info() IS 'Returns information about the current user''s home including members and pending invitations';
COMMENT ON FUNCTION get_current_user_home_id() IS 'Helper function that returns the home_id for the current JWT user';
COMMENT ON FUNCTION is_home_member(UUID) IS 'Helper function to check if current user is a member of the given home';
