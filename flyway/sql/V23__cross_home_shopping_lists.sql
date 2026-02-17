--
-- V23: Cross-home shopping lists
-- Updates RLS policies and functions so users see shopping lists from ALL homes
-- they belong to (via home_members), not just the active home.
-- Also rewrites get_user_shopping_lists() to return home_id/home_name columns,
-- and create_shopping_list() to accept an explicit home_id parameter.
--

-- ============================================================================
-- PART 1: Update RLS policies on shopping_lists
-- Use is_home_member(home_id) instead of home_id = get_current_user_home_id()
-- ============================================================================

DROP POLICY shopping_lists_policy_select ON shopping_lists;
CREATE POLICY shopping_lists_policy_select ON shopping_lists FOR SELECT USING (
    (home_id IS NULL AND user_email = current_setting('request.jwt.claims', true)::jsonb->>'email')
    OR (home_id IS NOT NULL AND is_home_member(home_id))
);

DROP POLICY shopping_lists_policy_insert ON shopping_lists;
CREATE POLICY shopping_lists_policy_insert ON shopping_lists FOR INSERT WITH CHECK (
    (home_id IS NULL AND user_email = current_setting('request.jwt.claims', true)::jsonb->>'email')
    OR (home_id IS NOT NULL AND is_home_member(home_id))
);

DROP POLICY shopping_lists_policy_update ON shopping_lists;
CREATE POLICY shopping_lists_policy_update ON shopping_lists FOR UPDATE USING (
    (home_id IS NULL AND user_email = current_setting('request.jwt.claims', true)::jsonb->>'email')
    OR (home_id IS NOT NULL AND is_home_member(home_id))
);

DROP POLICY shopping_lists_policy_delete ON shopping_lists;
CREATE POLICY shopping_lists_policy_delete ON shopping_lists FOR DELETE USING (
    (home_id IS NULL AND user_email = current_setting('request.jwt.claims', true)::jsonb->>'email')
    OR (home_id IS NOT NULL AND is_home_member(home_id))
);

-- ============================================================================
-- PART 2: Update RLS policies on shopping_list_items
-- Same pattern: is_home_member(home_id) for home-based, email match for personal
-- ============================================================================

DROP POLICY shopping_list_items_policy_select ON shopping_list_items;
CREATE POLICY shopping_list_items_policy_select ON shopping_list_items FOR SELECT USING (
    (home_id IS NULL AND user_email = current_setting('request.jwt.claims', true)::jsonb->>'email')
    OR (home_id IS NOT NULL AND is_home_member(home_id))
);

DROP POLICY shopping_list_items_policy_insert ON shopping_list_items;
CREATE POLICY shopping_list_items_policy_insert ON shopping_list_items FOR INSERT WITH CHECK (
    (home_id IS NULL AND user_email = current_setting('request.jwt.claims', true)::jsonb->>'email')
    OR (home_id IS NOT NULL AND is_home_member(home_id))
);

DROP POLICY shopping_list_items_policy_update ON shopping_list_items;
CREATE POLICY shopping_list_items_policy_update ON shopping_list_items FOR UPDATE USING (
    (home_id IS NULL AND user_email = current_setting('request.jwt.claims', true)::jsonb->>'email')
    OR (home_id IS NOT NULL AND is_home_member(home_id))
);

DROP POLICY shopping_list_items_policy_delete ON shopping_list_items;
CREATE POLICY shopping_list_items_policy_delete ON shopping_list_items FOR DELETE USING (
    (home_id IS NULL AND user_email = current_setting('request.jwt.claims', true)::jsonb->>'email')
    OR (home_id IS NOT NULL AND is_home_member(home_id))
);

-- ============================================================================
-- PART 3: Rewrite get_user_shopping_lists()
-- Returns lists from ALL homes the user belongs to, plus personal lists.
-- Adds home_id and home_name columns for frontend grouping.
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_user_shopping_lists();

CREATE FUNCTION public.get_user_shopping_lists()
RETURNS TABLE(
    id uuid,
    name text,
    is_default boolean,
    item_count bigint,
    checked_count bigint,
    date_published timestamptz,
    date_modified timestamptz,
    home_id uuid,
    home_name text
)
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
    sl.id,
    sl.name,
    sl.is_default,
    COUNT(sli.id) AS item_count,
    COUNT(sli.id) FILTER (WHERE sli.is_checked) AS checked_count,
    sl.date_published,
    sl.date_modified,
    sl.home_id,
    h.name AS home_name
  FROM shopping_lists sl
  LEFT JOIN shopping_list_items sli ON sli.shopping_list_id = sl.id
  LEFT JOIN homes h ON h.id = sl.home_id
  LEFT JOIN home_members hm ON hm.home_id = sl.home_id AND hm.user_email = v_user_email
  WHERE
    (sl.home_id IS NULL AND sl.user_email = v_user_email)
    OR (sl.home_id IS NOT NULL AND hm.user_email IS NOT NULL)
  GROUP BY sl.id, h.name
  ORDER BY h.name NULLS FIRST, sl.is_default DESC, sl.date_modified DESC;
END;
$$;

-- ============================================================================
-- PART 4: Rewrite create_shopping_list()
-- Accepts optional p_home_id to create list for a specific home.
-- ============================================================================

DROP FUNCTION IF EXISTS public.create_shopping_list(text);

CREATE FUNCTION public.create_shopping_list(p_name text, p_home_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_email TEXT;
  v_list_id UUID;
  v_is_first_list BOOLEAN;
BEGIN
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  -- Validate name
  IF p_name IS NULL OR LENGTH(TRIM(p_name)) < 1 THEN
    RAISE EXCEPTION 'invalid-list-name';
  END IF;

  -- If home_id provided, verify user is a member
  IF p_home_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM home_members
      WHERE user_email = v_user_email AND home_id = p_home_id
    ) THEN
      RAISE EXCEPTION 'not-a-home-member';
    END IF;

    -- Check if this is the first list for the home
    SELECT NOT EXISTS (
      SELECT 1 FROM shopping_lists WHERE home_id = p_home_id
    ) INTO v_is_first_list;
  ELSE
    -- Personal list: check if first personal list
    SELECT NOT EXISTS (
      SELECT 1 FROM shopping_lists WHERE home_id IS NULL AND user_email = v_user_email
    ) INTO v_is_first_list;
  END IF;

  INSERT INTO shopping_lists (user_email, home_id, name, is_default)
  VALUES (v_user_email, p_home_id, TRIM(p_name), v_is_first_list)
  RETURNING id INTO v_list_id;

  RETURN v_list_id;
END;
$$;

-- ============================================================================
-- PART 5: Fix toggle_shopping_list_item()
-- Use the item's own home_id for pantry additions (not the active home context).
-- Use is_home_member() for ownership check to match V23 RLS policies.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.toggle_shopping_list_item(p_item_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_email TEXT;
  v_is_checked BOOLEAN;
  v_list_id UUID;
  v_food_id UUID;
  v_quantity DECIMAL;
  v_unit TEXT;
  v_item_home_id UUID;
BEGIN
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  -- Get current state and verify ownership via is_home_member or personal email match
  SELECT is_checked, shopping_list_id, food_id, quantity, display_unit, home_id
  INTO v_is_checked, v_list_id, v_food_id, v_quantity, v_unit, v_item_home_id
  FROM shopping_list_items
  WHERE id = p_item_id
    AND (
      (home_id IS NOT NULL AND is_home_member(home_id))
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

  -- If checking the item and it has a food_id and belongs to a home, add to THAT home's pantry
  IF NOT v_is_checked AND v_food_id IS NOT NULL AND v_item_home_id IS NOT NULL THEN
    INSERT INTO user_pantry (user_email, home_id, food_id, quantity, unit)
    VALUES (v_user_email, v_item_home_id, v_food_id, v_quantity, v_unit)
    ON CONFLICT (home_id, food_id) DO UPDATE SET
      quantity = COALESCE(user_pantry.quantity, 0) + COALESCE(EXCLUDED.quantity, 0),
      unit = COALESCE(EXCLUDED.unit, user_pantry.unit),
      added_at = NOW(),
      user_email = EXCLUDED.user_email;
  END IF;

  RETURN jsonb_build_object('is_checked', NOT v_is_checked);
END;
$$;

-- ============================================================================
-- PART 6: Unique index for personal shopping list names
-- Prevents duplicate list names per user when home_id IS NULL
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_shopping_lists_personal_name
    ON shopping_lists (user_email, name) WHERE home_id IS NULL;

-- ============================================================================
-- PART 7: Grants
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.get_user_shopping_lists() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_shopping_list(text, uuid) TO authenticated;
