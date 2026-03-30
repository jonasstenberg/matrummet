-- Refresh tokens for persistent sessions with token rotation.
-- Access tokens are short-lived (1h), refresh tokens are long-lived (30 days).
-- On each refresh, the old token is revoked and a new one is issued.

CREATE TABLE public.refresh_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_email text NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    ip_address text,
    user_agent text,
    PRIMARY KEY (id),
    UNIQUE (token_hash),
    CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_email)
        REFERENCES public.users(email) ON DELETE CASCADE
);

CREATE INDEX refresh_tokens_user_email_idx ON public.refresh_tokens (user_email);
CREATE INDEX refresh_tokens_expires_at_idx ON public.refresh_tokens (expires_at);
CREATE INDEX refresh_tokens_token_hash_idx ON public.refresh_tokens (token_hash)
    WHERE revoked_at IS NULL;

-- RLS: only the token owner can see their own tokens
ALTER TABLE public.refresh_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY refresh_tokens_select ON public.refresh_tokens
    FOR SELECT TO authenticated
    USING (user_email = current_setting('request.jwt.claims', true)::jsonb->>'email');

-- App inserts/updates via SECURITY DEFINER functions, not direct access
CREATE POLICY refresh_tokens_deny_insert ON public.refresh_tokens
    FOR INSERT TO authenticated
    WITH CHECK (false);

CREATE POLICY refresh_tokens_deny_update ON public.refresh_tokens
    FOR UPDATE TO authenticated
    USING (false);

CREATE POLICY refresh_tokens_deny_delete ON public.refresh_tokens
    FOR DELETE TO authenticated
    USING (false);

-- Admin can manage all tokens
CREATE POLICY refresh_tokens_admin ON public.refresh_tokens
    FOR ALL TO admin
    USING (true)
    WITH CHECK (true);

---
--- Create a new refresh token for a user. Returns the token ID.
--- Called from app layer (with admin/system token) after login/signup.
---
CREATE FUNCTION public.create_refresh_token(
    p_user_email text,
    p_token_hash text,
    p_expires_at timestamp with time zone,
    p_ip_address text DEFAULT NULL,
    p_user_agent text DEFAULT NULL
) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
AS $$
DECLARE
    v_token_id uuid;
BEGIN
    INSERT INTO refresh_tokens (user_email, token_hash, expires_at, ip_address, user_agent)
    VALUES (p_user_email, p_token_hash, p_expires_at, p_ip_address, p_user_agent)
    RETURNING id INTO v_token_id;

    RETURN v_token_id;
END;
$$;

---
--- Rotate a refresh token: revoke the old one and create a new one atomically.
--- Returns the new token ID and user info, or empty if the old token is invalid/expired/revoked.
--- If the old token was already revoked, revoke ALL tokens for the user (compromise detection).
--- Called from app layer (with admin/system token) during token refresh.
---
CREATE FUNCTION public.rotate_refresh_token(
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
    -- Multiple browser tabs can trigger simultaneous refreshes when the access
    -- token expires, so we allow a 60-second grace window before treating
    -- reuse as compromise.
    IF v_old_token.revoked_at IS NOT NULL THEN
        IF v_old_token.revoked_at > now() - INTERVAL '60 seconds' THEN
            -- Recent revocation — likely a concurrent tab, not compromise.
            -- Return empty (caller gets 401 and uses the fresh access token
            -- that the winning request already set via cookie).
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

---
--- Revoke all refresh tokens for a user (password change, account deletion, logout-everywhere).
---
CREATE FUNCTION public.revoke_user_refresh_tokens(p_user_email text)
RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
AS $$
DECLARE
    v_count integer;
BEGIN
    UPDATE refresh_tokens
    SET revoked_at = now()
    WHERE user_email = p_user_email
      AND revoked_at IS NULL;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

---
--- Revoke a single refresh token by its hash (single-device logout).
---
CREATE FUNCTION public.revoke_refresh_token(p_token_hash text)
RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
AS $$
DECLARE
    v_found boolean;
BEGIN
    UPDATE refresh_tokens
    SET revoked_at = now()
    WHERE token_hash = p_token_hash
      AND revoked_at IS NULL;

    GET DIAGNOSTICS v_found = ROW_COUNT;
    RETURN v_found;
END;
$$;

---
--- Clean up expired and old revoked refresh tokens.
--- Should be called periodically via cron alongside cleanup_expired_password_reset_tokens().
--- Recommended schedule: daily (e.g., via pg_cron or external cron calling the RPC).
---
CREATE FUNCTION public.cleanup_expired_refresh_tokens() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
AS $$
DECLARE
    v_deleted_count integer;
BEGIN
    DELETE FROM refresh_tokens
    WHERE expires_at < now() - INTERVAL '7 days'
       OR (revoked_at IS NOT NULL AND revoked_at < now() - INTERVAL '30 days');

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN v_deleted_count;
END;
$$;

-- Restrict token management functions to admin role only.
-- The app layer calls these with a system PostgREST token (role=admin).
REVOKE EXECUTE ON FUNCTION public.create_refresh_token FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_refresh_token TO admin;

REVOKE EXECUTE ON FUNCTION public.rotate_refresh_token FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rotate_refresh_token TO admin;

REVOKE EXECUTE ON FUNCTION public.revoke_user_refresh_tokens FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_user_refresh_tokens TO admin;

REVOKE EXECUTE ON FUNCTION public.revoke_refresh_token FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_refresh_token TO admin;

REVOKE EXECUTE ON FUNCTION public.cleanup_expired_refresh_tokens FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_refresh_tokens TO admin;
