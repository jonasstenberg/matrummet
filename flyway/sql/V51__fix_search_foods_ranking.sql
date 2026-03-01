-- Fix search_foods ranking: word_similarity argument order and prefix matching.
--
-- Problem: word_similarity(f.name, v_query) asks "is the food name found as a
-- word in the query?" — short names like "Ägg" trivially score 1.0 against any
-- query (e.g. "lägg"), causing false positives at rank 1.0.
--
-- Fix 1: Use BOTH word_similarity directions with guards:
--   - word_similarity(v_query, f.name): "is the query found as a word in the
--     food name?" Matches "citron" → "citron (finrivet skal)".
--   - word_similarity(f.name, v_query): "is the food name found as a word in
--     the query?" Matches "citron (finrivet skal)" → "Citron". Only for food
--     names >= 4 chars to avoid "lägg" → "Ägg" false positives.
--   - For short food names (< 4 chars), use a word-boundary regex instead:
--     "ägg" matches in "ägg (stora)" but NOT in "lägg".
--
-- Fix 2: Add prefix matching as the highest-priority tier. Foods whose name
-- starts with the query (Swedish case-insensitive) get rank 2.0, ensuring exact
-- prefix matches always appear above fuzzy results.

CREATE OR REPLACE FUNCTION public.search_foods(p_query text, p_limit integer DEFAULT 10)
RETURNS TABLE(id uuid, name text, rank real, status public.food_status, is_own_pending boolean, canonical_food_id uuid, canonical_food_name text)
LANGUAGE plpgsql STABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_query TEXT;
  v_lower_query TEXT;
  v_tsquery tsquery;
  v_user_email TEXT;
  v_swedish_upper CONSTANT TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZÄÅÖ';
  v_swedish_lower CONSTANT TEXT := 'abcdefghijklmnopqrstuvwxyzäåö';
BEGIN
  IF p_query IS NULL OR trim(p_query) = '' THEN
    RETURN;
  END IF;

  v_query := left(trim(p_query), 200);
  -- Manual Swedish case folding (database locale is C, so lower() doesn't
  -- handle Ä/Å/Ö). translate() maps each character in the second arg to the
  -- corresponding character in the third arg.
  v_lower_query := translate(v_query, v_swedish_upper, v_swedish_lower);
  v_user_email := coalesce(current_setting('request.jwt.claims', true)::jsonb->>'email', '');

  BEGIN
    v_tsquery := plainto_tsquery('swedish'::regconfig, v_query);
  EXCEPTION WHEN OTHERS THEN
    v_tsquery := NULL;
  END;

  RETURN QUERY
  SELECT
    f.id,
    f.name,
    GREATEST(
      -- Prefix match gets highest score
      CASE WHEN translate(f.name, v_swedish_upper, v_swedish_lower) LIKE v_lower_query || '%'
           THEN 2.0
           ELSE 0.0
      END,
      extensions.similarity(f.name, v_query),
      -- Query found as a word in the food name
      -- e.g., "citron" found in "citron (finrivet skal)"
      extensions.word_similarity(v_query, f.name),
      -- Food name found as a word in the query:
      -- For longer names (>= 4 chars), use word_similarity directly.
      -- For short names (< 4 chars like "Ägg"), use word-boundary regex to
      -- avoid false positives (e.g., "ägg" in "lägg" is NOT a word boundary
      -- match, but "ägg" in "ägg (stora)" IS).
      CASE WHEN length(f.name) >= 4
           THEN extensions.word_similarity(f.name, v_query)
           WHEN v_lower_query ~ ('(^|[^a-zäåö])' ||
             regexp_replace(translate(f.name, v_swedish_upper, v_swedish_lower), '([.+*?^$()[\]{}|\\])', '\\\1', 'g') ||
             '([^a-zäåö]|$)')
           THEN 1.0
           ELSE 0.0
      END,
      CASE WHEN v_tsquery IS NOT NULL AND v_tsquery <> ''::tsquery AND f.tsv @@ v_tsquery
           THEN ts_rank(f.tsv, v_tsquery)
           ELSE 0.0
      END
    )::REAL AS rank,
    f.status,
    (f.status = 'pending' AND f.created_by = v_user_email) AS is_own_pending,
    f.canonical_food_id,
    cf.name AS canonical_food_name
  FROM foods f
  LEFT JOIN foods cf ON cf.id = f.canonical_food_id
  WHERE (
      f.status = 'approved'
      OR (f.status = 'pending' AND f.created_by = v_user_email)
    )
    AND (
      -- Prefix match (Swedish case-insensitive)
      translate(f.name, v_swedish_upper, v_swedish_lower) LIKE v_lower_query || '%'
      OR extensions.similarity(f.name, v_query) > 0.3
      -- Query found as word in food name
      OR extensions.word_similarity(v_query, f.name) > 0.8
      -- Food name found as word in query (length-guarded + word-boundary for short names)
      OR (length(f.name) >= 4 AND extensions.word_similarity(f.name, v_query) > 0.8)
      OR (length(f.name) < 4 AND v_lower_query ~ ('(^|[^a-zäåö])' ||
          regexp_replace(translate(f.name, v_swedish_upper, v_swedish_lower), '([.+*?^$()[\]{}|\\])', '\\\1', 'g') ||
          '([^a-zäåö]|$)'))
      OR (v_tsquery IS NOT NULL AND v_tsquery <> ''::tsquery AND f.tsv @@ v_tsquery)
    )
  ORDER BY
    CASE WHEN f.status = 'approved' THEN 0 ELSE 1 END,
    -- Prefix matches first
    CASE WHEN translate(f.name, v_swedish_upper, v_swedish_lower) LIKE v_lower_query || '%'
         THEN 0
         ELSE 1
    END,
    GREATEST(
      extensions.similarity(f.name, v_query),
      extensions.word_similarity(v_query, f.name),
      CASE WHEN length(f.name) >= 4
           THEN extensions.word_similarity(f.name, v_query)
           WHEN v_lower_query ~ ('(^|[^a-zäåö])' ||
             regexp_replace(translate(f.name, v_swedish_upper, v_swedish_lower), '([.+*?^$()[\]{}|\\])', '\\\1', 'g') ||
             '([^a-zäåö]|$)')
           THEN 1.0
           ELSE 0.0
      END
    ) DESC,
    f.name
  LIMIT p_limit;
END;
$$;
