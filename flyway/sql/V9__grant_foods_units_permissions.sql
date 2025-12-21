-- V9: Grant table-level permissions to foods and units tables
-- Fixes permission denied error when admin users try to modify foods/units
-- RLS policies already control actual access, but table-level grants are needed

-- =============================================================================
-- Grant All Permissions on Foods Table
-- =============================================================================

-- Grant full permissions to anon role (RLS policies control actual access)
GRANT ALL ON "foods" TO "anon";

-- =============================================================================
-- Grant All Permissions on Units Table
-- =============================================================================

-- Grant full permissions to anon role (RLS policies control actual access)
GRANT ALL ON "units" TO "anon";
