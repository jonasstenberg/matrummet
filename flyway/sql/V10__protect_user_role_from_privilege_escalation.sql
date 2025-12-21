-- V10: Protect user role column from privilege escalation
-- Prevents users from changing their own role to admin using a BEFORE UPDATE trigger
--
-- VULNERABILITY: The current users_policy_update allows users to UPDATE their own
-- record (owner = JWT email), which means they can change ANY column including 'role'.
-- This allows privilege escalation: user -> admin.
--
-- FIX: Use a BEFORE UPDATE trigger that validates role changes and only allows
-- admins to modify the role column.

-- =============================================================================
-- Drop existing UPDATE policy and create simple owner-based policy
-- =============================================================================

DROP POLICY IF EXISTS users_policy_update ON users;

-- Simple UPDATE policy (owner-based only)
-- The trigger below will handle role change validation
CREATE POLICY users_policy_update
  ON users
  FOR UPDATE
  USING (owner = current_setting('request.jwt.claims', true)::jsonb->>'email');

-- =============================================================================
-- Create trigger function to prevent role escalation
-- =============================================================================

CREATE OR REPLACE FUNCTION prevent_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  current_user_email TEXT;
  current_user_role TEXT;
BEGIN
  -- Only check if role column is being changed
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE NOTICE 'Role change detected: % -> %', OLD.role, NEW.role;

    BEGIN
      -- Get current user email from JWT (with error handling)
      current_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';
      RAISE NOTICE 'Current user email from JWT: %', current_user_email;
    EXCEPTION
      WHEN OTHERS THEN
        current_user_email := NULL;
        RAISE NOTICE 'Failed to get JWT email: %', SQLERRM;
    END;

    -- If no JWT email, deny the change (not authenticated)
    IF current_user_email IS NULL THEN
      RAISE EXCEPTION 'permission-denied: not authenticated'
        USING HINT = 'JWT claims not found or invalid',
              ERRCODE = '42501';
    END IF;

    -- Get current user's role from database
    SELECT role INTO current_user_role
    FROM users
    WHERE email = current_user_email;

    RAISE NOTICE 'Current user role: %', current_user_role;

    -- Only admins can change roles
    IF current_user_role IS NULL OR current_user_role != 'admin' THEN
      RAISE EXCEPTION 'permission-denied: only admins can modify user roles (your role: %)', COALESCE(current_user_role, 'NULL')
        USING HINT = 'You must be an admin to change user roles',
              ERRCODE = '42501';
    END IF;

    RAISE NOTICE 'Admin user % is changing role from % to %', current_user_email, OLD.role, NEW.role;
  END IF;

  RETURN NEW;
END;
$func$;

-- =============================================================================
-- Create trigger on users table
-- =============================================================================

DROP TRIGGER IF EXISTS check_role_escalation ON users;

CREATE TRIGGER check_role_escalation
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION prevent_role_escalation();

-- =============================================================================
-- Add comments explaining the security protection
-- =============================================================================

COMMENT ON POLICY users_policy_update ON users IS
'Allows users to update their own records. Role changes are validated by the check_role_escalation trigger.';

COMMENT ON TRIGGER check_role_escalation ON users IS
'Prevents privilege escalation by blocking role modifications unless the current user is an admin. Requires valid JWT claims.';

COMMENT ON FUNCTION prevent_role_escalation() IS
'Trigger function that prevents non-admin users from modifying the role column. Validates JWT claims and checks admin status before allowing role changes.';
