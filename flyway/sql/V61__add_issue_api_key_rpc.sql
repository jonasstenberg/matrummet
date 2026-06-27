-- V61__add_issue_api_key_rpc.sql
--
-- Password-gated bootstrap RPC: mint an API key without an existing session.
--
-- This mirrors two existing functions so behaviour stays consistent:
--   * login()              (V1) — bcrypt password verification + timing-attack
--                                  dummy-hash guard, and the same generic
--                                  'invalid user or password' error that does
--                                  NOT leak whether the email exists.
--   * create_user_api_key() (V50) — raw key format ('sk_' + 32 hex), bcrypt
--                                  hashing, 8-char prefix, insert into
--                                  user_api_keys; the raw key is returned once.
--
-- SECURITY DEFINER (like login): the caller is anon with no JWT, so the email
-- is taken from p_email AFTER password verification, not from request.jwt.claims.
-- Running as the definer (matrummet) lets it read user_passwords and insert into
-- user_api_keys under the existing `*_policy_service` RLS policies (TO matrummet),
-- exactly as login() reads the FORCE-RLS user_passwords table today.
--
-- RATE LIMITING: this is an anonymous, password-accepting endpoint. nginx MUST
-- rate-limit POST /rpc/issue_api_key the same way it rate-limits /rpc/login
-- (it is a credential-checking brute-force surface). There is no statement-level
-- throttle in Postgres; the per-call bcrypt cost (gen_salt('bf')) is the only
-- in-DB cost control, so the network-edge limit is required.

CREATE OR REPLACE FUNCTION public.issue_api_key(
    p_email    text,
    p_password text,
    p_name     text
) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
    stored_password  TEXT;
    -- Same dummy hash as login() — keeps timing identical whether or not the
    -- email exists, so we never leak account existence.
    dummy_hash       TEXT := '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.I4e1rq4yY1.HCi';
    v_api_key        TEXT;
    v_api_key_prefix TEXT;
    v_api_key_hash   TEXT;
BEGIN
    -- Input validation (mirror create_user_api_key); independent of the email
    -- so it leaks nothing about account existence.
    IF p_name IS NULL OR LENGTH(TRIM(p_name)) < 1 THEN
        RAISE EXCEPTION 'invalid-key-name';
    END IF;

    -- ---- Verify password EXACTLY like login() ----
    SELECT user_passwords.password
    INTO stored_password
    FROM users
    INNER JOIN user_passwords ON users.email = user_passwords.email
    WHERE users.email = p_email;

    IF stored_password IS NULL THEN
        PERFORM crypt(p_password, dummy_hash);      -- timing-attack guard
        RAISE EXCEPTION 'invalid user or password';
    END IF;

    IF stored_password <> crypt(p_password, stored_password) THEN
        RAISE EXCEPTION 'invalid user or password';
    END IF;

    -- Credentials are valid past this point. Duplicate-name guard only runs for
    -- an authenticated owner, so it does not leak existence to attackers.
    IF EXISTS (
        SELECT 1 FROM user_api_keys
        WHERE user_email = p_email AND name = TRIM(p_name)
    ) THEN
        RAISE EXCEPTION 'key-name-already-exists';
    END IF;

    -- ---- Generate + store key EXACTLY like create_user_api_key() ----
    v_api_key        := 'sk_' || encode(gen_random_bytes(16), 'hex');  -- sk_ + 32 hex
    v_api_key_prefix := LEFT(v_api_key, 8);
    v_api_key_hash   := crypt(v_api_key, gen_salt('bf'));              -- bcrypt

    INSERT INTO user_api_keys (user_email, name, api_key_hash, api_key_prefix)
    VALUES (p_email, TRIM(p_name), v_api_key_hash, v_api_key_prefix);

    -- Return the raw key ONCE (never stored in plaintext).
    RETURN v_api_key;
END;
$$;

-- Grants: password-gated bootstrap, mirroring login() (granted to anon +
-- authenticated). anon is the important one — it is what makes this usable
-- without a session.
REVOKE ALL ON FUNCTION public.issue_api_key(p_email text, p_password text, p_name text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.issue_api_key(p_email text, p_password text, p_name text) TO anon;
GRANT EXECUTE ON FUNCTION public.issue_api_key(p_email text, p_password text, p_name text) TO authenticated;
