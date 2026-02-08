--
-- V8: Add deduct_from_pantry function
-- Allows users to subtract ingredient quantities from their pantry after cooking a recipe
--

CREATE FUNCTION public.deduct_from_pantry(p_deductions jsonb) RETURNS integer
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
      CONTINUE; -- Skip invalid food_ids
    END;

    -- Parse and validate amount
    v_amount := (v_deduction.value->>'amount')::NUMERIC;
    IF v_amount IS NULL OR v_amount <= 0 THEN
      CONTINUE; -- Skip zero/negative/null amounts
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

-- Grant to authenticated users only (not anon)
GRANT EXECUTE ON FUNCTION public.deduct_from_pantry(jsonb) TO authenticated;
