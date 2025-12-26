-- V16: Fix password reset RLS policy
-- The recept role needs to read from users table for SECURITY DEFINER functions
-- like request_password_reset that check if a user exists without JWT context

-- Add RLS policy for recept role to SELECT from users
CREATE POLICY users_policy_service_select
    ON users
    FOR SELECT
    TO recept
    USING (true);

COMMENT ON POLICY users_policy_service_select ON users IS
    'Allows the recept role (used by SECURITY DEFINER functions) to read users for authentication operations like password reset.';
