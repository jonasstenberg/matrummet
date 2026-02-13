-- Fix: search_units doesn't match short queries like "d" → "dl".
-- pg_trgm similarity needs 3-char sequences, so 1-2 char queries score
-- near zero against short abbreviations. Add prefix matching on name
-- and abbreviation (unit names are ASCII, so ILIKE is fine here).

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
      CASE WHEN u.name ILIKE trim(p_query) || '%' THEN 0.9
           WHEN u.abbreviation ILIKE trim(p_query) || '%' THEN 0.85
           ELSE 0.0
      END,
      CASE WHEN u.tsv @@ plainto_tsquery('swedish'::regconfig, p_query)
           THEN ts_rank(u.tsv, plainto_tsquery('swedish'::regconfig, p_query))
           ELSE 0.0
      END
    )::REAL AS rank
  FROM units u
  WHERE extensions.similarity(u.name, trim(p_query)) > 0.3
     OR extensions.similarity(coalesce(u.abbreviation, ''), trim(p_query)) > 0.3
     OR u.name ILIKE trim(p_query) || '%'
     OR u.abbreviation ILIKE trim(p_query) || '%'
     OR u.tsv @@ plainto_tsquery('swedish'::regconfig, p_query)
  ORDER BY
    GREATEST(
      extensions.similarity(u.name, trim(p_query)),
      extensions.similarity(coalesce(u.abbreviation, ''), trim(p_query)),
      CASE WHEN u.name ILIKE trim(p_query) || '%' THEN 0.9
           WHEN u.abbreviation ILIKE trim(p_query) || '%' THEN 0.85
           ELSE 0.0
      END
    ) DESC,
    u.name
  LIMIT p_limit;
$$;
