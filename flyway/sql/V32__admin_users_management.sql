-- V32: Admin users management functions
-- Provides admin-only functions for listing, updating, and deleting users
-- All functions require admin privileges and use SECURITY DEFINER to bypass RLS

-- =============================================================================
-- Admin List Users Function with Pagination and Search
-- =============================================================================

CREATE OR REPLACE FUNCTION admin_list_users(
  p_search TEXT DEFAULT NULL,
  p_role TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  email TEXT,
  role TEXT,
  provider TEXT,
  recipe_count BIGINT
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

  -- Return paginated results with search and role filtering
  RETURN QUERY
  SELECT
    u.id,
    u.name,
    u.email,
    u.role,
    u.provider,
    COUNT(r.id) AS recipe_count
  FROM users u
  LEFT JOIN recipes r ON r.owner = u.email
  WHERE
    -- Role filter
    (p_role IS NULL OR u.role = p_role)
    AND (
      -- Handle NULL/empty search - return all
      p_search IS NULL
      OR trim(p_search) = ''
      -- Full-text search on name and email
      OR to_tsvector('swedish', u.name || ' ' || u.email) @@ plainto_tsquery('swedish', p_search)
      -- Partial ILIKE match fallback
      OR u.name ILIKE '%' || p_search || '%'
      OR u.email ILIKE '%' || p_search || '%'
    )
  GROUP BY u.id, u.name, u.email, u.role, u.provider
  ORDER BY
    -- Relevance ranking
    CASE
      WHEN p_search IS NULL OR trim(p_search) = '' THEN 0
      -- Exact match on name or email: highest priority
      WHEN lower(u.name) = lower(trim(p_search)) OR lower(u.email) = lower(trim(p_search)) THEN 1.0
      -- Starts with search term: high priority
      WHEN lower(u.name) LIKE lower(trim(p_search)) || '%' OR lower(u.email) LIKE lower(trim(p_search)) || '%' THEN 0.9
      -- Full-text search rank
      ELSE ts_rank(to_tsvector('swedish', u.name || ' ' || u.email), plainto_tsquery('swedish', p_search))
    END DESC,
    u.name
  LIMIT p_limit
  OFFSET p_offset;
END;
$func$;

GRANT EXECUTE ON FUNCTION admin_list_users(TEXT, TEXT, INT, INT) TO anon;
GRANT EXECUTE ON FUNCTION admin_list_users(TEXT, TEXT, INT, INT) TO authenticated;

-- =============================================================================
-- Admin Count Users Function
-- =============================================================================

CREATE OR REPLACE FUNCTION admin_count_users(
  p_search TEXT DEFAULT NULL,
  p_role TEXT DEFAULT NULL
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

  -- Return total count with same filtering logic
  SELECT COUNT(*) INTO v_count
  FROM users u
  WHERE
    -- Role filter
    (p_role IS NULL OR u.role = p_role)
    AND (
      -- Handle NULL/empty search - return all
      p_search IS NULL
      OR trim(p_search) = ''
      -- Full-text search on name and email
      OR to_tsvector('swedish', u.name || ' ' || u.email) @@ plainto_tsquery('swedish', p_search)
      -- Partial ILIKE match fallback
      OR u.name ILIKE '%' || p_search || '%'
      OR u.email ILIKE '%' || p_search || '%'
    );

  RETURN v_count;
END;
$func$;

GRANT EXECUTE ON FUNCTION admin_count_users(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION admin_count_users(TEXT, TEXT) TO authenticated;

-- =============================================================================
-- Admin Update User Function (name only)
-- =============================================================================

CREATE OR REPLACE FUNCTION admin_update_user(
  p_user_id UUID,
  p_name TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  -- Check admin permission
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin privileges required';
  END IF;

  -- Validate name (same rules as signup)
  IF p_name IS NULL OR length(p_name) < 1 OR length(p_name) > 255 THEN
    RAISE EXCEPTION 'invalid-name';
  END IF;

  -- Update the user
  UPDATE users
  SET name = p_name
  WHERE id = p_user_id;

  -- Check if user was found
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user-not-found';
  END IF;
END;
$func$;

GRANT EXECUTE ON FUNCTION admin_update_user(UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION admin_update_user(UUID, TEXT) TO authenticated;

-- =============================================================================
-- Admin Update User Role Function
-- =============================================================================

CREATE OR REPLACE FUNCTION admin_update_user_role(
  p_user_id UUID,
  p_new_role TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_current_email TEXT;
  v_target_email TEXT;
BEGIN
  -- Check admin permission
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin privileges required';
  END IF;

  -- Validate role
  IF p_new_role NOT IN ('user', 'admin') THEN
    RAISE EXCEPTION 'invalid-role: must be user or admin';
  END IF;

  -- Get current admin's email from JWT
  v_current_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  -- Get target user's email
  SELECT email INTO v_target_email
  FROM users
  WHERE id = p_user_id;

  -- Check if user exists
  IF v_target_email IS NULL THEN
    RAISE EXCEPTION 'user-not-found';
  END IF;

  -- Prevent self-demotion
  IF v_current_email = v_target_email AND p_new_role != 'admin' THEN
    RAISE EXCEPTION 'cannot-demote-self: you cannot remove your own admin privileges';
  END IF;

  -- Update the role
  UPDATE users
  SET role = p_new_role
  WHERE id = p_user_id;
END;
$func$;

GRANT EXECUTE ON FUNCTION admin_update_user_role(UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION admin_update_user_role(UUID, TEXT) TO authenticated;

-- =============================================================================
-- Admin Delete User Function
-- =============================================================================

CREATE OR REPLACE FUNCTION admin_delete_user(
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_current_email TEXT;
  v_target_email TEXT;
BEGIN
  -- Check admin permission
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin privileges required';
  END IF;

  -- Get current admin's email from JWT
  v_current_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  -- Get target user's email
  SELECT email INTO v_target_email
  FROM users
  WHERE id = p_user_id;

  -- Check if user exists
  IF v_target_email IS NULL THEN
    RAISE EXCEPTION 'user-not-found';
  END IF;

  -- Prevent self-deletion
  IF v_current_email = v_target_email THEN
    RAISE EXCEPTION 'cannot-delete-self: you cannot delete your own account via admin panel';
  END IF;

  -- Delete the user (will cascade to user_passwords via FK)
  DELETE FROM users
  WHERE id = p_user_id;
END;
$func$;

GRANT EXECUTE ON FUNCTION admin_delete_user(UUID) TO anon;
GRANT EXECUTE ON FUNCTION admin_delete_user(UUID) TO authenticated;

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON FUNCTION admin_list_users(TEXT, TEXT, INT, INT) IS
'Lists users with pagination and search. Requires admin privileges. Uses tsvector for Swedish full-text search on name and email.';

COMMENT ON FUNCTION admin_count_users(TEXT, TEXT) IS
'Counts users matching search and role filters. Requires admin privileges.';

COMMENT ON FUNCTION admin_update_user(UUID, TEXT) IS
'Updates a user name. Requires admin privileges. Name must be 1-255 characters.';

COMMENT ON FUNCTION admin_update_user_role(UUID, TEXT) IS
'Changes a user role to user or admin. Requires admin privileges. Prevents self-demotion.';

COMMENT ON FUNCTION admin_delete_user(UUID) IS
'Deletes a user and all associated data. Requires admin privileges. Prevents self-deletion.';

CREATE POLICY users_policy_service_update
  ON users
  FOR UPDATE
  TO recept
  USING (true)
  WITH CHECK (true);

COMMENT ON POLICY users_policy_service_update ON users IS
'Allows the recept service role to update any user record. Used by admin_update_user and admin_update_user_role functions.';
