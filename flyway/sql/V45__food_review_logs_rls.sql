-- =============================================================================
-- V45: Add RLS policies to food_review_logs table
-- =============================================================================
-- This table is an internal audit log for AI and admin food reviews.
-- It contains admin emails and internal AI reasoning - should be admin-only.
-- =============================================================================

-- Enable RLS on the table
-- Note: We keep SELECT grant to anon (from V36) because PostgREST needs table-level
-- access before RLS policies can be evaluated. RLS will filter rows to admin-only.
ALTER TABLE food_review_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_review_logs FORCE ROW LEVEL SECURITY;

-- =============================================================================
-- Admin-only policies
-- =============================================================================

-- Admins can read all review logs
CREATE POLICY food_review_logs_admin_select ON food_review_logs
  FOR SELECT
  USING (is_admin());

-- No direct INSERT policy - inserts happen via apply_ai_food_review() which is SECURITY DEFINER
-- No UPDATE policy - audit logs should be immutable
-- No DELETE policy - audit logs should never be deleted

-- =============================================================================
-- Service role policies (for AI cron job and backend operations)
-- =============================================================================

-- Service role (recept) can do everything
CREATE POLICY food_review_logs_service_all ON food_review_logs
  FOR ALL
  TO recept
  USING (true)
  WITH CHECK (true);
