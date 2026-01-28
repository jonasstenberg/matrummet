-- V58: Account Deletion with Optional Data Deletion
-- Adds p_delete_data parameter to delete_account() to allow users to optionally
-- delete all their recipes and data when deleting their account

-- =============================================================================
-- UPDATE delete_account() FUNCTION
-- =============================================================================

-- Drop the old function signature
DROP FUNCTION IF EXISTS delete_account(TEXT);

CREATE OR REPLACE FUNCTION delete_account(p_password TEXT DEFAULT NULL, p_delete_data BOOLEAN DEFAULT false)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_email TEXT;
    v_user_id UUID;
    v_user_provider TEXT;
    v_stored_password TEXT;
BEGIN
    -- Get the email from JWT claims
    v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

    -- Validate that we have a valid user email
    IF v_user_email IS NULL OR v_user_email = '' THEN
        RAISE EXCEPTION 'not-authenticated';
    END IF;

    -- Get the user ID and provider to verify user exists
    SELECT id, provider INTO v_user_id, v_user_provider
    FROM users
    WHERE email = v_user_email;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'operation-failed';
    END IF;

    -- SECURITY: Require password verification for non-OAuth users
    IF v_user_provider IS NULL THEN
        -- User signed up with password, require password confirmation
        IF p_password IS NULL THEN
            RAISE EXCEPTION 'password-required';
        END IF;

        -- Get the stored password hash
        SELECT password INTO v_stored_password
        FROM user_passwords
        WHERE email = v_user_email;

        IF v_stored_password IS NULL THEN
            RAISE EXCEPTION 'operation-failed';
        END IF;

        -- Verify the password
        IF v_stored_password <> crypt(p_password, v_stored_password) THEN
            RAISE EXCEPTION 'invalid-password';
        END IF;
    END IF;
    -- OAuth users can delete without password (they authenticated via OAuth provider)

    -- If user opted to delete all their data, remove recipes first
    -- (recipes use ON DELETE SET NULL, so they'd be orphaned otherwise)
    IF p_delete_data THEN
        DELETE FROM recipes WHERE owner = v_user_email;
    END IF;

    -- Delete the user
    -- This will:
    -- 1. Cascade delete from user_passwords (ON DELETE CASCADE)
    -- 2. Cascade delete from user_email_preferences (ON DELETE CASCADE)
    -- 3. Cascade delete from password_reset_tokens (ON DELETE CASCADE)
    -- 4. Cascade delete from recipe_likes (ON DELETE CASCADE)
    -- 5. Cascade delete from shopping_lists (ON DELETE CASCADE)
    -- 6. Cascade delete from user_pantry (ON DELETE CASCADE)
    -- 7. Cascade delete from user_api_keys (ON DELETE CASCADE)
    -- 8. Cascade delete from user_credits (ON DELETE CASCADE)
    -- 9. Cascade delete from credit_transactions (ON DELETE CASCADE)
    -- 10. Cascade delete from home_invitations (ON DELETE CASCADE)
    -- 11. Set recipes.owner to NULL (ON DELETE SET NULL) -- only if p_delete_data was false
    -- 12. Set email_messages.recipient_user_id to NULL (ON DELETE SET NULL)
    DELETE FROM users WHERE id = v_user_id;

    RETURN jsonb_build_object('success', true, 'message', 'Account deleted successfully');
END;
$$;

COMMENT ON FUNCTION delete_account(TEXT, BOOLEAN) IS
    'Deletes the current user account. Requires password for non-OAuth users. '
    'If p_delete_data is true, all user recipes are permanently deleted. '
    'If p_delete_data is false (default), recipes are preserved with NULL owner. '
    'User passwords, email preferences, and password reset tokens are always deleted.';

-- Grant execute to anon role (authenticated users via PostgREST)
GRANT EXECUTE ON FUNCTION delete_account(TEXT, BOOLEAN) TO "anon";

-- Set the owner to recept for SECURITY DEFINER to work properly
ALTER FUNCTION delete_account(TEXT, BOOLEAN) OWNER TO recept;
