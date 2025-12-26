-- V20: User Account Deletion
-- Allows users to delete their accounts while preserving recipes with NULL owner

-- =============================================================================
-- ALTER RECIPES TABLE
-- =============================================================================

-- Make the owner column nullable to allow orphaned recipes
ALTER TABLE recipes ALTER COLUMN owner DROP NOT NULL;

-- Drop the existing foreign key constraint
ALTER TABLE recipes DROP CONSTRAINT IF EXISTS recipes_owner_fkey;

-- Re-add the foreign key with ON DELETE SET NULL
-- This preserves recipes when a user is deleted, but sets their owner to NULL
ALTER TABLE recipes
    ADD CONSTRAINT recipes_owner_fkey
    FOREIGN KEY (owner) REFERENCES users(email) ON DELETE SET NULL;

-- =============================================================================
-- UPDATE RLS POLICIES
-- =============================================================================

-- Update the SELECT policy to allow reading recipes with NULL owner
-- (already allows all reads, so no change needed)

-- Update INSERT policy - no change needed (cannot insert with NULL owner)

-- Update UPDATE policy to prevent editing orphaned recipes
DROP POLICY IF EXISTS recipes_policy_update ON recipes;
CREATE POLICY recipes_policy_update
    ON recipes
    FOR UPDATE
    USING (
        owner IS NOT NULL
        AND owner = current_setting('request.jwt.claims', true)::jsonb->>'email'
    );

-- Update DELETE policy to prevent deleting orphaned recipes
DROP POLICY IF EXISTS recipes_policy_delete ON recipes;
CREATE POLICY recipes_policy_delete
    ON recipes
    FOR DELETE
    USING (
        owner IS NOT NULL
        AND owner = current_setting('request.jwt.claims', true)::jsonb->>'email'
    );

-- =============================================================================
-- ACCOUNT DELETION FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION delete_account()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_email TEXT;
    v_user_id UUID;
BEGIN
    -- Get the email from JWT claims
    v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

    -- Validate that we have a valid user email
    IF v_user_email IS NULL OR v_user_email = '' THEN
        RAISE EXCEPTION 'not-authenticated';
    END IF;

    -- Get the user ID to verify user exists
    SELECT id INTO v_user_id
    FROM users
    WHERE email = v_user_email;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'user-not-found';
    END IF;

    -- Delete the user
    -- This will:
    -- 1. Cascade delete from user_passwords (ON DELETE CASCADE)
    -- 2. Cascade delete from user_email_preferences (ON DELETE CASCADE)
    -- 3. Cascade delete from password_reset_tokens (ON DELETE CASCADE)
    -- 4. Set recipes.owner to NULL (ON DELETE SET NULL)
    -- 5. Cascade delete from email_messages.recipient_user_id (ON DELETE SET NULL)
    DELETE FROM users WHERE id = v_user_id;

    RETURN jsonb_build_object('success', true, 'message', 'Account deleted successfully');
END;
$$;

COMMENT ON FUNCTION delete_account() IS
    'Deletes the current user account. Recipes are preserved with NULL owner. '
    'User passwords, email preferences, and password reset tokens are deleted.';

-- Grant execute to anon role (authenticated users via PostgREST)
GRANT EXECUTE ON FUNCTION delete_account() TO "anon";

-- Set the owner to the migration user (superuser) for SECURITY DEFINER to work properly
DO $$
BEGIN
    EXECUTE format('ALTER FUNCTION delete_account() OWNER TO %I', current_user);
END $$;

-- =============================================================================
-- RLS POLICY FOR RECEPT ROLE
-- =============================================================================

-- Allow the recept service role to delete users (for the delete_account function)
CREATE POLICY users_policy_service_delete
    ON users
    FOR DELETE
    TO recept
    USING (true);

COMMENT ON POLICY users_policy_service_delete ON users IS
    'Allow the recept service role to delete users for account deletion';
