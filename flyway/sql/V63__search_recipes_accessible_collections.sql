-- V63__search_recipes_accessible_collections.sql
--
-- Make collection (samlingar) recipes findable via search.
--
-- V62 un-hid only the searcher's OWN curated collections from search
-- (col.owner IS DISTINCT FROM jwt email). But a recipe in a curated collection
-- that is SHARED with the user — or one the user is admin of — was still excluded
-- from search results, even though row-level security already lets them SEE the
-- recipe (recipes_collection_select -> has_collection_access). So searching for a
-- recipe that lives only in a shared/curated collection (e.g. "Refritos" in the
-- "Recetas Mexas" collection) returned nothing for everyone except the owner.
--
-- This generalises the owner-only check to a full access check: a curated recipe is
-- hidden from search ONLY when it sits in a curated collection the searcher CANNOT
-- access. can_access_collection() (SECURITY DEFINER: owner OR is_admin() OR a share
-- connection) is the same gate used by the recipes_collection_select RLS policy, so
-- search visibility now matches row visibility.
--
-- list_recipes / count_recipes intentionally KEEP the full curated exclusion: a
-- 1250-recipe curated library should not flood the main browse grid. Only explicit
-- search surfaces its recipes. CREATE OR REPLACE preserves the existing GRANT.

CREATE OR REPLACE FUNCTION public.search_recipes(
  p_query text, p_owner_only boolean DEFAULT false, p_category text DEFAULT NULL,
  p_limit integer DEFAULT 50, p_offset integer DEFAULT 0, p_owner_ids uuid[] DEFAULT NULL
) RETURNS SETOF public.user_recipes LANGUAGE sql STABLE SET search_path TO 'public', 'extensions' AS $$
  SELECT ur.* FROM user_recipes ur JOIN recipes r ON r.id = ur.id
  WHERE COALESCE(trim(p_query), '') != ''
    AND (
      to_tsvector('swedish', COALESCE(r.search_text, '')) @@ websearch_to_tsquery('swedish', p_query)
      OR r.search_text ILIKE '%' || escape_like_pattern(p_query) || '%'
    )
    AND (NOT p_owner_only OR ur.is_owner = TRUE)
    AND (p_owner_ids IS NULL OR ur.owner_id = ANY(p_owner_ids))
    AND (p_category IS NULL OR p_category = ANY(ur.categories))
    AND NOT EXISTS (
      SELECT 1 FROM collection_recipes cr JOIN collections col ON col.id = cr.collection_id
      WHERE cr.recipe_id = ur.id AND col.kind = 'curated'
        AND NOT public.can_access_collection(col.id)
    )
  ORDER BY CASE WHEN ur.name ILIKE escape_like_pattern(p_query) THEN 0 WHEN ur.name ILIKE escape_like_pattern(p_query) || '%' THEN 1 WHEN ur.name ILIKE '%' || escape_like_pattern(p_query) || '%' THEN 2 ELSE 3 END,
           word_similarity(p_query, ur.name) DESC, ur.date_published DESC
  LIMIT p_limit OFFSET p_offset;
$$;

GRANT EXECUTE ON FUNCTION public.search_recipes(text, boolean, text, integer, integer, uuid[]) TO authenticated;
