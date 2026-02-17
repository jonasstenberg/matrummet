-- Add p_owner_ids parameter to search_recipes so search can filter by member UUIDs
-- (used by the member-filter badges on the search page)

DROP FUNCTION IF EXISTS public.search_recipes(text, boolean, text, integer, integer);

CREATE OR REPLACE FUNCTION public.search_recipes(
  p_query text,
  p_owner_only boolean DEFAULT false,
  p_category text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_owner_ids uuid[] DEFAULT NULL
) RETURNS SETOF public.user_recipes
    LANGUAGE sql STABLE
    SET search_path TO 'public', 'extensions'
    AS $$
  SELECT ur.* FROM user_recipes ur JOIN recipes r ON r.id = ur.id
  WHERE COALESCE(trim(p_query), '') != '' AND r.search_text ILIKE '%' || escape_like_pattern(p_query) || '%'
    AND (NOT p_owner_only OR ur.is_owner = TRUE)
    AND (p_owner_ids IS NULL OR ur.owner_id = ANY(p_owner_ids))
    AND (p_category IS NULL OR p_category = ANY(ur.categories))
  ORDER BY CASE WHEN ur.name ILIKE escape_like_pattern(p_query) THEN 0 WHEN ur.name ILIKE escape_like_pattern(p_query) || '%' THEN 1 WHEN ur.name ILIKE '%' || escape_like_pattern(p_query) || '%' THEN 2 ELSE 3 END, word_similarity(p_query, ur.name) DESC, ur.date_published DESC
  LIMIT p_limit OFFSET p_offset;
$$;

GRANT ALL ON FUNCTION public.search_recipes(text, boolean, text, integer, integer, uuid[]) TO authenticated;
