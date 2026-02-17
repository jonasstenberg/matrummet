-- Migration: Book sharing (share entire recipe book with another user)
-- Enables token-based book sharing: owner creates a link, recipient accepts to see all recipes.

-- ============================================================
-- Table: book_share_tokens
-- ============================================================
CREATE TABLE book_share_tokens (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    owner_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ
);

CREATE INDEX book_share_tokens_token_idx ON book_share_tokens(token);
CREATE INDEX book_share_tokens_owner_idx ON book_share_tokens(owner_email);

ALTER TABLE book_share_tokens ENABLE ROW LEVEL SECURITY;

-- Owner can see their own tokens
CREATE POLICY book_share_tokens_owner_select ON book_share_tokens
    FOR SELECT TO authenticated
    USING (owner_email = current_setting('request.jwt.claims', true)::jsonb->>'email');

-- Owner can create tokens
CREATE POLICY book_share_tokens_owner_insert ON book_share_tokens
    FOR INSERT TO authenticated
    WITH CHECK (owner_email = current_setting('request.jwt.claims', true)::jsonb->>'email');

-- Owner can update (revoke) tokens
CREATE POLICY book_share_tokens_owner_update ON book_share_tokens
    FOR UPDATE TO authenticated
    USING (owner_email = current_setting('request.jwt.claims', true)::jsonb->>'email');

GRANT SELECT, INSERT, UPDATE ON book_share_tokens TO authenticated;

-- ============================================================
-- Table: book_share_connections
-- ============================================================
CREATE TABLE book_share_connections (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    sharer_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
    recipient_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(sharer_email, recipient_email),
    CHECK (sharer_email <> recipient_email)
);

CREATE INDEX book_share_connections_sharer_idx ON book_share_connections(sharer_email);
CREATE INDEX book_share_connections_recipient_idx ON book_share_connections(recipient_email);

ALTER TABLE book_share_connections ENABLE ROW LEVEL SECURITY;

-- Both parties can see the connection
CREATE POLICY book_share_connections_select ON book_share_connections
    FOR SELECT TO authenticated
    USING (
        sharer_email = current_setting('request.jwt.claims', true)::jsonb->>'email'
        OR recipient_email = current_setting('request.jwt.claims', true)::jsonb->>'email'
    );

-- Either party can delete the connection
CREATE POLICY book_share_connections_delete ON book_share_connections
    FOR DELETE TO authenticated
    USING (
        sharer_email = current_setting('request.jwt.claims', true)::jsonb->>'email'
        OR recipient_email = current_setting('request.jwt.claims', true)::jsonb->>'email'
    );

GRANT SELECT, DELETE ON book_share_connections TO authenticated;

-- ============================================================
-- Function: has_book_share_from(p_owner_email)
-- Used in RLS to check if current user has a book share from the recipe owner.
-- ============================================================
CREATE FUNCTION has_book_share_from(p_owner_email TEXT) RETURNS BOOLEAN
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
AS $$
DECLARE
    v_current_user_email TEXT;
BEGIN
    v_current_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

    IF v_current_user_email IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM book_share_connections
        WHERE sharer_email = p_owner_email
          AND recipient_email = v_current_user_email
    );
END;
$$;

GRANT EXECUTE ON FUNCTION has_book_share_from(TEXT) TO authenticated;

-- ============================================================
-- RLS policy on recipes: book share recipients can see sharer's private recipes
-- ============================================================
CREATE POLICY recipes_book_share_select ON recipes
    FOR SELECT TO authenticated
    USING (visibility = 'private' AND has_book_share_from(owner));

-- ============================================================
-- Function: create_book_share_token(p_expires_days)
-- ============================================================
CREATE FUNCTION create_book_share_token(p_expires_days INTEGER DEFAULT NULL)
RETURNS TABLE(token TEXT, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_email TEXT;
    v_token TEXT;
    v_expires_at TIMESTAMPTZ;
BEGIN
    v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

    IF v_user_email IS NULL THEN
        RAISE EXCEPTION 'not-authenticated';
    END IF;

    -- Generate unique token (reuse existing generate_share_token function)
    LOOP
        v_token := generate_share_token();
        EXIT WHEN NOT EXISTS (
            SELECT 1 FROM book_share_tokens bst WHERE bst.token = v_token
        );
    END LOOP;

    IF p_expires_days IS NOT NULL THEN
        v_expires_at := now() + (p_expires_days || ' days')::INTERVAL;
    END IF;

    INSERT INTO book_share_tokens (owner_email, token, expires_at)
    VALUES (v_user_email, v_token, v_expires_at);

    RETURN QUERY SELECT v_token, v_expires_at;
END;
$$;

GRANT EXECUTE ON FUNCTION create_book_share_token(INTEGER) TO authenticated;

-- ============================================================
-- Function: get_book_share_info(p_token)
-- Returns sharer info for the accept page. No connection created.
-- ============================================================
CREATE FUNCTION get_book_share_info(p_token TEXT)
RETURNS TABLE(sharer_name TEXT, sharer_email TEXT, recipe_count BIGINT, already_connected BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_token_record RECORD;
    v_current_user_email TEXT;
    v_sharer_name TEXT;
    v_sharer_email TEXT;
    v_recipe_count BIGINT;
    v_already_connected BOOLEAN;
BEGIN
    v_current_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

    -- Find and validate the token
    SELECT bst.*
    INTO v_token_record
    FROM book_share_tokens bst
    WHERE bst.token = p_token
      AND bst.revoked_at IS NULL
      AND (bst.expires_at IS NULL OR bst.expires_at > now());

    IF v_token_record.id IS NULL THEN
        RETURN; -- Empty result for invalid tokens
    END IF;

    SELECT u.name INTO v_sharer_name
    FROM users u WHERE u.email = v_token_record.owner_email;

    v_sharer_email := v_token_record.owner_email;

    SELECT count(*) INTO v_recipe_count
    FROM recipes r WHERE r.owner = v_token_record.owner_email;

    IF v_current_user_email IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1 FROM book_share_connections bsc
            WHERE bsc.sharer_email = v_token_record.owner_email
              AND bsc.recipient_email = v_current_user_email
        ) INTO v_already_connected;
    ELSE
        v_already_connected := FALSE;
    END IF;

    RETURN QUERY SELECT v_sharer_name, v_sharer_email, v_recipe_count, v_already_connected;
END;
$$;

GRANT EXECUTE ON FUNCTION get_book_share_info(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_book_share_info(TEXT) TO anon;

-- ============================================================
-- Function: accept_book_share(p_token)
-- Validates token, creates connection. Idempotent.
-- ============================================================
CREATE FUNCTION accept_book_share(p_token TEXT)
RETURNS TABLE(sharer_name TEXT, sharer_id UUID)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_current_user_email TEXT;
    v_token_record RECORD;
    v_sharer_name TEXT;
    v_sharer_id UUID;
BEGIN
    v_current_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

    IF v_current_user_email IS NULL THEN
        RAISE EXCEPTION 'not-authenticated';
    END IF;

    -- Find and validate the token
    SELECT bst.*
    INTO v_token_record
    FROM book_share_tokens bst
    WHERE bst.token = p_token
      AND bst.revoked_at IS NULL
      AND (bst.expires_at IS NULL OR bst.expires_at > now());

    IF v_token_record.id IS NULL THEN
        RAISE EXCEPTION 'invalid-or-expired-token';
    END IF;

    -- Cannot share with yourself
    IF v_token_record.owner_email = v_current_user_email THEN
        RAISE EXCEPTION 'cannot-share-with-self';
    END IF;

    -- Get sharer info
    SELECT u.id, u.name INTO v_sharer_id, v_sharer_name
    FROM users u WHERE u.email = v_token_record.owner_email;

    -- Create connection (idempotent via ON CONFLICT)
    INSERT INTO book_share_connections (sharer_email, recipient_email)
    VALUES (v_token_record.owner_email, v_current_user_email)
    ON CONFLICT (sharer_email, recipient_email) DO NOTHING;

    RETURN QUERY SELECT v_sharer_name, v_sharer_id;
END;
$$;

GRANT EXECUTE ON FUNCTION accept_book_share(TEXT) TO authenticated;

-- ============================================================
-- Function: get_shared_books()
-- Returns book share connections where current user is recipient.
-- ============================================================
CREATE FUNCTION get_shared_books()
RETURNS TABLE(id UUID, sharer_name TEXT, sharer_id UUID, created_at TIMESTAMPTZ)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_current_user_email TEXT;
BEGIN
    v_current_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

    IF v_current_user_email IS NULL THEN
        RAISE EXCEPTION 'not-authenticated';
    END IF;

    RETURN QUERY
    SELECT
        bsc.id AS id,
        u.name AS sharer_name,
        u.id AS sharer_id,
        bsc.created_at AS created_at
    FROM book_share_connections bsc
    JOIN users u ON u.email = bsc.sharer_email
    WHERE bsc.recipient_email = v_current_user_email
    ORDER BY bsc.created_at;
END;
$$;

GRANT EXECUTE ON FUNCTION get_shared_books() TO authenticated;

-- ============================================================
-- Function: revoke_book_share_token(p_token)
-- ============================================================
CREATE FUNCTION revoke_book_share_token(p_token TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_email TEXT;
BEGIN
    v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

    IF v_user_email IS NULL THEN
        RAISE EXCEPTION 'not-authenticated';
    END IF;

    UPDATE book_share_tokens bst
    SET revoked_at = now()
    WHERE bst.token = p_token
      AND bst.revoked_at IS NULL
      AND bst.owner_email = v_user_email;

    RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION revoke_book_share_token(TEXT) TO authenticated;

-- ============================================================
-- Function: remove_book_share_connection(p_connection_id)
-- Either party can remove.
-- ============================================================
CREATE FUNCTION remove_book_share_connection(p_connection_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_email TEXT;
BEGIN
    v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

    IF v_user_email IS NULL THEN
        RAISE EXCEPTION 'not-authenticated';
    END IF;

    DELETE FROM book_share_connections
    WHERE id = p_connection_id
      AND (sharer_email = v_user_email OR recipient_email = v_user_email);

    RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION remove_book_share_connection(UUID) TO authenticated;
