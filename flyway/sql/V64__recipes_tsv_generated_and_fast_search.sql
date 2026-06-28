-- V64__recipes_tsv_generated_and_fast_search.sql
--
-- Recipe search performance: store the FTS vector + hydrate the heavy view for the
-- result page only. Two changes, both transparent to callers (same args, same rows).
--
-- Background. search_recipes matched `to_tsvector('swedish', search_text) @@ ...`
-- computed ON THE FLY for every recipe (a full seq scan, ~110ms over ~1400 rows),
-- then selected `ur.* FROM user_recipes ur JOIN recipes r ...`, which forced the
-- planner to build the heavy user_recipes view (6 LATERAL aggregations per row) for
-- the WHOLE table before LIMIT — ~240ms and ~1.6GB of buffer traffic for a broad
-- term like "kyckling". On the real dataset this drops to ~16ms after both fixes.
--
-- Fix 1 — stored, generated tsv. recipes.tsv already existed but was a plain column
-- populated for only a handful of rows and ignored by search. Convert it to a
-- GENERATED STORED column derived from search_text — the SAME pattern foods.tsv and
-- units.tsv already use. Postgres recomputes it automatically whenever the row's
-- search_text changes (search_text is itself kept current by the existing
-- recipe_search_text / ingredient / category triggers), so it can never drift and
-- needs no hand-written trigger or one-off backfill. Adding the column backfills all
-- existing rows. Search now matches r.tsv via the existing GIN index recipes_tsv_idx.
--
-- Fix 2 — limit-first hydration. Adopt the pattern list_recipes already uses: pick
-- the matching, ranked, limited recipe ids from the base table first, then hydrate
-- user_recipes for just those <= p_limit ids instead of the whole table.
--
-- Note: ALTER TABLE ... ADD COLUMN ... GENERATED rewrites recipes (brief ACCESS
-- EXCLUSIVE lock); fast at this table size. CREATE OR REPLACE preserves grants.

-- ---------------------------------------------------------------------------------
-- Fix 1: recipes.tsv as a generated column (a plain column can't be converted in
-- place, so drop + re-add; only recipes_tsv_idx depends on it).
-- ---------------------------------------------------------------------------------
DROP INDEX IF EXISTS public.recipes_tsv_idx;
ALTER TABLE public.recipes DROP COLUMN tsv;
ALTER TABLE public.recipes ADD COLUMN tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('swedish', coalesce(search_text, ''))) STORED;
CREATE INDEX recipes_tsv_idx ON public.recipes USING gin (tsv);

-- ---------------------------------------------------------------------------------
-- Fix 2: fast search_recipes — limit-first id selection + page-only view hydration.
-- Matches r.tsv (indexed) for FTS, OR'd with the trigram-indexed substring ILIKE so
-- Swedish compounds (e.g. "Kokosceviche" ~ "ceviche") still match. The collection
-- visibility rule is unchanged from V63 (curated recipes the caller cannot access
-- are excluded). Same ranking is applied to the page ids and to the hydrated rows.
-- ---------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_recipes(
  p_query text, p_owner_only boolean DEFAULT false, p_category text DEFAULT NULL,
  p_limit integer DEFAULT 50, p_offset integer DEFAULT 0, p_owner_ids uuid[] DEFAULT NULL
) RETURNS SETOF public.user_recipes LANGUAGE sql STABLE SET search_path TO 'public', 'extensions' AS $$
  SELECT ur.* FROM user_recipes ur
  WHERE ur.id = ANY (ARRAY(
    SELECT r.id FROM recipes r
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
      )
    ORDER BY CASE WHEN r.name ILIKE escape_like_pattern(p_query) THEN 0 WHEN r.name ILIKE escape_like_pattern(p_query) || '%' THEN 1 WHEN r.name ILIKE '%' || escape_like_pattern(p_query) || '%' THEN 2 ELSE 3 END,
             word_similarity(p_query, r.name) DESC, r.date_published DESC
    LIMIT GREATEST(p_limit, 0) OFFSET GREATEST(p_offset, 0)
  ))
  ORDER BY CASE WHEN ur.name ILIKE escape_like_pattern(p_query) THEN 0 WHEN ur.name ILIKE escape_like_pattern(p_query) || '%' THEN 1 WHEN ur.name ILIKE '%' || escape_like_pattern(p_query) || '%' THEN 2 ELSE 3 END,
           word_similarity(p_query, ur.name) DESC, ur.date_published DESC;
$$;

GRANT EXECUTE ON FUNCTION public.search_recipes(text, boolean, text, integer, integer, uuid[]) TO authenticated;

-- ---------------------------------------------------------------------------------
-- search_liked_recipes: use the stored tsv too (per-user liked set is small, so it
-- keeps the simpler view-join shape; only the FTS predicate changes).
-- ---------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_liked_recipes(
  p_query text, p_category text DEFAULT NULL::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0
) RETURNS SETOF public.liked_recipes
    LANGUAGE sql STABLE SET search_path TO 'public', 'extensions' AS $$
  SELECT lr.* FROM liked_recipes lr JOIN recipes r ON r.id = lr.id
  WHERE COALESCE(trim(p_query), '') != ''
    AND (
      r.tsv @@ websearch_to_tsquery('swedish', p_query)
      OR r.search_text ILIKE '%' || escape_like_pattern(p_query) || '%'
    )
    AND (p_category IS NULL OR p_category = ANY(lr.categories))
  ORDER BY CASE WHEN lr.name ILIKE escape_like_pattern(p_query) THEN 0 WHEN lr.name ILIKE escape_like_pattern(p_query) || '%' THEN 1 WHEN lr.name ILIKE '%' || escape_like_pattern(p_query) || '%' THEN 2 ELSE 3 END,
           word_similarity(p_query, lr.name) DESC, lr.liked_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;

GRANT EXECUTE ON FUNCTION public.search_liked_recipes(text, text, integer, integer) TO authenticated;
