-- Admin recipe listing functions (SECURITY DEFINER, bypasses RLS)

CREATE FUNCTION public.admin_count_recipes(
  p_search text DEFAULT NULL::text,
  p_owner text DEFAULT NULL::text
) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_count BIGINT;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin privileges required';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM recipes r
  WHERE
    (p_owner IS NULL OR r.owner = p_owner)
    AND (
      p_search IS NULL
      OR trim(p_search) = ''
      OR to_tsvector('swedish', r.name || ' ' || COALESCE(r.description, '')) @@ plainto_tsquery('swedish', p_search)
      OR r.name ILIKE '%' || p_search || '%'
    );

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_count_recipes(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_count_recipes(text, text) TO admin;


CREATE FUNCTION public.admin_list_recipes(
  p_search text DEFAULT NULL::text,
  p_owner text DEFAULT NULL::text,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_sort_by text DEFAULT 'date_published',
  p_sort_dir text DEFAULT 'desc'
) RETURNS TABLE(
  id uuid,
  name text,
  description text,
  owner text,
  owner_name text,
  visibility recipe_visibility,
  date_published timestamptz,
  date_modified timestamptz,
  ingredient_count bigint,
  category_names text[]
)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin privileges required';
  END IF;

  RETURN QUERY
  SELECT
    r.id,
    r.name,
    r.description,
    r.owner,
    u.name AS owner_name,
    r.visibility,
    r.date_published,
    r.date_modified,
    COUNT(i.id) AS ingredient_count,
    COALESCE(ARRAY_AGG(DISTINCT c.name) FILTER (WHERE c.name IS NOT NULL), '{}') AS category_names
  FROM recipes r
  LEFT JOIN users u ON u.email = r.owner
  LEFT JOIN ingredients i ON i.recipe_id = r.id
  LEFT JOIN recipe_categories rc ON rc.recipe = r.id
  LEFT JOIN categories c ON c.id = rc.category
  WHERE
    (p_owner IS NULL OR r.owner = p_owner)
    AND (
      p_search IS NULL
      OR trim(p_search) = ''
      OR to_tsvector('swedish', r.name || ' ' || COALESCE(r.description, '')) @@ plainto_tsquery('swedish', p_search)
      OR r.name ILIKE '%' || p_search || '%'
    )
  GROUP BY r.id, r.name, r.description, r.owner, u.name, r.visibility, r.date_published, r.date_modified
  ORDER BY
    CASE WHEN p_sort_dir = 'asc' THEN
      CASE p_sort_by
        WHEN 'name' THEN r.name
        WHEN 'owner' THEN COALESCE(u.name, r.owner)
      END
    END ASC,
    CASE WHEN p_sort_dir = 'desc' THEN
      CASE p_sort_by
        WHEN 'name' THEN r.name
        WHEN 'owner' THEN COALESCE(u.name, r.owner)
      END
    END DESC,
    CASE WHEN p_sort_by = 'date_published' AND p_sort_dir = 'asc' THEN r.date_published END ASC,
    CASE WHEN p_sort_by = 'date_published' AND p_sort_dir = 'desc' THEN r.date_published END DESC,
    CASE WHEN p_sort_by = 'date_modified' AND p_sort_dir = 'asc' THEN r.date_modified END ASC,
    CASE WHEN p_sort_by = 'date_modified' AND p_sort_dir = 'desc' THEN r.date_modified END DESC,
    r.date_published DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_recipes(text, text, integer, integer, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_recipes(text, text, integer, integer, text, text) TO admin;


CREATE FUNCTION public.admin_get_recipe_owner(p_id uuid)
RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_owner text;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin privileges required';
  END IF;

  SELECT r.owner INTO v_owner FROM recipes r WHERE r.id = p_id;
  RETURN v_owner;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_recipe_owner(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_recipe_owner(uuid) TO admin;
