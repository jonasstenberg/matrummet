-- Update admin_list_users to include credit_balance and server-side sorting.
-- Must DROP + CREATE because the return type and params change.

DROP FUNCTION IF EXISTS public.admin_list_users(text, text, integer, integer);
DROP FUNCTION IF EXISTS public.admin_list_users(text, text, integer, integer, text, text);

CREATE FUNCTION public.admin_list_users(
  p_search text DEFAULT NULL::text,
  p_role text DEFAULT NULL::text,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_sort_by text DEFAULT 'name',
  p_sort_dir text DEFAULT 'asc'
) RETURNS TABLE(id uuid, name text, email text, role text, provider text, recipe_count bigint, credit_balance integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin privileges required';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.name,
    u.email,
    u.role,
    u.provider,
    COUNT(r.id) AS recipe_count,
    COALESCE(uc.balance, 0) AS credit_balance
  FROM users u
  LEFT JOIN recipes r ON r.owner = u.email
  LEFT JOIN user_credits uc ON uc.user_email = u.email
  WHERE
    (p_role IS NULL OR u.role = p_role)
    AND (
      p_search IS NULL
      OR trim(p_search) = ''
      OR to_tsvector('swedish', u.name || ' ' || u.email) @@ plainto_tsquery('swedish', p_search)
      OR u.name ILIKE '%' || p_search || '%'
      OR u.email ILIKE '%' || p_search || '%'
    )
  GROUP BY u.id, u.name, u.email, u.role, u.provider, uc.balance
  ORDER BY
    CASE WHEN p_sort_dir = 'asc' THEN
      CASE p_sort_by
        WHEN 'name' THEN u.name
        WHEN 'email' THEN u.email
        WHEN 'role' THEN u.role
        WHEN 'provider' THEN u.provider
      END
    END ASC,
    CASE WHEN p_sort_dir = 'desc' THEN
      CASE p_sort_by
        WHEN 'name' THEN u.name
        WHEN 'email' THEN u.email
        WHEN 'role' THEN u.role
        WHEN 'provider' THEN u.provider
      END
    END DESC,
    CASE WHEN p_sort_by = 'recipe_count' AND p_sort_dir = 'asc' THEN COUNT(r.id) END ASC,
    CASE WHEN p_sort_by = 'recipe_count' AND p_sort_dir = 'desc' THEN COUNT(r.id) END DESC,
    CASE WHEN p_sort_by = 'credit_balance' AND p_sort_dir = 'asc' THEN COALESCE(uc.balance, 0) END ASC,
    CASE WHEN p_sort_by = 'credit_balance' AND p_sort_dir = 'desc' THEN COALESCE(uc.balance, 0) END DESC,
    u.name ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_users(text, text, integer, integer, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_users(text, text, integer, integer, text, text) TO admin;


-- New function: admin_user_stats for summary cards
CREATE OR REPLACE FUNCTION public.admin_user_stats()
RETURNS TABLE(total_users bigint, admin_count bigint, total_credit_balance bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin privileges required';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM users)::bigint AS total_users,
    (SELECT COUNT(*) FROM users WHERE role = 'admin')::bigint AS admin_count,
    (SELECT COALESCE(SUM(balance), 0) FROM user_credits)::bigint AS total_credit_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_user_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_user_stats() TO admin;
