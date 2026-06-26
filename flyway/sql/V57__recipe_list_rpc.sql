-- V57: Fast recipe listing.
--
-- Browsing a member/collection ran GET /user_recipes?owner_id=in.(...) — but the
-- user_recipes view is heavy (per-recipe LATERALs for ingredients, instructions,
-- matches, pantry, full_tsv) and owner_id is the computed get_user_id(owner), which
-- the planner can't prune or estimate. Result: the full view was materialized for
-- EVERY matching recipe before LIMIT (e.g. 1250 rows → ~6.3 s for a 24-row page).
--
-- list_recipes / count_recipes select the matching recipe ids from the base table
-- FIRST (lightweight: id + date only, RLS-filtered), then hydrate just the page via
-- the view. Same security (SECURITY INVOKER → recipes RLS applies; get_user_id is the
-- same SECURITY DEFINER email->id map the view already uses, so no email is exposed).
-- ~6.3 s -> ~0.27 s.

CREATE INDEX IF NOT EXISTS recipes_owner_date_idx
  ON public.recipes (owner, date_published DESC);

CREATE OR REPLACE FUNCTION public.list_recipes(
  p_owner_only boolean DEFAULT false,
  p_categories text[] DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_owner_ids uuid[] DEFAULT NULL
) RETURNS SETOF public.user_recipes
  LANGUAGE sql
  STABLE
  SET search_path TO 'public'
AS $$
  -- ANY(ARRAY(...)) (not IN (...)) so the page of ids is materialized FIRST and the
  -- heavy view runs only for the page, instead of the planner semi-joining the full view.
  SELECT ur.*
  FROM public.user_recipes ur
  WHERE ur.id = ANY (ARRAY(
    SELECT r.id
    FROM public.recipes r
    WHERE (p_owner_ids IS NULL OR public.get_user_id(r.owner) = ANY (p_owner_ids))
      AND (NOT p_owner_only OR r.owner = (current_setting('request.jwt.claims', true)::jsonb ->> 'email'))
      -- exclude non-owned featured recipes (featured are for the landing page only)
      AND (NOT r.is_featured OR r.owner = (current_setting('request.jwt.claims', true)::jsonb ->> 'email'))
      AND (
        p_categories IS NULL OR array_length(p_categories, 1) IS NULL OR EXISTS (
          SELECT 1
          FROM public.recipe_categories rc
          JOIN public.categories c ON c.id = rc.category
          WHERE rc.recipe = r.id AND c.name = ANY (p_categories)
        )
      )
    ORDER BY r.date_published DESC
    LIMIT GREATEST(p_limit, 0) OFFSET GREATEST(p_offset, 0)
  ))
  ORDER BY ur.date_published DESC;
$$;

CREATE OR REPLACE FUNCTION public.count_recipes(
  p_owner_only boolean DEFAULT false,
  p_categories text[] DEFAULT NULL,
  p_owner_ids uuid[] DEFAULT NULL
) RETURNS bigint
  LANGUAGE sql
  STABLE
  SET search_path TO 'public'
AS $$
  SELECT count(*)
  FROM public.recipes r
  WHERE (p_owner_ids IS NULL OR public.get_user_id(r.owner) = ANY (p_owner_ids))
    AND (NOT p_owner_only OR r.owner = (current_setting('request.jwt.claims', true)::jsonb ->> 'email'))
    AND (NOT r.is_featured OR r.owner = (current_setting('request.jwt.claims', true)::jsonb ->> 'email'))
    AND (
      p_categories IS NULL OR array_length(p_categories, 1) IS NULL OR EXISTS (
        SELECT 1
        FROM public.recipe_categories rc
        JOIN public.categories c ON c.id = rc.category
        WHERE rc.recipe = r.id AND c.name = ANY (p_categories)
      )
    );
$$;

-- Authenticated only (CREATE FUNCTION grants EXECUTE to PUBLIC by default; revoke so
-- these are not exposed to anon — matching search_recipes / insert_recipe).
REVOKE ALL ON FUNCTION public.list_recipes(boolean, text[], integer, integer, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.count_recipes(boolean, text[], uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_recipes(boolean, text[], integer, integer, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_recipes(boolean, text[], uuid[]) TO authenticated;
