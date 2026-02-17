--
-- V27: list_meal_plans
-- Lightweight RPC returning plan summaries for the current user/home context.
--

CREATE FUNCTION public.list_meal_plans()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_email TEXT;
  v_home_id UUID;
BEGIN
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  v_home_id := get_current_user_home_id();

  IF v_home_id IS NOT NULL THEN
    RETURN COALESCE((
      SELECT jsonb_agg(row_to_json(t)::jsonb ORDER BY t.week_start DESC)
      FROM (
        SELECT
          mp.id,
          mp.week_start,
          mp.status,
          (SELECT count(*) FROM meal_plan_entries mpe WHERE mpe.meal_plan_id = mp.id)::int AS entry_count
        FROM meal_plans mp
        WHERE mp.home_id = v_home_id
        ORDER BY mp.week_start DESC
      ) t
    ), '[]'::jsonb);
  ELSE
    RETURN COALESCE((
      SELECT jsonb_agg(row_to_json(t)::jsonb ORDER BY t.week_start DESC)
      FROM (
        SELECT
          mp.id,
          mp.week_start,
          mp.status,
          (SELECT count(*) FROM meal_plan_entries mpe WHERE mpe.meal_plan_id = mp.id)::int AS entry_count
        FROM meal_plans mp
        WHERE mp.user_email = v_user_email
          AND mp.home_id IS NULL
        ORDER BY mp.week_start DESC
      ) t
    ), '[]'::jsonb);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_meal_plans() TO authenticated;
