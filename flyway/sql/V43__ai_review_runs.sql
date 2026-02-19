-- V43: AI Review Runs - persist review results and enable manual approval flow
--
-- Changes the AI review from auto-apply to a two-phase flow:
-- 1. AI analyzes pending foods and stores suggestions
-- 2. Admin reviews and approves/rejects individual suggestions
-- 3. Only approved suggestions get applied

-- 1. Run metadata table
CREATE TABLE public.ai_review_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    started_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    run_by text,
    status text NOT NULL DEFAULT 'running'
        CHECK (status IN ('running', 'pending_approval', 'applied', 'partially_applied', 'failed')),
    total_processed int NOT NULL DEFAULT 0,
    summary jsonb NOT NULL DEFAULT '{}'
);

ALTER TABLE public.ai_review_runs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ai_review_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_review_runs_admin_all ON public.ai_review_runs
    USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY ai_review_runs_service_all ON public.ai_review_runs
    TO matrummet USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON TABLE public.ai_review_runs TO admin;

-- 2. Individual suggestion table
CREATE TABLE public.ai_review_suggestions (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    run_id uuid NOT NULL REFERENCES public.ai_review_runs(id) ON DELETE CASCADE,
    food_id uuid NOT NULL REFERENCES public.foods(id) ON DELETE CASCADE,
    food_name text NOT NULL,
    suggested_action text NOT NULL
        CHECK (suggested_action IN ('alias', 'create', 'reject', 'delete')),
    target_food_id uuid REFERENCES public.foods(id),
    target_food_name text,
    extracted_unit text,
    extracted_quantity numeric,
    ai_reasoning text,
    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'applied', 'skipped')),
    reviewed_at timestamptz,
    ingredient_count int NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_review_suggestions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ai_review_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_review_suggestions_admin_all ON public.ai_review_suggestions
    USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY ai_review_suggestions_service_all ON public.ai_review_suggestions
    TO matrummet USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON TABLE public.ai_review_suggestions TO admin;

CREATE INDEX ai_review_suggestions_run_id_idx
    ON public.ai_review_suggestions(run_id);

CREATE INDEX ai_review_suggestions_status_idx
    ON public.ai_review_suggestions(run_id, status);

-- 3. Function to apply a single suggestion with admin's chosen action
-- p_decision: 'approve_alias' | 'approve_new' | 'reject_food' | 'delete_food' | 'skip'
CREATE OR REPLACE FUNCTION public.apply_ai_review_suggestion(
    p_suggestion_id uuid,
    p_decision text
) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    SET row_security TO 'off'
AS $$
DECLARE
    v_suggestion RECORD;
    v_reviewer TEXT;
BEGIN
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Access denied: admin privileges required';
    END IF;

    IF p_decision NOT IN ('approve_alias', 'approve_new', 'reject_food', 'delete_food', 'skip') THEN
        RAISE EXCEPTION 'Invalid decision: %', p_decision;
    END IF;

    v_reviewer := current_setting('request.jwt.claims', true)::jsonb->>'email';

    -- Lock and fetch the suggestion
    SELECT * INTO v_suggestion
    FROM ai_review_suggestions
    WHERE id = p_suggestion_id AND status = 'pending'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Suggestion not found or already processed';
    END IF;

    -- Skip: just mark and return
    IF p_decision = 'skip' THEN
        UPDATE ai_review_suggestions
        SET status = 'skipped', reviewed_at = now()
        WHERE id = p_suggestion_id;
        RETURN;
    END IF;

    -- Apply based on admin's chosen decision (may differ from AI suggestion)
    CASE p_decision
        WHEN 'approve_alias' THEN
            IF v_suggestion.target_food_id IS NOT NULL THEN
                IF EXISTS (SELECT 1 FROM foods WHERE id = v_suggestion.food_id) THEN
                    PERFORM approve_food_as_alias(v_suggestion.food_id, v_suggestion.target_food_id);

                    IF v_suggestion.extracted_unit IS NOT NULL OR v_suggestion.extracted_quantity IS NOT NULL THEN
                        UPDATE ingredients
                        SET
                            measurement = COALESCE(v_suggestion.extracted_unit, measurement),
                            quantity = COALESCE(v_suggestion.extracted_quantity::text, quantity)
                        WHERE food_id = v_suggestion.food_id;
                    END IF;

                    UPDATE ingredients
                    SET food_id = v_suggestion.target_food_id
                    WHERE food_id = v_suggestion.food_id;
                END IF;
            ELSE
                RAISE EXCEPTION 'Cannot alias without a target food';
            END IF;

        WHEN 'approve_new' THEN
            IF EXISTS (SELECT 1 FROM foods WHERE id = v_suggestion.food_id AND status = 'pending') THEN
                UPDATE foods
                SET status = 'approved', reviewed_by = v_reviewer, reviewed_at = now()
                WHERE id = v_suggestion.food_id;
            END IF;

        WHEN 'reject_food' THEN
            IF EXISTS (SELECT 1 FROM foods WHERE id = v_suggestion.food_id AND status = 'pending') THEN
                UPDATE foods
                SET status = 'rejected', reviewed_by = v_reviewer, reviewed_at = now()
                WHERE id = v_suggestion.food_id;
            END IF;

        WHEN 'delete_food' THEN
            DELETE FROM foods
            WHERE id = v_suggestion.food_id AND status = 'pending';
    END CASE;

    -- Mark suggestion as applied
    UPDATE ai_review_suggestions
    SET status = 'applied', reviewed_at = now()
    WHERE id = p_suggestion_id;

    -- Log to food_review_logs
    INSERT INTO food_review_logs (food_id, decision, reasoning, confidence, suggested_merge_id, reviewer_type, reviewer_email)
    VALUES (
        v_suggestion.food_id,
        CASE p_decision
            WHEN 'approve_alias' THEN 'approved'::food_status
            WHEN 'approve_new' THEN 'approved'::food_status
            WHEN 'reject_food' THEN 'rejected'::food_status
            WHEN 'delete_food' THEN 'rejected'::food_status
        END,
        v_suggestion.ai_reasoning,
        1.0,
        v_suggestion.target_food_id,
        'admin',
        v_reviewer
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_ai_review_suggestion(uuid, text) TO admin;

-- 4. Function to update run status after processing suggestions
CREATE OR REPLACE FUNCTION public.update_ai_review_run_status(p_run_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    SET row_security TO 'off'
AS $$
DECLARE
    v_pending int;
    v_applied int;
    v_total int;
BEGIN
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Access denied: admin privileges required';
    END IF;

    SELECT
        COUNT(*) FILTER (WHERE status = 'pending'),
        COUNT(*) FILTER (WHERE status = 'applied'),
        COUNT(*)
    INTO v_pending, v_applied, v_total
    FROM ai_review_suggestions
    WHERE run_id = p_run_id;

    UPDATE ai_review_runs
    SET status = CASE
        WHEN v_pending = 0 AND v_applied = v_total THEN 'applied'
        WHEN v_pending = 0 THEN 'partially_applied'
        ELSE status
    END
    WHERE id = p_run_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_ai_review_run_status(uuid) TO admin;
