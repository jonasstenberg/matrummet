--
-- V45: Expose shopping lists and pantry via API key authentication
--
-- Problem: API key authenticated users get "permission denied" when accessing
-- shopping_lists, shopping_list_items, and user_pantry tables. This is because:
--
-- 1. shopping_lists/shopping_list_items use is_home_member() which works for
--    home-based access, but relies on the user being in home_members table.
--    For API key auth, the user's email is set correctly but they may not
--    have any home membership, making is_home_member() return false.
--
-- 2. user_pantry policies only check home_id = get_current_user_home_id()
--    with NO email-based fallback for personal pantry items.
--
-- Fix: Update RLS policies to also allow access when the user_email matches
-- the authenticated user's email (from request.jwt.claims), enabling both:
--   - Home-based access (via is_home_member for multi-home support)
--   - Personal access (via email match for users without homes / API key auth)
--

-- ============================================================================
-- PART 1: Update user_pantry RLS policies
-- Add email-based access and use is_home_member() for consistency
-- ============================================================================

DROP POLICY user_pantry_policy_select ON user_pantry;
CREATE POLICY user_pantry_policy_select ON user_pantry FOR SELECT USING (
    (home_id IS NULL AND user_email = current_setting('request.jwt.claims', true)::jsonb->>'email')
    OR (home_id IS NOT NULL AND is_home_member(home_id))
);

DROP POLICY user_pantry_policy_insert ON user_pantry;
CREATE POLICY user_pantry_policy_insert ON user_pantry FOR INSERT WITH CHECK (
    (home_id IS NULL AND user_email = current_setting('request.jwt.claims', true)::jsonb->>'email')
    OR (home_id IS NOT NULL AND is_home_member(home_id))
);

DROP POLICY user_pantry_policy_update ON user_pantry;
CREATE POLICY user_pantry_policy_update ON user_pantry FOR UPDATE USING (
    (home_id IS NULL AND user_email = current_setting('request.jwt.claims', true)::jsonb->>'email')
    OR (home_id IS NOT NULL AND is_home_member(home_id))
);

DROP POLICY user_pantry_policy_delete ON user_pantry;
CREATE POLICY user_pantry_policy_delete ON user_pantry FOR DELETE USING (
    (home_id IS NULL AND user_email = current_setting('request.jwt.claims', true)::jsonb->>'email')
    OR (home_id IS NOT NULL AND is_home_member(home_id))
);

-- ============================================================================
-- PART 2: Update shopping_lists RLS policies to also match on user_email
-- The current policies use is_home_member() for home-based access but don't
-- handle the case where a user accesses their own personal lists via API key
-- when they also belong to homes. Add explicit user_email match as fallback.
-- ============================================================================

DROP POLICY shopping_lists_policy_select ON shopping_lists;
CREATE POLICY shopping_lists_policy_select ON shopping_lists FOR SELECT USING (
    user_email = current_setting('request.jwt.claims', true)::jsonb->>'email'
    OR (home_id IS NOT NULL AND is_home_member(home_id))
);

DROP POLICY shopping_lists_policy_insert ON shopping_lists;
CREATE POLICY shopping_lists_policy_insert ON shopping_lists FOR INSERT WITH CHECK (
    user_email = current_setting('request.jwt.claims', true)::jsonb->>'email'
    OR (home_id IS NOT NULL AND is_home_member(home_id))
);

DROP POLICY shopping_lists_policy_update ON shopping_lists;
CREATE POLICY shopping_lists_policy_update ON shopping_lists FOR UPDATE USING (
    user_email = current_setting('request.jwt.claims', true)::jsonb->>'email'
    OR (home_id IS NOT NULL AND is_home_member(home_id))
);

DROP POLICY shopping_lists_policy_delete ON shopping_lists;
CREATE POLICY shopping_lists_policy_delete ON shopping_lists FOR DELETE USING (
    user_email = current_setting('request.jwt.claims', true)::jsonb->>'email'
    OR (home_id IS NOT NULL AND is_home_member(home_id))
);

-- ============================================================================
-- PART 3: Update shopping_list_items RLS policies (same pattern)
-- ============================================================================

DROP POLICY shopping_list_items_policy_select ON shopping_list_items;
CREATE POLICY shopping_list_items_policy_select ON shopping_list_items FOR SELECT USING (
    user_email = current_setting('request.jwt.claims', true)::jsonb->>'email'
    OR (home_id IS NOT NULL AND is_home_member(home_id))
);

DROP POLICY shopping_list_items_policy_insert ON shopping_list_items;
CREATE POLICY shopping_list_items_policy_insert ON shopping_list_items FOR INSERT WITH CHECK (
    user_email = current_setting('request.jwt.claims', true)::jsonb->>'email'
    OR (home_id IS NOT NULL AND is_home_member(home_id))
);

DROP POLICY shopping_list_items_policy_update ON shopping_list_items;
CREATE POLICY shopping_list_items_policy_update ON shopping_list_items FOR UPDATE USING (
    user_email = current_setting('request.jwt.claims', true)::jsonb->>'email'
    OR (home_id IS NOT NULL AND is_home_member(home_id))
);

DROP POLICY shopping_list_items_policy_delete ON shopping_list_items;
CREATE POLICY shopping_list_items_policy_delete ON shopping_list_items FOR DELETE USING (
    user_email = current_setting('request.jwt.claims', true)::jsonb->>'email'
    OR (home_id IS NOT NULL AND is_home_member(home_id))
);

-- ============================================================================
-- PART 4: Update pantry RPC functions with email fallback
-- These functions currently fail or return empty for users without a home.
-- Update them to fall back to user_email matching when home_id is NULL,
-- following the same pattern as shopping list functions in V22.
-- ============================================================================

-- add_to_pantry(): Allow personal pantry items when user has no home
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

  -- Validate food_id exists
  IF NOT EXISTS (SELECT 1 FROM foods WHERE id = p_food_id) THEN
    RAISE EXCEPTION 'food-not-found';
  END IF;

  IF v_home_id IS NOT NULL THEN
    -- Home-based: upsert keyed by home_id + food_id
    INSERT INTO user_pantry (user_email, home_id, food_id, quantity, unit, expires_at)
    VALUES (v_user_email, v_home_id, p_food_id, p_quantity, p_unit, p_expires_at)
    ON CONFLICT (home_id, food_id) DO UPDATE SET
      quantity = EXCLUDED.quantity,
      unit = EXCLUDED.unit,
      expires_at = EXCLUDED.expires_at,
      added_at = NOW(),
      user_email = EXCLUDED.user_email
    RETURNING id INTO v_pantry_id;
  ELSE
    -- Personal: upsert keyed by user_email + food_id (with home_id NULL)
    -- First try to find an existing personal entry
    SELECT id INTO v_pantry_id
    FROM user_pantry
    WHERE home_id IS NULL AND user_email = v_user_email AND food_id = p_food_id;

    IF v_pantry_id IS NOT NULL THEN
      UPDATE user_pantry
      SET quantity = p_quantity, unit = p_unit, expires_at = p_expires_at, added_at = NOW()
      WHERE id = v_pantry_id;
    ELSE
      INSERT INTO user_pantry (user_email, home_id, food_id, quantity, unit, expires_at)
      VALUES (v_user_email, NULL, p_food_id, p_quantity, p_unit, p_expires_at)
      RETURNING id INTO v_pantry_id;
    END IF;
  END IF;

  RETURN v_pantry_id;
END;
$$;

-- remove_from_pantry(): Allow removing personal pantry items when user has no home
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

  IF v_home_id IS NOT NULL THEN
    -- Home-based: delete by home_id + food_id
    DELETE FROM user_pantry
    WHERE home_id = v_home_id AND food_id = p_food_id;
  ELSE
    -- Personal: delete by user_email + food_id (with home_id NULL)
    DELETE FROM user_pantry
    WHERE home_id IS NULL AND user_email = v_user_email AND food_id = p_food_id;
  END IF;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN v_deleted > 0;
END;
$$;

-- get_user_pantry(): Return personal pantry items when user has no home
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

  IF v_home_id IS NOT NULL THEN
    -- Home-based: return pantry items for the home
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
  ELSE
    -- Personal: return personal pantry items (home_id IS NULL)
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
    WHERE up.home_id IS NULL AND up.user_email = v_user_email
    ORDER BY
      CASE WHEN up.expires_at IS NOT NULL AND up.expires_at < CURRENT_DATE THEN 0 ELSE 1 END,
      up.expires_at NULLS LAST,
      f.name;
  END IF;
END;
$$;

-- find_recipes_from_pantry(): Use personal pantry items when user has no home
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

  IF v_home_id IS NOT NULL THEN
    -- Home-based: get food_ids from home's pantry
    SELECT ARRAY_AGG(up.food_id)
    INTO v_pantry_food_ids
    FROM user_pantry up
    WHERE up.home_id = v_home_id;
  ELSE
    -- Personal: get food_ids from personal pantry (home_id IS NULL)
    SELECT ARRAY_AGG(up.food_id)
    INTO v_pantry_food_ids
    FROM user_pantry up
    WHERE up.home_id IS NULL AND up.user_email = v_user_email;
  END IF;

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

-- deduct_from_pantry(): Allow deducting from personal pantry when user has no home
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

    IF v_home_id IS NOT NULL THEN
      -- Home-based: get current quantity from home pantry
      SELECT quantity INTO v_current_quantity
      FROM user_pantry
      WHERE home_id = v_home_id AND food_id = v_canonical_food_id;
    ELSE
      -- Personal: get current quantity from personal pantry
      SELECT quantity INTO v_current_quantity
      FROM user_pantry
      WHERE home_id IS NULL AND user_email = v_user_email AND food_id = v_canonical_food_id;
    END IF;

    -- Skip if item not in pantry
    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    -- If quantity is NULL (untracked) or would go to zero or below, remove the item
    IF v_current_quantity IS NULL OR (v_current_quantity - v_amount) <= 0 THEN
      IF v_home_id IS NOT NULL THEN
        DELETE FROM user_pantry
        WHERE home_id = v_home_id AND food_id = v_canonical_food_id;
      ELSE
        DELETE FROM user_pantry
        WHERE home_id IS NULL AND user_email = v_user_email AND food_id = v_canonical_food_id;
      END IF;
      v_updated_count := v_updated_count + 1;
    ELSE
      -- Subtract the amount
      IF v_home_id IS NOT NULL THEN
        UPDATE user_pantry
        SET quantity = quantity - v_amount
        WHERE home_id = v_home_id AND food_id = v_canonical_food_id;
      ELSE
        UPDATE user_pantry
        SET quantity = quantity - v_amount
        WHERE home_id IS NULL AND user_email = v_user_email AND food_id = v_canonical_food_id;
      END IF;
      v_updated_count := v_updated_count + 1;
    END IF;
  END LOOP;

  RETURN v_updated_count;
END;
$$;
