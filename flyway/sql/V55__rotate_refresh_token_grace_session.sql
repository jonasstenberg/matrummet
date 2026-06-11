-- Return the session on grace-window refresh token reuse instead of nothing.
--
-- When concurrent requests race to rotate the same refresh token (multiple
-- tabs, parallel SSR loaders, or both clustered app instances), the loser
-- previously got an empty result and rendered the page logged out even though
-- the browser held the winner's fresh cookies. The user then saw a "Log in"
-- button that silently redirected back, until a hard refresh.
--
-- Now a reuse within the 60-second grace window returns the user info with a
-- NULL token_id: the app layer signs a fresh access token from it but does NOT
-- get (or set) a new refresh token, leaving the winner's refresh cookie intact.
-- Reuse after the grace window is still treated as compromise and revokes all
-- of the user's tokens.

CREATE OR REPLACE FUNCTION public.rotate_refresh_token(
    p_old_token_hash text,
    p_new_token_hash text,
    p_new_expires_at timestamp with time zone,
    p_ip_address text DEFAULT NULL,
    p_user_agent text DEFAULT NULL
) RETURNS TABLE(token_id uuid, user_email text, user_name text, user_role text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
AS $$
DECLARE
    v_old_token refresh_tokens%ROWTYPE;
    v_new_token_id uuid;
BEGIN
    -- Lock the old token row to prevent concurrent rotation
    SELECT * INTO v_old_token
    FROM refresh_tokens rt
    WHERE rt.token_hash = p_old_token_hash
    FOR UPDATE;

    -- Token not found
    IF v_old_token IS NULL THEN
        RETURN;
    END IF;

    -- Token already revoked — check if this is a concurrent request (grace period)
    -- or a genuine compromise (reuse after significant time).
    IF v_old_token.revoked_at IS NOT NULL THEN
        IF v_old_token.revoked_at > now() - INTERVAL '60 seconds' THEN
            -- Recent revocation — likely a concurrent request that lost the
            -- rotation race, not compromise. Return the session (NULL token_id)
            -- so the caller can sign a fresh access token without issuing
            -- another refresh token.
            RETURN QUERY
            SELECT NULL::uuid, u.email, u.name, u.role
            FROM users u
            WHERE u.email = v_old_token.user_email;
            RETURN;
        END IF;

        -- Revoked long ago — genuine token reuse, revoke ALL user sessions
        UPDATE refresh_tokens rt
        SET revoked_at = now()
        WHERE rt.user_email = v_old_token.user_email
          AND rt.revoked_at IS NULL;
        RETURN;
    END IF;

    -- Token expired
    IF v_old_token.expires_at < now() THEN
        UPDATE refresh_tokens rt
        SET revoked_at = now()
        WHERE rt.id = v_old_token.id;
        RETURN;
    END IF;

    -- Revoke the old token
    UPDATE refresh_tokens rt
    SET revoked_at = now()
    WHERE rt.id = v_old_token.id;

    -- Create the new token
    INSERT INTO refresh_tokens (user_email, token_hash, expires_at, ip_address, user_agent)
    VALUES (v_old_token.user_email, p_new_token_hash, p_new_expires_at, p_ip_address, p_user_agent)
    RETURNING id INTO v_new_token_id;

    -- Return the new token ID along with user info for signing a new access token
    RETURN QUERY
    SELECT v_new_token_id, u.email, u.name, u.role
    FROM users u
    WHERE u.email = v_old_token.user_email;
END;
$$;
