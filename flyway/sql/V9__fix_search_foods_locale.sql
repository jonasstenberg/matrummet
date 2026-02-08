-- Fix search_foods and search_units for non-ASCII case folding.
-- Database locale is C, so ILIKE and lower() don't handle Ä/ä, Å/å, Ö/ö.
-- Replace ILIKE with pg_trgm similarity which handles this correctly.
-- Use word_similarity() to handle queries with extra text like
-- "citron (finrivet skal)" matching "Citron".
-- The foods_name_trgm_idx GIN index already exists.

CREATE OR REPLACE FUNCTION public.search_foods(p_query text, p_limit integer DEFAULT 10)
RETURNS TABLE(id uuid, name text, rank real, status public.food_status, is_own_pending boolean, canonical_food_id uuid, canonical_food_name text)
LANGUAGE plpgsql STABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_query TEXT;
  v_tsquery tsquery;
  v_user_email TEXT;
BEGIN
  IF p_query IS NULL OR trim(p_query) = '' THEN
    RETURN;
  END IF;

  v_query := left(trim(p_query), 200);
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
      extensions.similarity(f.name, v_query),
      -- word_similarity finds the best matching substring, so
      -- "citron (finrivet skal)" still matches "Citron" at ~1.0
      extensions.word_similarity(f.name, v_query),
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
      extensions.similarity(f.name, v_query) > 0.3
      OR extensions.word_similarity(f.name, v_query) > 0.8
      OR (v_tsquery IS NOT NULL AND v_tsquery <> ''::tsquery AND f.tsv @@ v_tsquery)
    )
  ORDER BY
    CASE WHEN f.status = 'approved' THEN 0 ELSE 1 END,
    GREATEST(
      extensions.similarity(f.name, v_query),
      extensions.word_similarity(f.name, v_query)
    ) DESC,
    f.name
  LIMIT p_limit;
END;
$$;

-- search_units has the same ILIKE/lower() locale issue.
-- Unit names are mostly ASCII but fix for consistency.
CREATE OR REPLACE FUNCTION public.search_units(p_query text, p_limit integer DEFAULT 10)
RETURNS TABLE(id uuid, name text, plural text, abbreviation text, rank real)
LANGUAGE sql STABLE
AS $$
  SELECT
    u.id,
    u.name,
    u.plural,
    u.abbreviation,
    GREATEST(
      extensions.similarity(u.name, trim(p_query)),
      extensions.similarity(coalesce(u.abbreviation, ''), trim(p_query)),
      CASE WHEN u.tsv @@ plainto_tsquery('swedish'::regconfig, p_query)
           THEN ts_rank(u.tsv, plainto_tsquery('swedish'::regconfig, p_query))
           ELSE 0.0
      END
    )::REAL AS rank
  FROM units u
  WHERE extensions.similarity(u.name, trim(p_query)) > 0.3
     OR extensions.similarity(coalesce(u.abbreviation, ''), trim(p_query)) > 0.3
     OR u.tsv @@ plainto_tsquery('swedish'::regconfig, p_query)
  ORDER BY
    GREATEST(
      extensions.similarity(u.name, trim(p_query)),
      extensions.similarity(coalesce(u.abbreviation, ''), trim(p_query))
    ) DESC,
    u.name
  LIMIT p_limit;
$$;
