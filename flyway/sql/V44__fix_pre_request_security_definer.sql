-- Fix: Remove SECURITY DEFINER from pre_request() to allow SET LOCAL role
--
-- PostgreSQL 15+ blocks SET LOCAL role inside SECURITY DEFINER functions
-- (CVE-2023-2455). This caused API key auth to fail with:
--   "cannot set parameter "role" within security-definer function"
--
-- The fix: split pre_request() into two parts:
--   1. pre_request() — NOT SECURITY DEFINER, handles API key role switching
--   2. cache_home_membership() — SECURITY DEFINER, queries home_members
--      (needed because home_members has a self-referencing RLS policy that
--      causes infinite recursion when queried as authenticated; the service
--      policy for matrummet bypasses this)

-- Helper: SECURITY DEFINER function to cache home membership data.
-- Runs as matrummet to bypass home_members self-referencing RLS policy.
CREATE OR REPLACE FUNCTION public.cache_home_membership(
  p_user_email TEXT,
  p_active_home_id TEXT
) RETURNS void
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_verified_home_id UUID;
  v_home_id UUID;
  v_household_emails TEXT;
BEGIN
  -- Verify x-active-home-id header membership
  IF p_active_home_id IS NOT NULL AND p_active_home_id != '' THEN
    BEGIN
      SELECT hm.home_id INTO v_verified_home_id
      FROM home_members hm
      WHERE hm.user_email = p_user_email
        AND hm.home_id = p_active_home_id::uuid;

      IF v_verified_home_id IS NOT NULL THEN
        PERFORM set_config('app.active_home_id', v_verified_home_id::text, true);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  -- If no active home was set from header, look up the user's default home
  IF current_setting('app.active_home_id', true) IS NULL
     OR current_setting('app.active_home_id', true) = '' THEN
    SELECT hm.home_id INTO v_home_id
    FROM home_members hm
    WHERE hm.user_email = p_user_email
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
  WHERE hm1.user_email = p_user_email;

  IF v_household_emails IS NOT NULL THEN
    PERFORM set_config('app.household_emails', v_household_emails, true);
  END IF;
END;
$$;

-- Only authenticated needs EXECUTE — pre_request() always switches to authenticated
-- before calling this (either via JWT or API key SET LOCAL role).
-- Not granted to anon so it stays hidden from the anonymous API surface.
REVOKE ALL ON FUNCTION public.cache_home_membership(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cache_home_membership(TEXT, TEXT) TO authenticated;

-- Main pre_request: NOT SECURITY DEFINER so SET LOCAL role works on PG 15+
CREATE OR REPLACE FUNCTION public.pre_request() RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  v_api_key TEXT;
  v_user_email TEXT;
  v_active_home_id TEXT;
BEGIN
  -- API key auth: validate key and switch role
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

  -- Cache home membership data (uses SECURITY DEFINER to bypass home_members RLS)
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NOT NULL THEN
    v_active_home_id := current_setting('request.headers', true)::json->>'x-active-home-id';
    PERFORM cache_home_membership(v_user_email, v_active_home_id);
  END IF;
END;
$$;
