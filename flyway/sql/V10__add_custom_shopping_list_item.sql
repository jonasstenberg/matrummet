-- Add ability to add custom items to shopping list
-- Supports both freeform items (e.g. "Hushållspapper") and food-linked items

CREATE FUNCTION public.add_custom_shopping_list_item(
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
  v_trimmed_name := btrim(p_name);
  IF v_trimmed_name = '' THEN
    RAISE EXCEPTION 'name-is-empty';
  END IF;

  -- Get or create shopping list
  IF p_shopping_list_id IS NOT NULL THEN
    SELECT id INTO v_list_id
    FROM shopping_lists
    WHERE id = p_shopping_list_id AND home_id = v_home_id;

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
    -- Increment quantity on existing item
    UPDATE shopping_list_items
    SET quantity = quantity + 1
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

  -- Update shopping list modified timestamp
  UPDATE shopping_lists SET date_modified = now() WHERE id = v_list_id;

  RETURN jsonb_build_object(
    'item_id', v_new_item_id,
    'list_id', v_list_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.add_custom_shopping_list_item(TEXT, UUID, UUID) FROM PUBLIC;
GRANT ALL ON FUNCTION public.add_custom_shopping_list_item(TEXT, UUID, UUID) TO authenticated;
