-- V7: Updated policies for foods and units with admin pagination functions
-- INSERT: Logged-in users (used by ingredient editor when adding recipes)
-- UPDATE/DELETE: Admin only (managed via admin UI)
-- Adds server-side pagination functions for admin UI

-- =============================================================================
-- Update Foods Policies - Public INSERT, Admin UPDATE/DELETE
-- =============================================================================

-- Drop existing restrictive policies
DROP POLICY IF EXISTS foods_policy_insert ON foods;
DROP POLICY IF EXISTS foods_policy_update ON foods;
DROP POLICY IF EXISTS foods_policy_delete ON foods;

-- INSERT: Logged-in users can add new foods (used by ingredient editor)
CREATE POLICY foods_policy_insert
  ON foods
  FOR INSERT
  WITH CHECK (current_setting('request.jwt.claims', true)::jsonb->>'email' IS NOT NULL);

-- UPDATE: Admin only
CREATE POLICY foods_policy_update
  ON foods
  FOR UPDATE
  USING (is_admin());

-- DELETE: Admin only
CREATE POLICY foods_policy_delete
  ON foods
  FOR DELETE
  USING (is_admin());

-- =============================================================================
-- Update Units Policies - Public INSERT, Admin UPDATE/DELETE
-- =============================================================================

-- Drop existing restrictive policies
DROP POLICY IF EXISTS units_policy_insert ON units;
DROP POLICY IF EXISTS units_policy_update ON units;
DROP POLICY IF EXISTS units_policy_delete ON units;

-- INSERT: Logged-in users can add new units (used by ingredient editor)
CREATE POLICY units_policy_insert
  ON units
  FOR INSERT
  WITH CHECK (current_setting('request.jwt.claims', true)::jsonb->>'email' IS NOT NULL);

-- UPDATE: Admin only
CREATE POLICY units_policy_update
  ON units
  FOR UPDATE
  USING (is_admin());

-- DELETE: Admin only
CREATE POLICY units_policy_delete
  ON units
  FOR DELETE
  USING (is_admin());

-- =============================================================================
-- Admin List Foods Function with Pagination
-- =============================================================================

CREATE OR REPLACE FUNCTION admin_list_foods(
  p_search TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  date_published TIMESTAMPTZ,
  date_modified TIMESTAMPTZ,
  ingredient_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  -- Check admin permission
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin privileges required';
  END IF;

  -- Return paginated results ordered by relevance
  RETURN QUERY
  SELECT
    f.id,
    f.name,
    f.date_published,
    f.date_modified,
    COUNT(i.id) AS ingredient_count
  FROM foods f
  LEFT JOIN ingredients i ON i.food_id = f.id
  WHERE
    -- Handle NULL/empty search - return all
    p_search IS NULL
    OR trim(p_search) = ''
    -- Full-text search
    OR f.tsv @@ plainto_tsquery('swedish', p_search)
    -- Partial ILIKE match
    OR f.name ILIKE '%' || p_search || '%'
  GROUP BY f.id, f.name, f.date_published, f.date_modified
  ORDER BY
    -- Relevance ranking using ts_rank
    CASE
      WHEN p_search IS NULL OR trim(p_search) = '' THEN 0
      -- Exact match (case-insensitive): highest priority
      WHEN lower(f.name) = lower(trim(p_search)) THEN 1.0
      -- Starts with search term: high priority
      WHEN lower(f.name) LIKE lower(trim(p_search)) || '%' THEN 0.9
      -- Full-text search rank
      ELSE ts_rank(f.tsv, plainto_tsquery('swedish', p_search))
    END DESC,
    f.name
  LIMIT p_limit
  OFFSET p_offset;
END;
$func$;

GRANT EXECUTE ON FUNCTION admin_list_foods(TEXT, INT, INT) TO anon;

-- =============================================================================
-- Admin Count Foods Function
-- =============================================================================

CREATE OR REPLACE FUNCTION admin_count_foods(
  p_search TEXT DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_count BIGINT;
BEGIN
  -- Check admin permission
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin privileges required';
  END IF;

  -- Return total count
  SELECT COUNT(*) INTO v_count
  FROM foods f
  WHERE
    -- Handle NULL/empty search - return all
    p_search IS NULL
    OR trim(p_search) = ''
    -- Full-text search
    OR f.tsv @@ plainto_tsquery('swedish', p_search)
    -- Partial ILIKE match
    OR f.name ILIKE '%' || p_search || '%';

  RETURN v_count;
END;
$func$;

GRANT EXECUTE ON FUNCTION admin_count_foods(TEXT) TO anon;

-- =============================================================================
-- Admin List Units Function with Pagination
-- =============================================================================

CREATE OR REPLACE FUNCTION admin_list_units(
  p_search TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  plural TEXT,
  abbreviation TEXT,
  date_published TIMESTAMPTZ,
  date_modified TIMESTAMPTZ,
  ingredient_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  -- Check admin permission
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin privileges required';
  END IF;

  -- Return paginated results ordered by relevance
  RETURN QUERY
  SELECT
    u.id,
    u.name,
    u.plural,
    u.abbreviation,
    u.date_published,
    u.date_modified,
    COUNT(i.id) AS ingredient_count
  FROM units u
  LEFT JOIN ingredients i ON i.unit_id = u.id
  WHERE
    -- Handle NULL/empty search - return all
    p_search IS NULL
    OR trim(p_search) = ''
    -- Full-text search
    OR u.tsv @@ plainto_tsquery('swedish', p_search)
    -- Partial ILIKE match on any field
    OR u.name ILIKE '%' || p_search || '%'
    OR u.plural ILIKE '%' || p_search || '%'
    OR u.abbreviation ILIKE '%' || p_search || '%'
  GROUP BY u.id, u.name, u.plural, u.abbreviation, u.date_published, u.date_modified
  ORDER BY
    -- Relevance ranking using ts_rank
    CASE
      WHEN p_search IS NULL OR trim(p_search) = '' THEN 0
      -- Exact match on name or abbreviation: highest priority
      WHEN lower(u.name) = lower(trim(p_search)) OR lower(u.abbreviation) = lower(trim(p_search)) THEN 1.0
      -- Starts with search term: high priority
      WHEN lower(u.name) LIKE lower(trim(p_search)) || '%' OR lower(u.abbreviation) LIKE lower(trim(p_search)) || '%' THEN 0.9
      -- Full-text search rank
      ELSE ts_rank(u.tsv, plainto_tsquery('swedish', p_search))
    END DESC,
    u.name
  LIMIT p_limit
  OFFSET p_offset;
END;
$func$;

GRANT EXECUTE ON FUNCTION admin_list_units(TEXT, INT, INT) TO anon;

-- =============================================================================
-- Admin Count Units Function
-- =============================================================================

CREATE OR REPLACE FUNCTION admin_count_units(
  p_search TEXT DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_count BIGINT;
BEGIN
  -- Check admin permission
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin privileges required';
  END IF;

  -- Return total count
  SELECT COUNT(*) INTO v_count
  FROM units u
  WHERE
    -- Handle NULL/empty search - return all
    p_search IS NULL
    OR trim(p_search) = ''
    -- Full-text search
    OR u.tsv @@ plainto_tsquery('swedish', p_search)
    -- Partial ILIKE match on any field
    OR u.name ILIKE '%' || p_search || '%'
    OR u.plural ILIKE '%' || p_search || '%'
    OR u.abbreviation ILIKE '%' || p_search || '%';

  RETURN v_count;
END;
$func$;

GRANT EXECUTE ON FUNCTION admin_count_units(TEXT) TO anon;
