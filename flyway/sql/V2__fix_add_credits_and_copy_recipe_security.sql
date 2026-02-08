-- V2: Fix security issues in add_credits and copy_recipe functions
--
-- Issues:
-- 1. add_credits allowed any authenticated user to add credits (missing admin check)
-- 2. copy_recipe allowed copying private recipes of other users (missing visibility check)
-- 3. signup/signup_provider called add_credits for signup bonus - need to handle this

-- =============================================================================
-- Create internal function for adding credits (no admin check, for system use)
-- =============================================================================
CREATE OR REPLACE FUNCTION public._add_credits_internal(
  p_user_email text,
  p_amount integer,
  p_transaction_type text,
  p_description text DEFAULT NULL,
  p_stripe_payment_intent_id text DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_balance INTEGER;
  v_existing_tx UUID;
BEGIN
  -- Idempotency check for Stripe payments
  IF p_stripe_payment_intent_id IS NOT NULL THEN
    SELECT id INTO v_existing_tx
    FROM credit_transactions
    WHERE stripe_payment_intent_id = p_stripe_payment_intent_id;

    IF v_existing_tx IS NOT NULL THEN
      -- Already processed, return current balance
      SELECT balance INTO v_new_balance FROM user_credits WHERE user_email = p_user_email;
      RETURN COALESCE(v_new_balance, 0);
    END IF;
  END IF;

  -- Upsert user_credits row
  INSERT INTO user_credits (user_email, balance, updated_at)
  VALUES (p_user_email, p_amount, now())
  ON CONFLICT (user_email) DO UPDATE
  SET balance = user_credits.balance + p_amount,
      updated_at = now()
  RETURNING balance INTO v_new_balance;

  -- Record transaction
  INSERT INTO credit_transactions (user_email, amount, balance_after, transaction_type, description, stripe_payment_intent_id)
  VALUES (p_user_email, p_amount, v_new_balance, p_transaction_type, p_description, p_stripe_payment_intent_id);

  RETURN v_new_balance;
END;
$$;

-- Revoke all access to internal function (only callable from other SECURITY DEFINER functions)
REVOKE ALL ON FUNCTION public._add_credits_internal(text, integer, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._add_credits_internal(text, integer, text, text, text) FROM authenticated;
REVOKE ALL ON FUNCTION public._add_credits_internal(text, integer, text, text, text) FROM anon;

-- =============================================================================
-- Fix add_credits: Add admin check (public API)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.add_credits(
  p_user_email text,
  p_amount integer,
  p_transaction_type text,
  p_description text DEFAULT NULL,
  p_stripe_payment_intent_id text DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Admin check: only admins can add credits via public API
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin privileges required';
  END IF;

  -- Validate amount
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  -- Validate user exists
  IF NOT EXISTS (SELECT 1 FROM users WHERE email = p_user_email) THEN
    RAISE EXCEPTION 'User not found: %', p_user_email;
  END IF;

  -- Delegate to internal function
  RETURN _add_credits_internal(p_user_email, p_amount, p_transaction_type, p_description, p_stripe_payment_intent_id);
END;
$$;

-- =============================================================================
-- Fix signup: Use internal credits function
-- =============================================================================
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

-- =============================================================================
-- Fix signup_provider: Use internal credits function
-- =============================================================================
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

-- =============================================================================
-- Fix copy_recipe: Add visibility check for source recipe
-- =============================================================================
CREATE OR REPLACE FUNCTION public.copy_recipe(p_source_recipe_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_email TEXT;
  v_new_recipe_id UUID;
  v_original_author_name TEXT;
  v_source_recipe RECORD;
BEGIN
  -- Get current user from JWT
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  -- Verify user can see the source recipe
  -- Recipe must be:
  -- 1. Public (anyone can copy), OR
  -- 2. Owned by the user (can copy own recipe), OR
  -- 3. Private but owner is in the same home as current user
  SELECT r.id, r.name, r.author, r.url, r.recipe_yield, r.recipe_yield_name,
         r.prep_time, r.cook_time, r.cuisine, r.description, r.image, r.thumbnail,
         r.owner, r.visibility, u.name AS owner_display_name
  INTO v_source_recipe
  FROM recipes r
  LEFT JOIN users u ON u.email = r.owner
  WHERE r.id = p_source_recipe_id
    AND (
      -- User owns the recipe
      r.owner = v_user_email
      -- Or recipe is public
      OR r.visibility = 'public'
      -- Or recipe owner is in the same home as current user (both have same non-null home_id)
      OR EXISTS (
        SELECT 1 FROM users u_owner
        JOIN users u_current ON u_owner.home_id = u_current.home_id
        WHERE u_owner.email = r.owner
          AND u_current.email = v_user_email
          AND u_owner.home_id IS NOT NULL
      )
    );

  IF v_source_recipe.id IS NULL THEN
    -- Don't reveal if recipe exists or not (security)
    RETURN NULL;
  END IF;

  -- Get original author display name for attribution (fallback to email if no name)
  v_original_author_name := COALESCE(v_source_recipe.owner_display_name, v_source_recipe.owner);

  -- ==========================================================================
  -- Copy recipe (owner becomes current user, visibility defaults to private)
  -- ==========================================================================
  INSERT INTO recipes (
    name,
    author,
    url,
    recipe_yield,
    recipe_yield_name,
    prep_time,
    cook_time,
    cuisine,
    description,
    image,
    thumbnail,
    owner,
    visibility,
    copied_from_recipe_id,
    copied_from_user_id,
    copied_from_author_name
  )
  VALUES (
    v_source_recipe.name,
    v_source_recipe.author,
    v_source_recipe.url,
    v_source_recipe.recipe_yield,
    v_source_recipe.recipe_yield_name,
    v_source_recipe.prep_time,
    v_source_recipe.cook_time,
    v_source_recipe.cuisine,
    v_source_recipe.description,
    v_source_recipe.image,
    v_source_recipe.thumbnail,
    v_user_email,
    'private'::recipe_visibility,
    p_source_recipe_id,
    v_source_recipe.owner,
    v_original_author_name
  )
  RETURNING id INTO v_new_recipe_id;

  -- ==========================================================================
  -- Copy ingredient_groups with ID remapping
  -- Use sort_order as correlation key (unique within recipe)
  -- ==========================================================================
  WITH source_groups AS (
    SELECT id AS old_id, name, sort_order
    FROM ingredient_groups
    WHERE recipe_id = p_source_recipe_id
  ),
  inserted_groups AS (
    INSERT INTO ingredient_groups (recipe_id, name, sort_order, owner)
    SELECT v_new_recipe_id, sg.name, sg.sort_order, v_user_email
    FROM source_groups sg
    RETURNING id AS new_id, sort_order
  ),
  group_mapping AS (
    SELECT sg.old_id, ig.new_id
    FROM source_groups sg
    JOIN inserted_groups ig ON ig.sort_order = sg.sort_order
  )
  -- Copy ingredients with remapped group_id
  INSERT INTO ingredients (
    recipe_id,
    name,
    measurement,
    quantity,
    food_id,
    unit_id,
    form,
    group_id,
    sort_order,
    owner
  )
  SELECT
    v_new_recipe_id,
    i.name,
    i.measurement,
    i.quantity,
    i.food_id,
    i.unit_id,
    i.form,
    gm.new_id,  -- Remapped group_id (NULL if original was NULL)
    i.sort_order,
    v_user_email
  FROM ingredients i
  LEFT JOIN group_mapping gm ON gm.old_id = i.group_id
  WHERE i.recipe_id = p_source_recipe_id;

  -- ==========================================================================
  -- Copy instruction_groups with ID remapping
  -- Use sort_order as correlation key (unique within recipe)
  -- ==========================================================================
  WITH source_inst_groups AS (
    SELECT id AS old_id, name, sort_order
    FROM instruction_groups
    WHERE recipe_id = p_source_recipe_id
  ),
  inserted_inst_groups AS (
    INSERT INTO instruction_groups (recipe_id, name, sort_order, owner)
    SELECT v_new_recipe_id, sig.name, sig.sort_order, v_user_email
    FROM source_inst_groups sig
    RETURNING id AS new_id, sort_order
  ),
  inst_group_mapping AS (
    SELECT sig.old_id, iig.new_id
    FROM source_inst_groups sig
    JOIN inserted_inst_groups iig ON iig.sort_order = sig.sort_order
  )
  -- Copy instructions with remapped group_id
  INSERT INTO instructions (
    recipe_id,
    step,
    group_id,
    sort_order,
    owner
  )
  SELECT
    v_new_recipe_id,
    inst.step,
    igm.new_id,  -- Remapped group_id (NULL if original was NULL)
    inst.sort_order,
    v_user_email
  FROM instructions inst
  LEFT JOIN inst_group_mapping igm ON igm.old_id = inst.group_id
  WHERE inst.recipe_id = p_source_recipe_id;

  -- ==========================================================================
  -- Copy categories (junction table - no ID remapping needed)
  -- ==========================================================================
  INSERT INTO recipe_categories (recipe, category, owner)
  SELECT v_new_recipe_id, category, v_user_email
  FROM recipe_categories
  WHERE recipe = p_source_recipe_id;

  RETURN v_new_recipe_id;
END;
$$;

-- =============================================================================
-- Re-grant permissions on recreated functions
-- =============================================================================

-- signup: needs to be callable by anon (for new users) and authenticated
GRANT ALL ON FUNCTION public.signup(text, text, text, text) TO authenticated;
GRANT ALL ON FUNCTION public.signup(text, text, text, text) TO anon;

-- signup_provider: needs to be callable by anon (for OAuth) and authenticated
GRANT ALL ON FUNCTION public.signup_provider(text, text, text) TO authenticated;
GRANT ALL ON FUNCTION public.signup_provider(text, text, text) TO anon;

-- Note: Other permissions remain unchanged:
-- add_credits: GRANT ALL TO authenticated (admin check is inside function)
-- copy_recipe: GRANT ALL TO authenticated (visibility check is inside function)

-- =============================================================================
-- Fix missing GRANTs for public data - anon should be able to read
-- =============================================================================
-- Units should be publicly readable (for displaying measurement units in recipes)
GRANT SELECT ON TABLE public.units TO anon;

-- Foods should be publicly readable (RLS policy restricts to approved foods only for anon)
GRANT SELECT ON TABLE public.foods TO anon;
