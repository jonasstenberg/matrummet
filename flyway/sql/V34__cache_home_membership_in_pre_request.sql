-- Cache home membership data in pre_request() to avoid per-row lookups
--
-- Problem: get_current_user_home_id(), shares_household_with(), and is_home_member()
-- are called per-row in views and RLS policies, each doing table lookups. For a user
-- with 100 recipes, this means hundreds of redundant queries per page load.
--
-- Fix: pre_request() (which runs once per PostgREST request) now caches:
--   app.active_home_id    — the user's active home (was partially done, now always set)
--   app.household_emails  — comma-separated emails of all users sharing any home
--
-- The helper functions then read from cache first, falling back to table lookups
-- only when called outside of a PostgREST request context.

-- 1. Updated pre_request() — caches home_id and household emails
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
  v_home_id UUID;
  v_household_emails TEXT;
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

  -- Read x-active-home-id header and verify membership
  v_active_home_id := current_setting('request.headers', true)::json->>'x-active-home-id';

  IF v_active_home_id IS NOT NULL AND v_active_home_id != '' THEN
    v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

    IF v_user_email IS NOT NULL THEN
      BEGIN
        SELECT hm.home_id INTO v_verified_home_id
        FROM home_members hm
        WHERE hm.user_email = v_user_email
          AND hm.home_id = v_active_home_id::uuid;

        IF v_verified_home_id IS NOT NULL THEN
          PERFORM set_config('app.active_home_id', v_verified_home_id::text, true);
        END IF;
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;
  END IF;

  -- NEW: Cache home membership data for the current user
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NOT NULL THEN
    -- If no active home was set from header, look up the user's default home
    IF current_setting('app.active_home_id', true) IS NULL
       OR current_setting('app.active_home_id', true) = '' THEN
      SELECT hm.home_id INTO v_home_id
      FROM home_members hm
      WHERE hm.user_email = v_user_email
      ORDER BY hm.joined_at ASC
      LIMIT 1;

      IF v_home_id IS NOT NULL THEN
        PERFORM set_config('app.active_home_id', v_home_id::text, true);
      END IF;
    END IF;

    -- Cache all emails that share any home with this user (for shares_household_with)
    SELECT string_agg(DISTINCT hm2.user_email, ',') INTO v_household_emails
    FROM home_members hm1
    JOIN home_members hm2 ON hm1.home_id = hm2.home_id
    WHERE hm1.user_email = v_user_email;

    IF v_household_emails IS NOT NULL THEN
      PERFORM set_config('app.household_emails', v_household_emails, true);
    END IF;
  END IF;
END;
$$;

-- 2. Updated get_current_user_home_id() — reads from cache, no table fallback needed
--    (pre_request always sets the cache now, fallback kept for non-PostgREST contexts)
CREATE OR REPLACE FUNCTION public.get_current_user_home_id() RETURNS uuid
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_home_id UUID;
  v_active_home_text TEXT;
BEGIN
  -- Read from session cache (set by pre_request)
  v_active_home_text := current_setting('app.active_home_id', true);
  IF v_active_home_text IS NOT NULL AND v_active_home_text != '' THEN
    RETURN v_active_home_text::uuid;
  END IF;

  -- Fallback for non-PostgREST contexts (e.g., called from other SECURITY DEFINER functions)
  SELECT hm.home_id INTO v_home_id
  FROM home_members hm
  WHERE hm.user_email = current_setting('request.jwt.claims', true)::jsonb->>'email'
  ORDER BY hm.joined_at ASC
  LIMIT 1;

  RETURN v_home_id;
END;
$$;

-- 3. Updated shares_household_with() — reads from cached household emails
CREATE OR REPLACE FUNCTION public.shares_household_with(p_owner_email text) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_current_user_email TEXT;
  v_household_emails TEXT;
BEGIN
  v_current_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_current_user_email IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Try cached household emails first (set by pre_request)
  v_household_emails := current_setting('app.household_emails', true);
  IF v_household_emails IS NOT NULL AND v_household_emails != '' THEN
    RETURN p_owner_email = ANY(string_to_array(v_household_emails, ','));
  END IF;

  -- Fallback for non-PostgREST contexts
  RETURN EXISTS (
    SELECT 1
    FROM home_members hm1
    JOIN home_members hm2 ON hm1.home_id = hm2.home_id
    WHERE hm1.user_email = v_current_user_email
      AND hm2.user_email = p_owner_email
  );
END;
$$;

-- 4. Updated is_home_member() — uses cached home_id when checking active home
CREATE OR REPLACE FUNCTION public.is_home_member(p_home_id uuid) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_cached_home_id TEXT;
BEGIN
  IF p_home_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Quick check: if checking against the cached active home, no query needed
  v_cached_home_id := current_setting('app.active_home_id', true);
  IF v_cached_home_id IS NOT NULL AND v_cached_home_id != '' THEN
    IF p_home_id = v_cached_home_id::uuid THEN
      RETURN TRUE;
    END IF;
  END IF;

  -- Full check for other homes (multi-home support)
  RETURN EXISTS (
    SELECT 1 FROM home_members
    WHERE user_email = current_setting('request.jwt.claims', true)::jsonb->>'email'
      AND home_id = p_home_id
  );
END;
$$;
