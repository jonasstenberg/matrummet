-- V62__search_recipes_fts_and_own_collections.sql
--
-- Two fixes to search_recipes (CREATE OR REPLACE preserves grants):
--
-- 1. Real full-text search. The old WHERE matched the WHOLE query string as a
--    literal substring (r.search_text ILIKE '%' || query || '%'), so an agent's
--    boolean query like 'ceviche OR aguachile' was matched literally and returned
--    nothing. We now also match a websearch_to_tsquery (which supports OR / multi
--    term / quoted phrases / negation), OR'd with the original substring ILIKE so
--    compound words (e.g. "Kokosceviche") still match. The tsvector is computed
--    from search_text on the fly because the stored recipes.tsv column is not
--    populated for imported recipes.
--
-- 2. Include the searcher's OWN curated collections. The curated-collection
--    exclusion previously hid ALL curated-collection recipes from search; it now
--    only hides curated recipes in collections owned by SOMEONE ELSE, so a user's
--    own curated library (e.g. "Recetas Mexas") is searchable by its owner. Uses
--    IS DISTINCT FROM so a missing JWT email keeps the original (exclude) behaviour.

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
        AND col.owner IS DISTINCT FROM (current_setting('request.jwt.claims', true)::jsonb ->> 'email')
    )
  ORDER BY CASE WHEN ur.name ILIKE escape_like_pattern(p_query) THEN 0 WHEN ur.name ILIKE escape_like_pattern(p_query) || '%' THEN 1 WHEN ur.name ILIKE '%' || escape_like_pattern(p_query) || '%' THEN 2 ELSE 3 END,
           word_similarity(p_query, ur.name) DESC, ur.date_published DESC
  LIMIT p_limit OFFSET p_offset;
$$;

GRANT EXECUTE ON FUNCTION public.search_recipes(text, boolean, text, integer, integer, uuid[]) TO authenticated;

-- Same full-text fix for search_liked_recipes (no collection change: its view
-- doesn't contain private curated recipes). CREATE OR REPLACE preserves grants.
-- (search_public_recipes / the public_recipes view were removed earlier, so
-- they are intentionally not touched here.)

CREATE OR REPLACE FUNCTION public.search_liked_recipes(
  p_query text, p_category text DEFAULT NULL::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0
) RETURNS SETOF public.liked_recipes
    LANGUAGE sql STABLE SET search_path TO 'public', 'extensions' AS $$
  SELECT lr.* FROM liked_recipes lr JOIN recipes r ON r.id = lr.id
  WHERE COALESCE(trim(p_query), '') != ''
    AND (
      to_tsvector('swedish', COALESCE(r.search_text, '')) @@ websearch_to_tsquery('swedish', p_query)
      OR r.search_text ILIKE '%' || escape_like_pattern(p_query) || '%'
    )
    AND (p_category IS NULL OR p_category = ANY(lr.categories))
  ORDER BY CASE WHEN lr.name ILIKE escape_like_pattern(p_query) THEN 0 WHEN lr.name ILIKE escape_like_pattern(p_query) || '%' THEN 1 WHEN lr.name ILIKE '%' || escape_like_pattern(p_query) || '%' THEN 2 ELSE 3 END,
           word_similarity(p_query, lr.name) DESC, lr.liked_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;
