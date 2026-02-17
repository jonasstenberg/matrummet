--
-- V25: Add suggested_recipe JSONB column to meal_plan_entries
-- Stores full recipe data (ingredients, instructions) for AI-suggested entries.
-- Updates save_meal_plan, get_meal_plan, and swap_meal_plan_entry to handle the new column.
--

-- ============================================================================
-- PART 1: Add column
-- ============================================================================

ALTER TABLE meal_plan_entries ADD COLUMN suggested_recipe jsonb;

-- ============================================================================
-- PART 2: Update save_meal_plan to persist suggested_recipe
-- ============================================================================

CREATE OR REPLACE FUNCTION public.save_meal_plan(
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
        suggested_recipe,
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
        v_entry->'suggested_recipe',
        COALESCE((v_entry->>'servings')::int, 4),
        COALESCE((v_entry->>'sort_order')::int, 0)
      );
    END LOOP;
  END IF;

  RETURN v_plan_id;
END;
$$;

-- ============================================================================
-- PART 3: Update get_meal_plan to return suggested_recipe
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_meal_plan(p_plan_id uuid DEFAULT NULL)
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
      SELECT * INTO v_plan
      FROM meal_plans
      WHERE home_id = v_home_id
        AND status = 'active'
      ORDER BY date_modified DESC
      LIMIT 1;
    ELSE
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
      'suggested_recipe', mpe.suggested_recipe,
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

-- ============================================================================
-- PART 4: Recreate swap_meal_plan_entry with suggested_recipe param
-- ============================================================================

-- Must DROP first because we're changing the signature
DROP FUNCTION IF EXISTS public.swap_meal_plan_entry(uuid, uuid, text, text);

CREATE FUNCTION public.swap_meal_plan_entry(
  p_entry_id uuid,
  p_recipe_id uuid DEFAULT NULL,
  p_suggested_name text DEFAULT NULL,
  p_suggested_description text DEFAULT NULL,
  p_suggested_recipe jsonb DEFAULT NULL
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
    suggested_description = p_suggested_description,
    suggested_recipe = p_suggested_recipe
  WHERE id = p_entry_id;

  -- Update parent plan's date_modified
  UPDATE meal_plans
  SET date_modified = now()
  WHERE id = (SELECT meal_plan_id FROM meal_plan_entries WHERE id = p_entry_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.swap_meal_plan_entry(uuid, uuid, text, text, jsonb) TO authenticated;
