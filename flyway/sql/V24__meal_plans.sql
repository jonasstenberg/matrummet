--
-- V24: Meal plans
-- Adds meal planning tables (meal_plans, meal_plan_entries) with RLS,
-- plus RPC functions for creating, reading, updating, and shopping list integration.
-- Also extends credit_transactions to allow 'meal_plan' transaction type.
--

-- ============================================================================
-- PART 1: Extend credit_transactions constraint
-- ============================================================================

ALTER TABLE credit_transactions DROP CONSTRAINT credit_transactions_transaction_type_check;
ALTER TABLE credit_transactions ADD CONSTRAINT credit_transactions_transaction_type_check
    CHECK (transaction_type IN ('signup_bonus', 'purchase', 'admin_grant', 'ai_generation', 'refund', 'meal_plan'));

-- ============================================================================
-- PART 2: Create meal_plans table
-- ============================================================================

CREATE TABLE meal_plans (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_email text NOT NULL REFERENCES users(email) ON DELETE CASCADE,
    home_id uuid REFERENCES homes(id) ON DELETE CASCADE,
    name text DEFAULT 'Veckoplan',
    week_start date NOT NULL,
    preferences jsonb DEFAULT '{}'::jsonb,
    status text DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    date_published timestamptz DEFAULT now() NOT NULL,
    date_modified timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX meal_plans_user_email_idx ON meal_plans(user_email);
CREATE INDEX meal_plans_home_id_idx ON meal_plans(home_id);

ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE ONLY meal_plans FORCE ROW LEVEL SECURITY;

-- SELECT: owner OR home member
CREATE POLICY meal_plans_policy_select ON meal_plans FOR SELECT USING (
    user_email = current_setting('request.jwt.claims', true)::jsonb->>'email'
    OR is_home_member(home_id)
);

-- INSERT: owner only
CREATE POLICY meal_plans_policy_insert ON meal_plans FOR INSERT WITH CHECK (
    user_email = current_setting('request.jwt.claims', true)::jsonb->>'email'
);

-- UPDATE: owner OR home member
CREATE POLICY meal_plans_policy_update ON meal_plans FOR UPDATE USING (
    user_email = current_setting('request.jwt.claims', true)::jsonb->>'email'
    OR is_home_member(home_id)
);

-- DELETE: owner only
CREATE POLICY meal_plans_policy_delete ON meal_plans FOR DELETE USING (
    user_email = current_setting('request.jwt.claims', true)::jsonb->>'email'
);

GRANT SELECT, INSERT, UPDATE, DELETE ON meal_plans TO authenticated;

-- ============================================================================
-- PART 3: Create meal_plan_entries table
-- ============================================================================

CREATE TABLE meal_plan_entries (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    meal_plan_id uuid NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
    day_of_week int NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
    meal_type text NOT NULL CHECK (meal_type IN ('frukost', 'lunch', 'middag', 'mellanmal')),
    recipe_id uuid REFERENCES recipes(id) ON DELETE SET NULL,
    suggested_name text,
    suggested_description text,
    servings int DEFAULT 4,
    sort_order int DEFAULT 0,
    CHECK (recipe_id IS NOT NULL OR suggested_name IS NOT NULL)
);

CREATE INDEX meal_plan_entries_meal_plan_id_idx ON meal_plan_entries(meal_plan_id);

ALTER TABLE meal_plan_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE ONLY meal_plan_entries FORCE ROW LEVEL SECURITY;

-- SELECT: inherited from parent meal_plan
CREATE POLICY meal_plan_entries_policy_select ON meal_plan_entries FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM meal_plans mp
        WHERE mp.id = meal_plan_entries.meal_plan_id
          AND (
            mp.user_email = current_setting('request.jwt.claims', true)::jsonb->>'email'
            OR is_home_member(mp.home_id)
          )
    )
);

-- INSERT: inherited from parent meal_plan
CREATE POLICY meal_plan_entries_policy_insert ON meal_plan_entries FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM meal_plans mp
        WHERE mp.id = meal_plan_entries.meal_plan_id
          AND (
            mp.user_email = current_setting('request.jwt.claims', true)::jsonb->>'email'
            OR is_home_member(mp.home_id)
          )
    )
);

-- UPDATE: inherited from parent meal_plan
CREATE POLICY meal_plan_entries_policy_update ON meal_plan_entries FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM meal_plans mp
        WHERE mp.id = meal_plan_entries.meal_plan_id
          AND (
            mp.user_email = current_setting('request.jwt.claims', true)::jsonb->>'email'
            OR is_home_member(mp.home_id)
          )
    )
);

-- DELETE: inherited from parent meal_plan
CREATE POLICY meal_plan_entries_policy_delete ON meal_plan_entries FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM meal_plans mp
        WHERE mp.id = meal_plan_entries.meal_plan_id
          AND (
            mp.user_email = current_setting('request.jwt.claims', true)::jsonb->>'email'
            OR is_home_member(mp.home_id)
          )
    )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON meal_plan_entries TO authenticated;

-- ============================================================================
-- PART 4: get_meal_plan(p_plan_id uuid DEFAULT NULL)
-- ============================================================================

CREATE FUNCTION public.get_meal_plan(p_plan_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_email TEXT;
  v_home_id UUID;
  v_plan RECORD;
  v_entries JSONB;
BEGIN
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  -- If no plan_id provided, find the most recent active plan
  IF p_plan_id IS NOT NULL THEN
    SELECT * INTO v_plan
    FROM meal_plans
    WHERE id = p_plan_id
      AND (
        user_email = v_user_email
        OR is_home_member(home_id)
      );
  ELSE
    v_home_id := get_current_user_home_id();

    IF v_home_id IS NOT NULL THEN
      -- Home context: find latest active plan for the home
      SELECT * INTO v_plan
      FROM meal_plans
      WHERE home_id = v_home_id
        AND status = 'active'
      ORDER BY date_modified DESC
      LIMIT 1;
    ELSE
      -- Personal context: find latest active plan for the user (no home)
      SELECT * INTO v_plan
      FROM meal_plans
      WHERE user_email = v_user_email
        AND home_id IS NULL
        AND status = 'active'
      ORDER BY date_modified DESC
      LIMIT 1;
    END IF;
  END IF;

  IF v_plan.id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Build entries array with recipe details
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', mpe.id,
      'day_of_week', mpe.day_of_week,
      'meal_type', mpe.meal_type,
      'recipe_id', mpe.recipe_id,
      'suggested_name', mpe.suggested_name,
      'suggested_description', mpe.suggested_description,
      'servings', mpe.servings,
      'sort_order', mpe.sort_order,
      'recipe', CASE
        WHEN mpe.recipe_id IS NOT NULL AND r.id IS NOT NULL THEN
          jsonb_build_object(
            'id', r.id,
            'name', r.name,
            'image', r.image,
            'thumbnail', r.thumbnail,
            'prep_time', r.prep_time,
            'cook_time', r.cook_time,
            'recipe_yield', r.recipe_yield,
            'categories', COALESCE(rc.categories, '[]'::jsonb)
          )
        ELSE NULL
      END
    ) ORDER BY mpe.day_of_week, mpe.sort_order
  ), '[]'::jsonb) INTO v_entries
  FROM meal_plan_entries mpe
  LEFT JOIN recipes r ON r.id = mpe.recipe_id
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(c.name) AS categories
    FROM recipe_categories rcj
    JOIN categories c ON c.id = rcj.category
    WHERE rcj.recipe = r.id
  ) rc ON true
  WHERE mpe.meal_plan_id = v_plan.id;

  RETURN jsonb_build_object(
    'id', v_plan.id,
    'user_email', v_plan.user_email,
    'home_id', v_plan.home_id,
    'name', v_plan.name,
    'week_start', v_plan.week_start,
    'preferences', v_plan.preferences,
    'status', v_plan.status,
    'date_published', v_plan.date_published,
    'date_modified', v_plan.date_modified,
    'entries', v_entries
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_meal_plan(uuid) TO authenticated;

-- ============================================================================
-- PART 5: save_meal_plan(p_week_start, p_preferences, p_entries)
-- ============================================================================

CREATE FUNCTION public.save_meal_plan(
  p_week_start date,
  p_preferences jsonb,
  p_entries jsonb
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_email TEXT;
  v_home_id UUID;
  v_plan_id UUID;
  v_entry JSONB;
BEGIN
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  v_home_id := get_current_user_home_id();

  -- Archive any existing active plans for this user/home
  IF v_home_id IS NOT NULL THEN
    UPDATE meal_plans
    SET status = 'archived', date_modified = now()
    WHERE home_id = v_home_id
      AND status = 'active';
  ELSE
    UPDATE meal_plans
    SET status = 'archived', date_modified = now()
    WHERE user_email = v_user_email
      AND home_id IS NULL
      AND status = 'active';
  END IF;

  -- Create new meal plan
  INSERT INTO meal_plans (user_email, home_id, week_start, preferences, status)
  VALUES (v_user_email, v_home_id, p_week_start, COALESCE(p_preferences, '{}'::jsonb), 'active')
  RETURNING id INTO v_plan_id;

  -- Insert entries from the jsonb array
  IF p_entries IS NOT NULL AND jsonb_array_length(p_entries) > 0 THEN
    FOR v_entry IN SELECT * FROM jsonb_array_elements(p_entries)
    LOOP
      INSERT INTO meal_plan_entries (
        meal_plan_id,
        day_of_week,
        meal_type,
        recipe_id,
        suggested_name,
        suggested_description,
        servings,
        sort_order
      )
      VALUES (
        v_plan_id,
        (v_entry->>'day_of_week')::int,
        v_entry->>'meal_type',
        CASE WHEN v_entry->>'recipe_id' IS NOT NULL THEN (v_entry->>'recipe_id')::uuid ELSE NULL END,
        v_entry->>'suggested_name',
        v_entry->>'suggested_description',
        COALESCE((v_entry->>'servings')::int, 4),
        COALESCE((v_entry->>'sort_order')::int, 0)
      );
    END LOOP;
  END IF;

  RETURN v_plan_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_meal_plan(date, jsonb, jsonb) TO authenticated;

-- ============================================================================
-- PART 6: swap_meal_plan_entry(p_entry_id, p_recipe_id, p_suggested_name, p_suggested_description)
-- ============================================================================

CREATE FUNCTION public.swap_meal_plan_entry(
  p_entry_id uuid,
  p_recipe_id uuid DEFAULT NULL,
  p_suggested_name text DEFAULT NULL,
  p_suggested_description text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_email TEXT;
  v_entry_exists BOOLEAN;
BEGIN
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  -- Verify ownership through parent meal_plan
  SELECT EXISTS (
    SELECT 1
    FROM meal_plan_entries mpe
    JOIN meal_plans mp ON mp.id = mpe.meal_plan_id
    WHERE mpe.id = p_entry_id
      AND (
        mp.user_email = v_user_email
        OR is_home_member(mp.home_id)
      )
  ) INTO v_entry_exists;

  IF NOT v_entry_exists THEN
    RAISE EXCEPTION 'entry-not-found';
  END IF;

  -- At least one of recipe_id or suggested_name must be provided
  IF p_recipe_id IS NULL AND p_suggested_name IS NULL THEN
    RAISE EXCEPTION 'recipe-or-name-required';
  END IF;

  UPDATE meal_plan_entries
  SET
    recipe_id = p_recipe_id,
    suggested_name = p_suggested_name,
    suggested_description = p_suggested_description
  WHERE id = p_entry_id;

  -- Update parent plan's date_modified
  UPDATE meal_plans
  SET date_modified = now()
  WHERE id = (SELECT meal_plan_id FROM meal_plan_entries WHERE id = p_entry_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.swap_meal_plan_entry(uuid, uuid, text, text) TO authenticated;

-- ============================================================================
-- PART 7: add_meal_plan_to_shopping_list(p_plan_id, p_shopping_list_id)
-- ============================================================================

CREATE FUNCTION public.add_meal_plan_to_shopping_list(
  p_plan_id uuid,
  p_shopping_list_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_email TEXT;
  v_plan_exists BOOLEAN;
  v_entry RECORD;
  v_added_count INT := 0;
BEGIN
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  -- Verify ownership of the meal plan
  SELECT EXISTS (
    SELECT 1 FROM meal_plans
    WHERE id = p_plan_id
      AND (
        user_email = v_user_email
        OR is_home_member(home_id)
      )
  ) INTO v_plan_exists;

  IF NOT v_plan_exists THEN
    RAISE EXCEPTION 'meal-plan-not-found';
  END IF;

  -- Iterate all entries that have a recipe_id
  FOR v_entry IN
    SELECT recipe_id, servings
    FROM meal_plan_entries
    WHERE meal_plan_id = p_plan_id
      AND recipe_id IS NOT NULL
  LOOP
    PERFORM add_recipe_to_shopping_list(
      v_entry.recipe_id,
      p_shopping_list_id,
      v_entry.servings
    );
    v_added_count := v_added_count + 1;
  END LOOP;

  RETURN jsonb_build_object('recipes_added', v_added_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_meal_plan_to_shopping_list(uuid, uuid) TO authenticated;
