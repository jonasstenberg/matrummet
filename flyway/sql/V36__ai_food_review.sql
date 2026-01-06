-- V36: AI Food Review Feature
-- Adds AI review tracking columns to foods table
-- Creates audit log table for review history
-- Adds database functions for the cron job

-- =============================================================================
-- Add needs_review to food_status enum
-- =============================================================================

ALTER TYPE food_status ADD VALUE IF NOT EXISTS 'needs_review';

-- =============================================================================
-- Add AI Review Columns to Foods Table
-- =============================================================================

ALTER TABLE foods
  ADD COLUMN ai_reviewed_at TIMESTAMPTZ,
  ADD COLUMN ai_decision food_status,
  ADD COLUMN ai_reasoning TEXT,
  ADD COLUMN ai_confidence REAL,
  ADD COLUMN ai_suggested_merge_id UUID REFERENCES foods(id);

-- Index for finding foods that need AI review
CREATE INDEX foods_ai_reviewed_at_idx ON foods (ai_reviewed_at)
  WHERE ai_reviewed_at IS NULL;

-- =============================================================================
-- Create Food Review Audit Log Table
-- =============================================================================

CREATE TABLE food_review_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  food_id UUID NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  decision food_status NOT NULL,
  reasoning TEXT,
  confidence REAL,
  suggested_merge_id UUID REFERENCES foods(id),
  reviewer_type TEXT NOT NULL CHECK (reviewer_type IN ('ai', 'admin')),
  reviewer_email TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX food_review_logs_food_id_idx ON food_review_logs(food_id);
CREATE INDEX food_review_logs_created_at_idx ON food_review_logs(created_at);

-- Grant permissions
GRANT SELECT ON food_review_logs TO anon;

-- =============================================================================
-- Helper: Check if current user is admin or system cron
-- =============================================================================

CREATE OR REPLACE FUNCTION is_admin_or_system()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  current_email TEXT;
  user_role TEXT;
BEGIN
  -- Get the email from JWT claims
  current_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

  -- Allow system cron user
  IF current_email = 'system@cron.local' THEN
    RETURN TRUE;
  END IF;

  -- Check if user is admin
  SELECT u.role INTO user_role
  FROM users u
  WHERE u.email = current_email;

  RETURN user_role = 'admin';
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$func$;

GRANT EXECUTE ON FUNCTION is_admin_or_system() TO anon;

-- =============================================================================
-- Function: Get Pending Foods for AI Review
-- =============================================================================

CREATE OR REPLACE FUNCTION get_pending_foods_for_review(p_limit INT DEFAULT 50)
RETURNS TABLE (
  id UUID,
  name TEXT,
  created_by TEXT,
  date_published TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  -- Check authorization
  IF NOT is_admin_or_system() THEN
    RAISE EXCEPTION 'Access denied: admin or system privileges required';
  END IF;

  RETURN QUERY
  SELECT f.id, f.name, f.created_by, f.date_published
  FROM foods f
  WHERE f.status = 'pending'
    AND f.ai_reviewed_at IS NULL
  ORDER BY f.date_published ASC
  LIMIT p_limit;
END;
$func$;

GRANT EXECUTE ON FUNCTION get_pending_foods_for_review(INT) TO anon;

-- =============================================================================
-- Function: Get Orphaned Ingredient Names
-- =============================================================================

CREATE OR REPLACE FUNCTION get_orphaned_ingredient_names(p_limit INT DEFAULT 100)
RETURNS TABLE (
  ingredient_name TEXT,
  ingredient_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  -- Check authorization
  IF NOT is_admin_or_system() THEN
    RAISE EXCEPTION 'Access denied: admin or system privileges required';
  END IF;

  RETURN QUERY
  SELECT name, COUNT(*) AS ingredient_count
  FROM ingredients
  WHERE food_id IS NULL
    AND name IS NOT NULL
    AND trim(name) != ''
  GROUP BY name
  ORDER BY COUNT(*) DESC
  LIMIT p_limit;
END;
$func$;

GRANT EXECUTE ON FUNCTION get_orphaned_ingredient_names(INT) TO anon;

-- =============================================================================
-- Function: Link Orphaned Ingredients to Food
-- =============================================================================

CREATE OR REPLACE FUNCTION link_ingredients_to_food(
  p_ingredient_name TEXT,
  p_food_id UUID
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $func$
DECLARE
  v_updated INT;
BEGIN
  -- Check authorization
  IF NOT is_admin_or_system() THEN
    RAISE EXCEPTION 'Access denied: admin or system privileges required';
  END IF;

  UPDATE ingredients
  SET food_id = p_food_id
  WHERE food_id IS NULL
    AND lower(trim(name)) = lower(trim(p_ingredient_name));

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$func$;

GRANT EXECUTE ON FUNCTION link_ingredients_to_food(TEXT, UUID) TO anon;

-- =============================================================================
-- Function: Apply AI Food Review Decision
-- =============================================================================

CREATE OR REPLACE FUNCTION apply_ai_food_review(
  p_food_id UUID,
  p_decision food_status,
  p_reasoning TEXT,
  p_confidence REAL,
  p_suggested_merge_id UUID DEFAULT NULL,
  p_reviewer_email TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $func$
DECLARE
  v_should_apply BOOLEAN;
  v_reviewer_email TEXT;
BEGIN
  -- Check authorization
  IF NOT is_admin_or_system() THEN
    RAISE EXCEPTION 'Access denied: admin or system privileges required';
  END IF;

  -- Use provided email or get from JWT
  v_reviewer_email := COALESCE(p_reviewer_email, current_setting('request.jwt.claims', true)::jsonb->>'email');

  v_should_apply := p_confidence >= 0.9 AND p_decision IN ('approved', 'rejected');

  -- Update food with AI decision
  UPDATE foods
  SET
    ai_reviewed_at = now(),
    ai_decision = p_decision,
    ai_reasoning = p_reasoning,
    ai_confidence = p_confidence,
    ai_suggested_merge_id = p_suggested_merge_id,
    -- Auto-apply high-confidence decisions
    status = CASE WHEN v_should_apply THEN p_decision ELSE status END,
    reviewed_at = CASE WHEN v_should_apply THEN now() ELSE reviewed_at END,
    -- Only set reviewed_by if it's a real user (not system cron)
    reviewed_by = CASE
      WHEN v_should_apply AND v_reviewer_email IS NOT NULL AND v_reviewer_email != 'system@cron.local'
      THEN v_reviewer_email
      ELSE reviewed_by
    END
  WHERE id = p_food_id;

  -- If rejecting with merge target and auto-applying, move ingredients to merge target
  IF v_should_apply AND p_decision = 'rejected' AND p_suggested_merge_id IS NOT NULL THEN
    UPDATE ingredients
    SET food_id = p_suggested_merge_id
    WHERE food_id = p_food_id;
  END IF;

  -- Log the review
  INSERT INTO food_review_logs (food_id, decision, reasoning, confidence, suggested_merge_id, reviewer_type)
  VALUES (p_food_id, p_decision, p_reasoning, p_confidence, p_suggested_merge_id, 'ai');
END;
$func$;

GRANT EXECUTE ON FUNCTION apply_ai_food_review(UUID, food_status, TEXT, REAL, UUID, TEXT) TO anon;
