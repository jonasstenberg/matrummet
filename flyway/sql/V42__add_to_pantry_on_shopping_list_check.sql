-- =============================================================================
-- V42: Add checked shopping list items to pantry automatically
-- =============================================================================
-- When a user checks off an item in their shopping list (marking it as purchased),
-- the item should also be added to their pantry automatically.
-- =============================================================================

-- Toggle shopping list item - now also adds to pantry when checking
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
  v_food_id UUID;
  v_quantity DECIMAL;
  v_unit TEXT;
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
  SELECT is_checked, shopping_list_id, food_id, quantity, display_unit
  INTO v_is_checked, v_list_id, v_food_id, v_quantity, v_unit
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

  -- If we're checking the item (not unchecking) and it has a food_id, add to pantry
  IF NOT v_is_checked AND v_food_id IS NOT NULL THEN
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
$func$;
