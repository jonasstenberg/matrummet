-- V65__count_search_recipes.sql
--
-- Total-count companion for search_recipes, so the search page can show the real
-- number of matches and paginate. search_recipes returns at most p_limit rows, so
-- the web UI was showing "50 recept hittades" (the page size) for any query with
-- >= 50 matches. This mirrors how count_recipes complements list_recipes.
--
-- The WHERE clause is identical to search_recipes (V64): same FTS match (stored
-- r.tsv OR trigram substring), same owner / owner_ids / category filters, and the
-- same curated-collection visibility rule (V63). SECURITY INVOKER, so recipes RLS
-- applies and the count matches what the caller can actually see.

CREATE OR REPLACE FUNCTION public.count_search_recipes(
  p_query text, p_owner_only boolean DEFAULT false, p_category text DEFAULT NULL,
  p_owner_ids uuid[] DEFAULT NULL
) RETURNS bigint LANGUAGE sql STABLE SET search_path TO 'public', 'extensions' AS $$
  SELECT count(*) FROM recipes r
  WHERE COALESCE(trim(p_query), '') != ''
    AND (
      r.tsv @@ websearch_to_tsquery('swedish', p_query)
      OR r.search_text ILIKE '%' || escape_like_pattern(p_query) || '%'
    )
    AND (NOT p_owner_only OR r.owner = (current_setting('request.jwt.claims', true)::jsonb ->> 'email'))
    AND (p_owner_ids IS NULL OR get_user_id(r.owner) = ANY (p_owner_ids))
    AND (p_category IS NULL OR EXISTS (
          SELECT 1 FROM recipe_categories rc JOIN categories c ON c.id = rc.category
          WHERE rc.recipe = r.id AND c.name = p_category))
    AND NOT EXISTS (
      SELECT 1 FROM collection_recipes cr JOIN collections col ON col.id = cr.collection_id
      WHERE cr.recipe_id = r.id AND col.kind = 'curated'
        AND NOT public.can_access_collection(col.id)
    );
$$;

GRANT EXECUTE ON FUNCTION public.count_search_recipes(text, boolean, text, uuid[]) TO authenticated;
