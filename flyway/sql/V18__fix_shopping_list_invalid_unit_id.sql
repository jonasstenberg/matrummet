-- Fix 1: Clean up invalid unit_ids in ingredients table
UPDATE ingredients
SET unit_id = get_unit(measurement)
WHERE unit_id IS NOT NULL
  AND unit_id NOT IN (SELECT id FROM units);

-- Fix 2: Add FK constraint on ingredients.unit_id to prevent future bad data (if not already present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ingredients_unit_id_fkey'
      AND table_name = 'ingredients'
  ) THEN
    ALTER TABLE public.ingredients
      ADD CONSTRAINT ingredients_unit_id_fkey
      FOREIGN KEY (unit_id) REFERENCES public.units(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Fix 3: Allow shopping lists to work without a household
-- shopping_lists policies: allow home-based OR personal (email-based) access
DROP POLICY shopping_lists_policy_select ON public.shopping_lists;
CREATE POLICY shopping_lists_policy_select ON public.shopping_lists FOR SELECT USING (
  (home_id IS NOT NULL AND home_id = public.get_current_user_home_id())
  OR (home_id IS NULL AND user_email = (current_setting('request.jwt.claims', true)::jsonb->>'email'))
);

DROP POLICY shopping_lists_policy_insert ON public.shopping_lists;
CREATE POLICY shopping_lists_policy_insert ON public.shopping_lists FOR INSERT WITH CHECK (
  (home_id IS NOT NULL AND home_id = public.get_current_user_home_id())
  OR (home_id IS NULL AND user_email = (current_setting('request.jwt.claims', true)::jsonb->>'email'))
);

DROP POLICY shopping_lists_policy_update ON public.shopping_lists;
CREATE POLICY shopping_lists_policy_update ON public.shopping_lists FOR UPDATE USING (
  (home_id IS NOT NULL AND home_id = public.get_current_user_home_id())
  OR (home_id IS NULL AND user_email = (current_setting('request.jwt.claims', true)::jsonb->>'email'))
);

DROP POLICY shopping_lists_policy_delete ON public.shopping_lists;
CREATE POLICY shopping_lists_policy_delete ON public.shopping_lists FOR DELETE USING (
  (home_id IS NOT NULL AND home_id = public.get_current_user_home_id())
  OR (home_id IS NULL AND user_email = (current_setting('request.jwt.claims', true)::jsonb->>'email'))
);

-- shopping_list_items policies: allow home-based OR personal (email-based) access
DROP POLICY shopping_list_items_policy_select ON public.shopping_list_items;
CREATE POLICY shopping_list_items_policy_select ON public.shopping_list_items FOR SELECT USING (
  (home_id IS NOT NULL AND home_id = public.get_current_user_home_id())
  OR (home_id IS NULL AND user_email = (current_setting('request.jwt.claims', true)::jsonb->>'email'))
);

DROP POLICY shopping_list_items_policy_insert ON public.shopping_list_items;
CREATE POLICY shopping_list_items_policy_insert ON public.shopping_list_items FOR INSERT WITH CHECK (
  (home_id IS NOT NULL AND home_id = public.get_current_user_home_id())
  OR (home_id IS NULL AND user_email = (current_setting('request.jwt.claims', true)::jsonb->>'email'))
);

DROP POLICY shopping_list_items_policy_update ON public.shopping_list_items;
CREATE POLICY shopping_list_items_policy_update ON public.shopping_list_items FOR UPDATE USING (
  (home_id IS NOT NULL AND home_id = public.get_current_user_home_id())
  OR (home_id IS NULL AND user_email = (current_setting('request.jwt.claims', true)::jsonb->>'email'))
);

DROP POLICY shopping_list_items_policy_delete ON public.shopping_list_items;
CREATE POLICY shopping_list_items_policy_delete ON public.shopping_list_items FOR DELETE USING (
  (home_id IS NOT NULL AND home_id = public.get_current_user_home_id())
  OR (home_id IS NULL AND user_email = (current_setting('request.jwt.claims', true)::jsonb->>'email'))
);

-- shopping_list_view: include personal items (home_id IS NULL)
CREATE OR REPLACE VIEW public.shopping_list_view AS
 SELECT sli.id,
    sli.shopping_list_id,
    sli.home_id,
    sli.food_id,
    sli.unit_id,
    sli.display_name,
    sli.display_unit,
    sli.quantity,
    sli.is_checked,
    sli.checked_at,
    sli.sort_order,
    sli.user_email,
    sli.date_published,
    COALESCE(f.name, sli.display_name) AS item_name,
    COALESCE(u.abbreviation, u.name, sli.display_unit) AS unit_name,
    sl.name AS list_name,
    array_agg(DISTINCT slis.recipe_name) FILTER (WHERE (slis.recipe_name IS NOT NULL)) AS source_recipes
   FROM ((((public.shopping_list_items sli
     JOIN public.shopping_lists sl ON ((sl.id = sli.shopping_list_id)))
     LEFT JOIN public.foods f ON ((sli.food_id = f.id)))
     LEFT JOIN public.units u ON ((sli.unit_id = u.id)))
     LEFT JOIN public.shopping_list_item_sources slis ON ((slis.shopping_list_item_id = sli.id)))
  WHERE (
    (sli.home_id IS NOT NULL AND sli.home_id = public.get_current_user_home_id())
    OR (sli.home_id IS NULL AND sli.user_email = (current_setting('request.jwt.claims', true)::jsonb->>'email'))
  )
  GROUP BY sli.id, f.name, u.abbreviation, u.name, sl.name;

-- get_or_create_default_shopping_list: work without a home
CREATE OR REPLACE FUNCTION public.get_or_create_default_shopping_list() RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_email TEXT;
  v_home_id UUID;
  v_list_id UUID;
BEGIN
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  SELECT home_id INTO v_home_id
  FROM users
  WHERE email = v_user_email;

  IF v_home_id IS NOT NULL THEN
    -- Home-based: find default list for the home
    SELECT id INTO v_list_id
    FROM shopping_lists
    WHERE home_id = v_home_id AND is_default = true;

    IF v_list_id IS NOT NULL THEN
      RETURN v_list_id;
    END IF;

    INSERT INTO shopping_lists (user_email, home_id, name, is_default)
    VALUES (v_user_email, v_home_id, 'Inköpslista', true)
    ON CONFLICT (home_id, name) DO UPDATE SET is_default = true
    RETURNING id INTO v_list_id;
  ELSE
    -- Personal: find default list for the user (no home)
    SELECT id INTO v_list_id
    FROM shopping_lists
    WHERE home_id IS NULL AND user_email = v_user_email AND is_default = true;

    IF v_list_id IS NOT NULL THEN
      RETURN v_list_id;
    END IF;

    INSERT INTO shopping_lists (user_email, home_id, name, is_default)
    VALUES (v_user_email, NULL, 'Inköpslista', true)
    RETURNING id INTO v_list_id;
  END IF;

  RETURN v_list_id;
END;
$$;

-- add_recipe_to_shopping_list: work without a home + validate unit_id
CREATE OR REPLACE FUNCTION public.add_recipe_to_shopping_list(p_recipe_id uuid, p_shopping_list_id uuid DEFAULT NULL::uuid, p_servings integer DEFAULT NULL::integer, p_ingredient_ids uuid[] DEFAULT NULL::uuid[]) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_email TEXT;
  v_home_id UUID;
  v_list_id UUID;
  v_recipe_name TEXT;
  v_recipe_yield INTEGER;
  v_scale_factor NUMERIC;
  v_added_count INTEGER := 0;
  v_ingredient RECORD;
  v_existing_item_id UUID;
  v_new_item_id UUID;
  v_ingredient_quantity NUMERIC;
  v_scaled_quantity NUMERIC;
  v_canonical_food_id UUID;
  v_valid_unit_id UUID;
BEGIN
  -- Get current user email from JWT
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  -- Get user's home_id (may be NULL for personal use)
  SELECT home_id INTO v_home_id
  FROM users
  WHERE email = v_user_email;

  -- Get recipe details
  SELECT name, recipe_yield INTO v_recipe_name, v_recipe_yield
  FROM recipes
  WHERE id = p_recipe_id;

  IF v_recipe_name IS NULL THEN
    RAISE EXCEPTION 'recipe-not-found';
  END IF;

  -- Get or create shopping list
  IF p_shopping_list_id IS NOT NULL THEN
    -- Verify the list belongs to the user's home or is their personal list
    SELECT id INTO v_list_id
    FROM shopping_lists
    WHERE id = p_shopping_list_id
      AND (
        (home_id IS NOT NULL AND home_id = v_home_id)
        OR (home_id IS NULL AND user_email = v_user_email)
      );

    IF v_list_id IS NULL THEN
      RAISE EXCEPTION 'shopping-list-not-found';
    END IF;
  ELSE
    v_list_id := get_or_create_default_shopping_list();
  END IF;

  -- Calculate scale factor
  IF p_servings IS NOT NULL AND v_recipe_yield IS NOT NULL AND v_recipe_yield > 0 THEN
    v_scale_factor := p_servings::NUMERIC / v_recipe_yield::NUMERIC;
  ELSE
    v_scale_factor := 1.0;
  END IF;

  -- Process each ingredient
  FOR v_ingredient IN
    SELECT
      i.id,
      i.name,
      i.measurement,
      i.quantity,
      i.food_id,
      i.unit_id
    FROM ingredients i
    WHERE i.recipe_id = p_recipe_id
      AND (p_ingredient_ids IS NULL OR i.id = ANY(p_ingredient_ids))
  LOOP
    -- Parse quantity
    BEGIN
      v_ingredient_quantity := v_ingredient.quantity::NUMERIC;
    EXCEPTION WHEN OTHERS THEN
      v_ingredient_quantity := 1;
    END;

    v_scaled_quantity := v_ingredient_quantity * v_scale_factor;

    -- Validate unit_id exists in units table, fallback to NULL
    IF v_ingredient.unit_id IS NOT NULL THEN
      SELECT id INTO v_valid_unit_id FROM units WHERE id = v_ingredient.unit_id;
    ELSE
      v_valid_unit_id := NULL;
    END IF;

    -- Resolve ingredient food_id to canonical for merge check
    IF v_ingredient.food_id IS NOT NULL THEN
      v_canonical_food_id := resolve_canonical(v_ingredient.food_id);

      -- Check for existing unchecked item with same canonical food_id AND unit_id
      SELECT sli.id INTO v_existing_item_id
      FROM shopping_list_items sli
      LEFT JOIN foods f ON f.id = sli.food_id
      WHERE sli.shopping_list_id = v_list_id
        AND COALESCE(f.canonical_food_id, sli.food_id) = v_canonical_food_id
        AND sli.unit_id IS NOT DISTINCT FROM v_valid_unit_id
        AND sli.is_checked = false;
    ELSE
      v_existing_item_id := NULL;
    END IF;

    IF v_existing_item_id IS NOT NULL THEN
      -- Add quantity to existing item
      UPDATE shopping_list_items
      SET quantity = quantity + v_scaled_quantity
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
        v_ingredient.food_id,
        v_valid_unit_id,
        v_ingredient.name,
        COALESCE(v_ingredient.measurement, ''),
        v_scaled_quantity,
        v_user_email,
        (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM shopping_list_items WHERE shopping_list_id = v_list_id)
      )
      RETURNING id INTO v_new_item_id;
    END IF;

    -- Insert source tracking record
    INSERT INTO shopping_list_item_sources (
      shopping_list_item_id,
      recipe_id,
      recipe_name,
      quantity_added,
      servings_used,
      user_email
    )
    VALUES (
      v_new_item_id,
      p_recipe_id,
      v_recipe_name,
      v_scaled_quantity,
      p_servings,
      v_user_email
    );

    v_added_count := v_added_count + 1;
  END LOOP;

  -- Update shopping list modified timestamp
  UPDATE shopping_lists SET date_modified = now() WHERE id = v_list_id;

  RETURN jsonb_build_object(
    'added_count', v_added_count,
    'list_id', v_list_id
  );
END;
$$;

-- add_custom_shopping_list_item: work without a home
CREATE OR REPLACE FUNCTION public.add_custom_shopping_list_item(
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
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  SELECT home_id INTO v_home_id
  FROM users
  WHERE email = v_user_email;

  -- Validate name
  v_trimmed_name := btrim(p_name);
  IF v_trimmed_name = '' THEN
    RAISE EXCEPTION 'name-is-empty';
  END IF;

  -- Get or create shopping list
  IF p_shopping_list_id IS NOT NULL THEN
    SELECT id INTO v_list_id
    FROM shopping_lists
    WHERE id = p_shopping_list_id
      AND (
        (home_id IS NOT NULL AND home_id = v_home_id)
        OR (home_id IS NULL AND user_email = v_user_email)
      );

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
    UPDATE shopping_list_items
    SET quantity = quantity + 1
    WHERE id = v_existing_item_id;

    v_new_item_id := v_existing_item_id;
  ELSE
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

  UPDATE shopping_lists SET date_modified = now() WHERE id = v_list_id;

  RETURN jsonb_build_object(
    'item_id', v_new_item_id,
    'list_id', v_list_id
  );
END;
$$;

-- create_shopping_list: work without a home
CREATE OR REPLACE FUNCTION public.create_shopping_list(p_name text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_email TEXT;
  v_home_id UUID;
  v_list_id UUID;
  v_is_first_list BOOLEAN;
BEGIN
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  SELECT home_id INTO v_home_id
  FROM users
  WHERE email = v_user_email;

  -- Validate name
  IF p_name IS NULL OR LENGTH(TRIM(p_name)) < 1 THEN
    RAISE EXCEPTION 'invalid-list-name';
  END IF;

  -- Check if this is the first list for the user/home
  IF v_home_id IS NOT NULL THEN
    SELECT NOT EXISTS (
      SELECT 1 FROM shopping_lists WHERE home_id = v_home_id
    ) INTO v_is_first_list;
  ELSE
    SELECT NOT EXISTS (
      SELECT 1 FROM shopping_lists WHERE home_id IS NULL AND user_email = v_user_email
    ) INTO v_is_first_list;
  END IF;

  INSERT INTO shopping_lists (user_email, home_id, name, is_default)
  VALUES (v_user_email, v_home_id, TRIM(p_name), v_is_first_list)
  RETURNING id INTO v_list_id;

  RETURN v_list_id;
END;
$$;

-- clear_checked_items: work without a home
CREATE OR REPLACE FUNCTION public.clear_checked_items(p_shopping_list_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_email TEXT;
  v_home_id UUID;
  v_list_id UUID;
  v_deleted_count INTEGER;
BEGIN
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  SELECT home_id INTO v_home_id
  FROM users
  WHERE email = v_user_email;

  IF p_shopping_list_id IS NOT NULL THEN
    SELECT id INTO v_list_id
    FROM shopping_lists
    WHERE id = p_shopping_list_id
      AND (
        (home_id IS NOT NULL AND home_id = v_home_id)
        OR (home_id IS NULL AND user_email = v_user_email)
      );

    IF v_list_id IS NULL THEN
      RAISE EXCEPTION 'shopping-list-not-found';
    END IF;
  ELSE
    v_list_id := get_or_create_default_shopping_list();
  END IF;

  DELETE FROM shopping_list_items
  WHERE shopping_list_id = v_list_id AND is_checked = true;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  UPDATE shopping_lists SET date_modified = now() WHERE id = v_list_id;

  RETURN jsonb_build_object('deleted_count', v_deleted_count);
END;
$$;

-- delete_shopping_list: work without a home
CREATE OR REPLACE FUNCTION public.delete_shopping_list(p_list_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_email TEXT;
  v_home_id UUID;
  v_list_record RECORD;
  v_list_count INTEGER;
  v_new_default_id UUID;
BEGIN
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  SELECT home_id INTO v_home_id
  FROM users
  WHERE email = v_user_email;

  -- Get the list details and verify ownership
  SELECT id, is_default INTO v_list_record
  FROM shopping_lists
  WHERE id = p_list_id
    AND (
      (home_id IS NOT NULL AND home_id = v_home_id)
      OR (home_id IS NULL AND user_email = v_user_email)
    );

  IF v_list_record.id IS NULL THEN
    RAISE EXCEPTION 'shopping-list-not-found';
  END IF;

  -- Count user's/home's lists
  IF v_home_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_list_count
    FROM shopping_lists WHERE home_id = v_home_id;
  ELSE
    SELECT COUNT(*) INTO v_list_count
    FROM shopping_lists WHERE home_id IS NULL AND user_email = v_user_email;
  END IF;

  -- If deleting the default list and there are other lists, assign a new default
  IF v_list_record.is_default AND v_list_count > 1 THEN
    IF v_home_id IS NOT NULL THEN
      SELECT id INTO v_new_default_id
      FROM shopping_lists
      WHERE home_id = v_home_id AND id != p_list_id
      ORDER BY date_modified DESC LIMIT 1;
    ELSE
      SELECT id INTO v_new_default_id
      FROM shopping_lists
      WHERE home_id IS NULL AND user_email = v_user_email AND id != p_list_id
      ORDER BY date_modified DESC LIMIT 1;
    END IF;

    UPDATE shopping_lists SET is_default = true WHERE id = v_new_default_id;
  END IF;

  DELETE FROM shopping_lists WHERE id = p_list_id;
END;
$$;

-- get_user_shopping_lists: work without a home
CREATE OR REPLACE FUNCTION public.get_user_shopping_lists() RETURNS TABLE(id uuid, name text, is_default boolean, item_count bigint, checked_count bigint, date_published timestamp with time zone, date_modified timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_email TEXT;
  v_home_id UUID;
BEGIN
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  SELECT u.home_id INTO v_home_id
  FROM users u
  WHERE u.email = v_user_email;

  RETURN QUERY
  SELECT
    sl.id,
    sl.name,
    sl.is_default,
    COUNT(sli.id) AS item_count,
    COUNT(sli.id) FILTER (WHERE sli.is_checked) AS checked_count,
    sl.date_published,
    sl.date_modified
  FROM shopping_lists sl
  LEFT JOIN shopping_list_items sli ON sli.shopping_list_id = sl.id
  WHERE (
    (sl.home_id IS NOT NULL AND sl.home_id = v_home_id)
    OR (sl.home_id IS NULL AND sl.user_email = v_user_email)
  )
  GROUP BY sl.id
  ORDER BY sl.is_default DESC, sl.date_modified DESC;
END;
$$;

-- rename_shopping_list: work without a home
CREATE OR REPLACE FUNCTION public.rename_shopping_list(p_list_id uuid, p_name text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_email TEXT;
  v_home_id UUID;
  v_list_exists BOOLEAN;
BEGIN
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  SELECT home_id INTO v_home_id
  FROM users
  WHERE email = v_user_email;

  IF p_name IS NULL OR LENGTH(TRIM(p_name)) < 1 THEN
    RAISE EXCEPTION 'invalid-list-name';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM shopping_lists
    WHERE id = p_list_id
      AND (
        (home_id IS NOT NULL AND home_id = v_home_id)
        OR (home_id IS NULL AND user_email = v_user_email)
      )
  ) INTO v_list_exists;

  IF NOT v_list_exists THEN
    RAISE EXCEPTION 'shopping-list-not-found';
  END IF;

  UPDATE shopping_lists
  SET name = TRIM(p_name)
  WHERE id = p_list_id;
END;
$$;

-- set_default_shopping_list: work without a home
CREATE OR REPLACE FUNCTION public.set_default_shopping_list(p_list_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_email TEXT;
  v_home_id UUID;
  v_list_exists BOOLEAN;
BEGIN
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  SELECT home_id INTO v_home_id
  FROM users
  WHERE email = v_user_email;

  SELECT EXISTS (
    SELECT 1 FROM shopping_lists
    WHERE id = p_list_id
      AND (
        (home_id IS NOT NULL AND home_id = v_home_id)
        OR (home_id IS NULL AND user_email = v_user_email)
      )
  ) INTO v_list_exists;

  IF NOT v_list_exists THEN
    RAISE EXCEPTION 'shopping-list-not-found';
  END IF;

  -- Remove default from all other lists in the same scope
  IF v_home_id IS NOT NULL THEN
    UPDATE shopping_lists SET is_default = false
    WHERE home_id = v_home_id AND is_default = true;
  ELSE
    UPDATE shopping_lists SET is_default = false
    WHERE home_id IS NULL AND user_email = v_user_email AND is_default = true;
  END IF;

  UPDATE shopping_lists SET is_default = true WHERE id = p_list_id;
END;
$$;

-- toggle_shopping_list_item: work without a home
CREATE OR REPLACE FUNCTION public.toggle_shopping_list_item(p_item_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_email TEXT;
  v_home_id UUID;
  v_is_checked BOOLEAN;
  v_list_id UUID;
  v_food_id UUID;
  v_quantity DECIMAL;
  v_unit TEXT;
BEGIN
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  SELECT home_id INTO v_home_id
  FROM users
  WHERE email = v_user_email;

  -- Get current state and verify ownership
  SELECT is_checked, shopping_list_id, food_id, quantity, display_unit
  INTO v_is_checked, v_list_id, v_food_id, v_quantity, v_unit
  FROM shopping_list_items
  WHERE id = p_item_id
    AND (
      (home_id IS NOT NULL AND home_id = v_home_id)
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

  -- If checking the item and it has a food_id and user has a home, add to pantry
  IF NOT v_is_checked AND v_food_id IS NOT NULL AND v_home_id IS NOT NULL THEN
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
$$;

-- Fix home-joining functions: handle shopping list migration conflicts
-- When migrating personal lists to a home, delete those that would conflict on (home_id, name)

CREATE OR REPLACE FUNCTION public.create_home(p_name text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_email TEXT;
  v_existing_home_id UUID;
  v_home_id UUID;
BEGIN
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  SELECT home_id INTO v_existing_home_id
  FROM users
  WHERE email = v_user_email;

  IF v_existing_home_id IS NOT NULL THEN
    RAISE EXCEPTION 'user-already-has-home';
  END IF;

  IF p_name IS NULL OR LENGTH(TRIM(p_name)) < 1 THEN
    RAISE EXCEPTION 'invalid-home-name';
  END IF;

  INSERT INTO homes (name, created_by_email)
  VALUES (TRIM(p_name), v_user_email)
  RETURNING id INTO v_home_id;

  UPDATE users SET home_id = v_home_id, home_joined_at = NOW() WHERE email = v_user_email;

  UPDATE user_pantry SET home_id = v_home_id WHERE user_email = v_user_email AND home_id IS NULL;

  DELETE FROM shopping_lists
  WHERE user_email = v_user_email AND home_id IS NULL
    AND name IN (SELECT name FROM shopping_lists WHERE home_id = v_home_id);

  UPDATE shopping_lists SET home_id = v_home_id WHERE user_email = v_user_email AND home_id IS NULL;
  UPDATE shopping_list_items SET home_id = v_home_id WHERE user_email = v_user_email AND home_id IS NULL;

  RETURN v_home_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.join_home_by_code(p_code text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_email TEXT;
  v_existing_home_id UUID;
  v_home_id UUID;
  v_home_record RECORD;
BEGIN
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  SELECT home_id INTO v_existing_home_id
  FROM users
  WHERE email = v_user_email;

  IF v_existing_home_id IS NOT NULL THEN
    RAISE EXCEPTION 'user-already-has-home';
  END IF;

  SELECT id, join_code_expires_at INTO v_home_record
  FROM homes
  WHERE join_code = UPPER(TRIM(p_code));

  IF v_home_record.id IS NULL THEN
    RAISE EXCEPTION 'invalid-join-code';
  END IF;

  IF v_home_record.join_code_expires_at IS NOT NULL AND v_home_record.join_code_expires_at < now() THEN
    RAISE EXCEPTION 'join-code-expired';
  END IF;

  v_home_id := v_home_record.id;

  UPDATE users SET home_id = v_home_id, home_joined_at = NOW() WHERE email = v_user_email;

  UPDATE user_pantry SET home_id = v_home_id WHERE user_email = v_user_email AND home_id IS NULL;

  DELETE FROM shopping_lists
  WHERE user_email = v_user_email AND home_id IS NULL
    AND name IN (SELECT name FROM shopping_lists WHERE home_id = v_home_id);

  UPDATE shopping_lists SET home_id = v_home_id WHERE user_email = v_user_email AND home_id IS NULL;
  UPDATE shopping_list_items SET home_id = v_home_id WHERE user_email = v_user_email AND home_id IS NULL;

  RETURN v_home_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_invitation(p_token text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_email TEXT;
  v_existing_home_id UUID;
  v_invitation RECORD;
  v_home_id UUID;
BEGIN
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  SELECT home_id INTO v_existing_home_id
  FROM users
  WHERE email = v_user_email;

  IF v_existing_home_id IS NOT NULL THEN
    RAISE EXCEPTION 'user-already-has-home';
  END IF;

  SELECT * INTO v_invitation
  FROM home_invitations
  WHERE token = p_token
    AND status = 'pending';

  IF v_invitation.id IS NULL THEN
    RAISE EXCEPTION 'invalid-invitation-token';
  END IF;

  IF v_invitation.expires_at < now() THEN
    UPDATE home_invitations SET status = 'expired', responded_at = now() WHERE id = v_invitation.id;
    RAISE EXCEPTION 'invitation-expired';
  END IF;

  IF LOWER(v_invitation.invited_email) != LOWER(v_user_email) THEN
    RAISE EXCEPTION 'invitation-not-for-user';
  END IF;

  v_home_id := v_invitation.home_id;

  UPDATE home_invitations
  SET status = 'accepted', responded_at = now()
  WHERE id = v_invitation.id;

  UPDATE users SET home_id = v_home_id, home_joined_at = NOW() WHERE email = v_user_email;

  UPDATE user_pantry SET home_id = v_home_id WHERE user_email = v_user_email AND home_id IS NULL;

  DELETE FROM shopping_lists
  WHERE user_email = v_user_email AND home_id IS NULL
    AND name IN (SELECT name FROM shopping_lists WHERE home_id = v_home_id);

  UPDATE shopping_lists SET home_id = v_home_id WHERE user_email = v_user_email AND home_id IS NULL;
  UPDATE shopping_list_items SET home_id = v_home_id WHERE user_email = v_user_email AND home_id IS NULL;

  RETURN v_home_id;
END;
$$;
