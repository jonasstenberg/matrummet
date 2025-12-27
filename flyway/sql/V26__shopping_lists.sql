-- V26: Shopping Lists and User API Keys
-- Implements shopping lists for recipe ingredients with source tracking
-- Also adds API key authentication for external integrations (e.g., Home Assistant)

-- =============================================================================
-- Create Authenticated Role
-- =============================================================================
-- PostgREST switches to "authenticated" when a valid JWT with role="authenticated" is present.
-- Functions that REQUIRE authentication are granted to "authenticated" role only.
-- This prevents unauthenticated users from even calling these RPCs.

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE "authenticated";
    END IF;
END
$$;

-- Grant roles to recept (the PostgREST connection user)
-- PostgREST needs to be able to switch to both anon and authenticated roles
GRANT "anon" TO "recept";
GRANT "authenticated" TO "recept";

-- Make authenticated inherit all permissions from anon
-- This ensures logged-in users can do everything anonymous users can, plus more
GRANT "anon" TO "authenticated";

-- =============================================================================
-- User API Keys Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT REFERENCES users(email) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL CHECK (LENGTH(name) >= 1 AND LENGTH(name) <= 255),
  api_key_hash TEXT NOT NULL,
  api_key_prefix TEXT NOT NULL CHECK (LENGTH(api_key_prefix) = 8),
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true NOT NULL,
  date_published TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  UNIQUE(user_email, name)
);

CREATE INDEX user_api_keys_user_email_idx ON user_api_keys (user_email);
CREATE INDEX user_api_keys_is_active_idx ON user_api_keys (is_active) WHERE is_active = true;

GRANT SELECT, INSERT, DELETE ON user_api_keys TO "authenticated";

ALTER TABLE user_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_api_keys FORCE ROW LEVEL SECURITY;

-- Users can only see their own API keys
CREATE POLICY user_api_keys_policy_select
  ON user_api_keys
  FOR SELECT
  USING (user_email = current_setting('request.jwt.claims', true)::jsonb->>'email');

-- Users can only create keys for themselves
CREATE POLICY user_api_keys_policy_insert
  ON user_api_keys
  FOR INSERT
  WITH CHECK (user_email = current_setting('request.jwt.claims', true)::jsonb->>'email');

-- Users can only delete their own keys
CREATE POLICY user_api_keys_policy_delete
  ON user_api_keys
  FOR DELETE
  USING (user_email = current_setting('request.jwt.claims', true)::jsonb->>'email');

-- =============================================================================
-- Shopping Lists Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS shopping_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT REFERENCES users(email) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL DEFAULT 'Inköpslista' CHECK (LENGTH(name) >= 1 AND LENGTH(name) <= 255),
  is_default BOOLEAN DEFAULT false NOT NULL,
  date_published TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  date_modified TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  UNIQUE(user_email, name)
);

CREATE INDEX shopping_lists_user_email_idx ON shopping_lists (user_email);
CREATE INDEX shopping_lists_is_default_idx ON shopping_lists (user_email, is_default) WHERE is_default = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON shopping_lists TO "authenticated";

DROP TRIGGER IF EXISTS set_timestamptz ON shopping_lists;
CREATE TRIGGER set_timestamptz
    BEFORE UPDATE ON shopping_lists
    FOR EACH ROW
    EXECUTE FUNCTION set_timestamptz();

ALTER TABLE shopping_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_lists FORCE ROW LEVEL SECURITY;

-- Users can only see their own shopping lists
CREATE POLICY shopping_lists_policy_select
  ON shopping_lists
  FOR SELECT
  USING (user_email = current_setting('request.jwt.claims', true)::jsonb->>'email');

CREATE POLICY shopping_lists_policy_insert
  ON shopping_lists
  FOR INSERT
  WITH CHECK (user_email = current_setting('request.jwt.claims', true)::jsonb->>'email');

CREATE POLICY shopping_lists_policy_update
  ON shopping_lists
  FOR UPDATE
  USING (user_email = current_setting('request.jwt.claims', true)::jsonb->>'email');

CREATE POLICY shopping_lists_policy_delete
  ON shopping_lists
  FOR DELETE
  USING (user_email = current_setting('request.jwt.claims', true)::jsonb->>'email');

-- =============================================================================
-- Shopping List Items Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS shopping_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shopping_list_id UUID REFERENCES shopping_lists(id) ON DELETE CASCADE NOT NULL,
  food_id UUID REFERENCES foods(id) ON DELETE SET NULL,
  unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL CHECK (LENGTH(display_name) >= 1),
  display_unit TEXT NOT NULL DEFAULT '',
  quantity NUMERIC NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  is_checked BOOLEAN DEFAULT false NOT NULL,
  checked_at TIMESTAMPTZ,
  sort_order INTEGER DEFAULT 0 NOT NULL,
  user_email TEXT NOT NULL,
  date_published TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX shopping_list_items_shopping_list_id_idx ON shopping_list_items (shopping_list_id);
CREATE INDEX shopping_list_items_user_email_idx ON shopping_list_items (user_email);
CREATE INDEX shopping_list_items_food_id_idx ON shopping_list_items (food_id) WHERE food_id IS NOT NULL;
CREATE INDEX shopping_list_items_unit_id_idx ON shopping_list_items (unit_id) WHERE unit_id IS NOT NULL;
CREATE INDEX shopping_list_items_is_checked_idx ON shopping_list_items (shopping_list_id, is_checked);
-- Index for aggregation queries - matching items by food_id and unit_id
CREATE INDEX shopping_list_items_aggregation_idx ON shopping_list_items (shopping_list_id, food_id, unit_id, is_checked)
  WHERE food_id IS NOT NULL AND is_checked = false;

GRANT SELECT, INSERT, UPDATE, DELETE ON shopping_list_items TO "authenticated";

ALTER TABLE shopping_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_list_items FORCE ROW LEVEL SECURITY;

-- Users can only see their own items
CREATE POLICY shopping_list_items_policy_select
  ON shopping_list_items
  FOR SELECT
  USING (user_email = current_setting('request.jwt.claims', true)::jsonb->>'email');

CREATE POLICY shopping_list_items_policy_insert
  ON shopping_list_items
  FOR INSERT
  WITH CHECK (user_email = current_setting('request.jwt.claims', true)::jsonb->>'email');

CREATE POLICY shopping_list_items_policy_update
  ON shopping_list_items
  FOR UPDATE
  USING (user_email = current_setting('request.jwt.claims', true)::jsonb->>'email');

CREATE POLICY shopping_list_items_policy_delete
  ON shopping_list_items
  FOR DELETE
  USING (user_email = current_setting('request.jwt.claims', true)::jsonb->>'email');

-- =============================================================================
-- Shopping List Item Sources Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS shopping_list_item_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shopping_list_item_id UUID REFERENCES shopping_list_items(id) ON DELETE CASCADE NOT NULL,
  recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL,
  recipe_name TEXT NOT NULL CHECK (LENGTH(recipe_name) >= 1),
  quantity_added NUMERIC NOT NULL CHECK (quantity_added > 0),
  servings_used INTEGER,
  user_email TEXT NOT NULL,
  date_published TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX shopping_list_item_sources_item_id_idx ON shopping_list_item_sources (shopping_list_item_id);
CREATE INDEX shopping_list_item_sources_recipe_id_idx ON shopping_list_item_sources (recipe_id) WHERE recipe_id IS NOT NULL;
CREATE INDEX shopping_list_item_sources_user_email_idx ON shopping_list_item_sources (user_email);

GRANT SELECT, INSERT, DELETE ON shopping_list_item_sources TO "authenticated";

ALTER TABLE shopping_list_item_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_list_item_sources FORCE ROW LEVEL SECURITY;

-- Users can only see their own sources
CREATE POLICY shopping_list_item_sources_policy_select
  ON shopping_list_item_sources
  FOR SELECT
  USING (user_email = current_setting('request.jwt.claims', true)::jsonb->>'email');

CREATE POLICY shopping_list_item_sources_policy_insert
  ON shopping_list_item_sources
  FOR INSERT
  WITH CHECK (user_email = current_setting('request.jwt.claims', true)::jsonb->>'email');

CREATE POLICY shopping_list_item_sources_policy_delete
  ON shopping_list_item_sources
  FOR DELETE
  USING (user_email = current_setting('request.jwt.claims', true)::jsonb->>'email');

-- =============================================================================
-- Shopping List View
-- =============================================================================

CREATE OR REPLACE VIEW shopping_list_view AS
SELECT
  sli.id,
  sli.shopping_list_id,
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
  array_agg(DISTINCT slis.recipe_name) FILTER (WHERE slis.recipe_name IS NOT NULL) AS source_recipes
FROM shopping_list_items sli
JOIN shopping_lists sl ON sl.id = sli.shopping_list_id
LEFT JOIN foods f ON sli.food_id = f.id
LEFT JOIN units u ON sli.unit_id = u.id
LEFT JOIN shopping_list_item_sources slis ON slis.shopping_list_item_id = sli.id
WHERE sli.user_email = current_setting('request.jwt.claims', true)::jsonb->>'email'
GROUP BY sli.id, f.name, u.abbreviation, u.name, sl.name;

GRANT SELECT ON shopping_list_view TO "authenticated";

-- =============================================================================
-- Get or Create Default Shopping List Function
-- =============================================================================

CREATE OR REPLACE FUNCTION get_or_create_default_shopping_list()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user_email TEXT;
  v_list_id UUID;
BEGIN
  -- Get current user email from JWT
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  -- Try to find existing default list
  SELECT id INTO v_list_id
  FROM shopping_lists
  WHERE user_email = v_user_email AND is_default = true;

  IF v_list_id IS NOT NULL THEN
    RETURN v_list_id;
  END IF;

  -- No default list exists, create one
  INSERT INTO shopping_lists (user_email, name, is_default)
  VALUES (v_user_email, 'Inköpslista', true)
  ON CONFLICT (user_email, name) DO UPDATE SET is_default = true
  RETURNING id INTO v_list_id;

  RETURN v_list_id;
END;
$func$;

GRANT EXECUTE ON FUNCTION get_or_create_default_shopping_list() TO "authenticated";

-- =============================================================================
-- Add Recipe to Shopping List Function
-- =============================================================================

CREATE OR REPLACE FUNCTION add_recipe_to_shopping_list(
  p_recipe_id UUID,
  p_shopping_list_id UUID DEFAULT NULL,
  p_servings INTEGER DEFAULT NULL,
  p_ingredient_ids UUID[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user_email TEXT;
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
BEGIN
  -- Get current user email from JWT
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  -- Get recipe details
  SELECT name, recipe_yield INTO v_recipe_name, v_recipe_yield
  FROM recipes
  WHERE id = p_recipe_id;

  IF v_recipe_name IS NULL THEN
    RAISE EXCEPTION 'recipe-not-found';
  END IF;

  -- Get or create shopping list
  IF p_shopping_list_id IS NOT NULL THEN
    -- Verify the list exists and belongs to the user
    SELECT id INTO v_list_id
    FROM shopping_lists
    WHERE id = p_shopping_list_id AND user_email = v_user_email;

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
    -- Parse quantity (handle text values like "1/2", "1-2", etc.)
    BEGIN
      v_ingredient_quantity := v_ingredient.quantity::NUMERIC;
    EXCEPTION WHEN OTHERS THEN
      -- If quantity can't be parsed, default to 1
      v_ingredient_quantity := 1;
    END;

    v_scaled_quantity := v_ingredient_quantity * v_scale_factor;

    -- Check for existing unchecked item with same food_id AND unit_id
    IF v_ingredient.food_id IS NOT NULL THEN
      SELECT id INTO v_existing_item_id
      FROM shopping_list_items
      WHERE shopping_list_id = v_list_id
        AND food_id = v_ingredient.food_id
        AND unit_id IS NOT DISTINCT FROM v_ingredient.unit_id
        AND is_checked = false;
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
        v_ingredient.food_id,
        v_ingredient.unit_id,
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
$func$;

GRANT EXECUTE ON FUNCTION add_recipe_to_shopping_list(UUID, UUID, INTEGER, UUID[]) TO "authenticated";

-- =============================================================================
-- Toggle Shopping List Item Function
-- =============================================================================

CREATE OR REPLACE FUNCTION toggle_shopping_list_item(p_item_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user_email TEXT;
  v_is_checked BOOLEAN;
  v_list_id UUID;
BEGIN
  -- Get current user email from JWT
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  -- Get current state and verify ownership
  SELECT is_checked, shopping_list_id INTO v_is_checked, v_list_id
  FROM shopping_list_items
  WHERE id = p_item_id AND user_email = v_user_email;

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

  RETURN jsonb_build_object('is_checked', NOT v_is_checked);
END;
$func$;

GRANT EXECUTE ON FUNCTION toggle_shopping_list_item(UUID) TO "authenticated";

-- =============================================================================
-- Clear Checked Items Function
-- =============================================================================

CREATE OR REPLACE FUNCTION clear_checked_items(p_shopping_list_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user_email TEXT;
  v_list_id UUID;
  v_deleted_count INTEGER;
BEGIN
  -- Get current user email from JWT
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  -- Get or default to default shopping list
  IF p_shopping_list_id IS NOT NULL THEN
    -- Verify the list exists and belongs to the user
    SELECT id INTO v_list_id
    FROM shopping_lists
    WHERE id = p_shopping_list_id AND user_email = v_user_email;

    IF v_list_id IS NULL THEN
      RAISE EXCEPTION 'shopping-list-not-found';
    END IF;
  ELSE
    v_list_id := get_or_create_default_shopping_list();
  END IF;

  -- Delete checked items (sources will cascade delete)
  DELETE FROM shopping_list_items
  WHERE shopping_list_id = v_list_id AND is_checked = true;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  -- Update shopping list modified timestamp
  UPDATE shopping_lists SET date_modified = now() WHERE id = v_list_id;

  RETURN jsonb_build_object('deleted_count', v_deleted_count);
END;
$func$;

GRANT EXECUTE ON FUNCTION clear_checked_items(UUID) TO "authenticated";

-- =============================================================================
-- Create User API Key Function
-- =============================================================================

CREATE OR REPLACE FUNCTION create_user_api_key(p_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user_email TEXT;
  v_api_key TEXT;
  v_api_key_prefix TEXT;
  v_api_key_hash TEXT;
  v_key_id UUID;
BEGIN
  -- Get current user email from JWT
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  -- Validate name
  IF p_name IS NULL OR LENGTH(TRIM(p_name)) < 1 THEN
    RAISE EXCEPTION 'invalid-key-name';
  END IF;

  -- Check for duplicate name
  IF EXISTS (SELECT 1 FROM user_api_keys WHERE user_email = v_user_email AND name = TRIM(p_name)) THEN
    RAISE EXCEPTION 'key-name-already-exists';
  END IF;

  -- Generate a random API key (sk_ prefix + 32 random hex characters)
  v_api_key := 'sk_' || encode(gen_random_bytes(16), 'hex');
  v_api_key_prefix := LEFT(v_api_key, 8);
  v_api_key_hash := crypt(v_api_key, gen_salt('bf'));

  -- Insert the key
  INSERT INTO user_api_keys (user_email, name, api_key_hash, api_key_prefix)
  VALUES (v_user_email, TRIM(p_name), v_api_key_hash, v_api_key_prefix)
  RETURNING id INTO v_key_id;

  -- Return the plaintext key (only time it's visible)
  RETURN jsonb_build_object(
    'id', v_key_id,
    'name', TRIM(p_name),
    'api_key', v_api_key,
    'api_key_prefix', v_api_key_prefix
  );
END;
$func$;

GRANT EXECUTE ON FUNCTION create_user_api_key(TEXT) TO "authenticated";

-- =============================================================================
-- Validate API Key Function
-- =============================================================================

CREATE OR REPLACE FUNCTION validate_api_key(p_api_key TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_key_record RECORD;
  v_user_email TEXT;
BEGIN
  -- Validate input
  IF p_api_key IS NULL OR LENGTH(p_api_key) < 8 THEN
    RETURN NULL;
  END IF;

  -- Find matching key by prefix first (optimization)
  FOR v_key_record IN
    SELECT id, user_email, api_key_hash, expires_at, is_active
    FROM user_api_keys
    WHERE api_key_prefix = LEFT(p_api_key, 8) AND is_active = true
  LOOP
    -- Verify full key hash
    IF v_key_record.api_key_hash = crypt(p_api_key, v_key_record.api_key_hash) THEN
      -- Check expiration
      IF v_key_record.expires_at IS NOT NULL AND v_key_record.expires_at < now() THEN
        -- Key has expired, deactivate it
        UPDATE user_api_keys SET is_active = false WHERE id = v_key_record.id;
        RETURN NULL;
      END IF;

      -- Valid key - update last_used_at
      UPDATE user_api_keys SET last_used_at = now() WHERE id = v_key_record.id;

      RETURN v_key_record.user_email;
    END IF;
  END LOOP;

  -- No matching key found
  RETURN NULL;
END;
$func$;

-- NOTE: validate_api_key stays with anon - it's called BEFORE authentication
-- to validate API keys for external integrations (e.g., Home Assistant).
-- The API key validation IS the authentication mechanism itself.
GRANT EXECUTE ON FUNCTION validate_api_key(TEXT) TO "anon";

-- =============================================================================
-- Revoke API Key Function
-- =============================================================================

CREATE OR REPLACE FUNCTION revoke_api_key(p_key_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user_email TEXT;
  v_key_exists BOOLEAN;
BEGIN
  -- Get current user email from JWT
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  -- Check if key exists and belongs to user
  SELECT EXISTS (
    SELECT 1 FROM user_api_keys
    WHERE id = p_key_id AND user_email = v_user_email
  ) INTO v_key_exists;

  IF NOT v_key_exists THEN
    RAISE EXCEPTION 'key-not-found';
  END IF;

  -- Revoke the key
  UPDATE user_api_keys
  SET is_active = false
  WHERE id = p_key_id AND user_email = v_user_email;

  RETURN jsonb_build_object('revoked', true);
END;
$func$;

GRANT EXECUTE ON FUNCTION revoke_api_key(UUID) TO "authenticated";

-- =============================================================================
-- Get User API Keys Function
-- =============================================================================

CREATE OR REPLACE FUNCTION get_user_api_keys()
RETURNS TABLE (
  id UUID,
  name TEXT,
  api_key_prefix TEXT,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN,
  date_published TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user_email TEXT;
BEGIN
  -- Get current user email from JWT
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  RETURN QUERY
  SELECT
    uak.id,
    uak.name,
    uak.api_key_prefix,
    uak.last_used_at,
    uak.expires_at,
    uak.is_active,
    uak.date_published
  FROM user_api_keys uak
  WHERE uak.user_email = v_user_email
  ORDER BY uak.date_published DESC;
END;
$func$;

GRANT EXECUTE ON FUNCTION get_user_api_keys() TO "authenticated";

-- =============================================================================
-- Get User Shopping Lists Function
-- =============================================================================

CREATE OR REPLACE FUNCTION get_user_shopping_lists()
RETURNS TABLE (
  id UUID,
  name TEXT,
  is_default BOOLEAN,
  item_count BIGINT,
  checked_count BIGINT,
  date_published TIMESTAMPTZ,
  date_modified TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
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
  WHERE sl.user_email = current_setting('request.jwt.claims', true)::jsonb->>'email'
  GROUP BY sl.id
  ORDER BY sl.is_default DESC, sl.date_modified DESC;
END;
$func$;

GRANT EXECUTE ON FUNCTION get_user_shopping_lists() TO "authenticated";

-- =============================================================================
-- Create Shopping List Function
-- =============================================================================

CREATE OR REPLACE FUNCTION create_shopping_list(p_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user_email TEXT;
  v_list_id UUID;
  v_is_first_list BOOLEAN;
BEGIN
  -- Get current user email from JWT
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  -- Validate name
  IF p_name IS NULL OR LENGTH(TRIM(p_name)) < 1 THEN
    RAISE EXCEPTION 'invalid-list-name';
  END IF;

  -- Check if this is the first list for the user
  SELECT NOT EXISTS (
    SELECT 1 FROM shopping_lists WHERE user_email = v_user_email
  ) INTO v_is_first_list;

  -- Insert the new list
  INSERT INTO shopping_lists (user_email, name, is_default)
  VALUES (v_user_email, TRIM(p_name), v_is_first_list)
  RETURNING id INTO v_list_id;

  RETURN v_list_id;
END;
$func$;

GRANT EXECUTE ON FUNCTION create_shopping_list(TEXT) TO "authenticated";

-- =============================================================================
-- Rename Shopping List Function
-- =============================================================================

CREATE OR REPLACE FUNCTION rename_shopping_list(p_list_id UUID, p_name TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user_email TEXT;
  v_list_exists BOOLEAN;
BEGIN
  -- Get current user email from JWT
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  -- Validate name
  IF p_name IS NULL OR LENGTH(TRIM(p_name)) < 1 THEN
    RAISE EXCEPTION 'invalid-list-name';
  END IF;

  -- Check if list exists and belongs to user
  SELECT EXISTS (
    SELECT 1 FROM shopping_lists
    WHERE id = p_list_id AND user_email = v_user_email
  ) INTO v_list_exists;

  IF NOT v_list_exists THEN
    RAISE EXCEPTION 'shopping-list-not-found';
  END IF;

  -- Update the list name
  UPDATE shopping_lists
  SET name = TRIM(p_name)
  WHERE id = p_list_id AND user_email = v_user_email;
END;
$func$;

GRANT EXECUTE ON FUNCTION rename_shopping_list(UUID, TEXT) TO "authenticated";

-- =============================================================================
-- Delete Shopping List Function
-- =============================================================================

CREATE OR REPLACE FUNCTION delete_shopping_list(p_list_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user_email TEXT;
  v_list_record RECORD;
  v_list_count INTEGER;
  v_new_default_id UUID;
BEGIN
  -- Get current user email from JWT
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  -- Get the list details
  SELECT id, is_default INTO v_list_record
  FROM shopping_lists
  WHERE id = p_list_id AND user_email = v_user_email;

  IF v_list_record.id IS NULL THEN
    RAISE EXCEPTION 'shopping-list-not-found';
  END IF;

  -- Count user's lists
  SELECT COUNT(*) INTO v_list_count
  FROM shopping_lists
  WHERE user_email = v_user_email;

  -- If deleting the default list and there are other lists, assign a new default
  IF v_list_record.is_default AND v_list_count > 1 THEN
    -- Find another list to make default (most recently modified)
    SELECT id INTO v_new_default_id
    FROM shopping_lists
    WHERE user_email = v_user_email AND id != p_list_id
    ORDER BY date_modified DESC
    LIMIT 1;

    UPDATE shopping_lists
    SET is_default = true
    WHERE id = v_new_default_id;
  END IF;

  -- Delete the list (items will cascade delete)
  DELETE FROM shopping_lists
  WHERE id = p_list_id AND user_email = v_user_email;
END;
$func$;

GRANT EXECUTE ON FUNCTION delete_shopping_list(UUID) TO "authenticated";

-- =============================================================================
-- Set Default Shopping List Function
-- =============================================================================

CREATE OR REPLACE FUNCTION set_default_shopping_list(p_list_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user_email TEXT;
  v_list_exists BOOLEAN;
BEGIN
  -- Get current user email from JWT
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  -- Check if list exists and belongs to user
  SELECT EXISTS (
    SELECT 1 FROM shopping_lists
    WHERE id = p_list_id AND user_email = v_user_email
  ) INTO v_list_exists;

  IF NOT v_list_exists THEN
    RAISE EXCEPTION 'shopping-list-not-found';
  END IF;

  -- Remove default from all other lists
  UPDATE shopping_lists
  SET is_default = false
  WHERE user_email = v_user_email AND is_default = true;

  -- Set the new default
  UPDATE shopping_lists
  SET is_default = true
  WHERE id = p_list_id AND user_email = v_user_email;
END;
$func$;

GRANT EXECUTE ON FUNCTION set_default_shopping_list(UUID) TO "authenticated";
