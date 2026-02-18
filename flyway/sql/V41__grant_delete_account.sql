-- Fix delete_account: missing GRANT and missing 'extensions' in search_path
-- (extensions schema needed for pgcrypto's crypt() function)
GRANT EXECUTE ON FUNCTION public.delete_account(text, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_account(p_password text DEFAULT NULL::text, p_delete_data boolean DEFAULT false) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
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

    -- Delete the user (cascades to related tables)
    DELETE FROM users WHERE id = v_user_id;

    RETURN jsonb_build_object('success', true, 'message', 'Account deleted successfully');
END;
$$;
