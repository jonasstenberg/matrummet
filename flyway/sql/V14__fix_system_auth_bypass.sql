-- V15: Fix is_admin_or_system() privilege escalation via magic email
--
-- Problem: is_admin_or_system() grants admin when JWT email = 'system@cron.local'.
-- Since signup has no reserved-email validation, anyone could register with that
-- email and gain admin privileges.
--
-- Fix: Check a JWT 'system' claim instead of a magic email address.
-- Also block reserved email domains at signup as defense-in-depth.

-- =============================================================================
-- 1. Replace is_admin_or_system() — check JWT 'system' claim instead of email
-- =============================================================================
CREATE OR REPLACE FUNCTION public.is_admin_or_system() RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  current_email TEXT;
  user_role TEXT;
  claims JSONB;
BEGIN
  claims := current_setting('request.jwt.claims', true)::jsonb;

  -- System tokens have { system: true } — no email needed
  IF (claims->>'system')::boolean IS TRUE THEN
    RETURN TRUE;
  END IF;

  current_email := claims->>'email';

  SELECT u.role INTO user_role
  FROM users u
  WHERE u.email = current_email;

  RETURN COALESCE(user_role = 'admin', FALSE);
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

-- =============================================================================
-- 2. Fix apply_ai_food_review reviewed_by — use 'system' claim instead of email
-- =============================================================================
CREATE OR REPLACE FUNCTION public.apply_ai_food_review(
  p_food_id uuid,
  p_decision public.food_status,
  p_reasoning text,
  p_confidence real,
  p_suggested_merge_id uuid DEFAULT NULL::uuid,
  p_reviewer_email text DEFAULT NULL::text
) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    SET row_security TO 'off'
    AS $$
DECLARE
  v_should_apply BOOLEAN;
  v_reviewer_email TEXT;
BEGIN
  -- Check authorization
  IF NOT is_admin_or_system() THEN
    RAISE EXCEPTION 'Access denied: admin or system privileges required';
  END IF;

  -- Use provided email or get from JWT
  v_reviewer_email := COALESCE(p_reviewer_email, current_setting('request.jwt.claims', true)::jsonb->>'email');

  v_should_apply := p_confidence >= 0.9 AND p_decision IN ('approved', 'rejected');

  -- Update food with AI decision
  UPDATE foods
  SET
    ai_reviewed_at = now(),
    ai_decision = p_decision,
    ai_reasoning = p_reasoning,
    ai_confidence = p_confidence,
    ai_suggested_merge_id = p_suggested_merge_id,
    -- Auto-apply high-confidence decisions
    status = CASE WHEN v_should_apply THEN p_decision ELSE status END,
    reviewed_at = CASE WHEN v_should_apply THEN now() ELSE reviewed_at END,
    -- Only set reviewed_by if it's a real user (not system token)
    reviewed_by = CASE
      WHEN v_should_apply AND v_reviewer_email IS NOT NULL
        AND (current_setting('request.jwt.claims', true)::jsonb->>'system')::boolean IS NOT TRUE
      THEN v_reviewer_email
      ELSE reviewed_by
    END
  WHERE id = p_food_id;

  -- If rejecting with merge target and auto-applying, move ingredients to merge target
  IF v_should_apply AND p_decision = 'rejected' AND p_suggested_merge_id IS NOT NULL THEN
    UPDATE ingredients
    SET food_id = p_suggested_merge_id
    WHERE food_id = p_food_id;
  END IF;

  -- Log the review
  INSERT INTO food_review_logs (food_id, decision, reasoning, confidence, suggested_merge_id, reviewer_type)
  VALUES (p_food_id, p_decision, p_reasoning, p_confidence, p_suggested_merge_id, 'ai');
END;
$$;

-- =============================================================================
-- 3. Block reserved email domains at signup (defense-in-depth)
-- =============================================================================

-- Recreate signup with reserved email check
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

    -- Grant 3 free AI generation credits (using internal function)
    PERFORM _add_credits_internal(p_email, 3, 'signup_bonus', 'Välkomstbonus: 3 gratis AI-genereringar');
  END IF;

  SELECT * INTO _result FROM users WHERE id = _user_id;
  RETURN _result;
END;
$$;

-- Recreate signup_provider with reserved email check
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

    -- Grant 3 free AI generation credits (using internal function)
    PERFORM _add_credits_internal(p_email, 3, 'signup_bonus', 'Välkomstbonus: 3 gratis AI-genereringar');

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

-- Restore grants for signup functions (must be callable by anon for new users)
GRANT ALL ON FUNCTION public.signup(text, text, text, text) TO authenticated;
GRANT ALL ON FUNCTION public.signup(text, text, text, text) TO anon;
GRANT ALL ON FUNCTION public.signup_provider(text, text, text) TO authenticated;
GRANT ALL ON FUNCTION public.signup_provider(text, text, text) TO anon;
