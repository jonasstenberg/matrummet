-- V59: Share a collection by link (mirrors V31 book-sharing, scoped to one collection).
-- Owner mints a token; recipient accepts → a collection_share_connection row → the
-- recipient gains read access via can_access_collection (V58). Tables live in V58.
-- All functions authenticated-only (unlike book-share, get_collection_share_info is NOT
-- granted to anon — login required to view a share link).

-- ============================================================
-- create_collection_share_token(p_collection_id, p_expires_days)
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_collection_share_token(
  p_collection_id uuid, p_expires_days integer DEFAULT NULL
) RETURNS TABLE(token text, expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_email   text := current_setting('request.jwt.claims', true)::jsonb ->> 'email';
  v_token   text;
  v_expires timestamptz;
BEGIN
  IF v_email IS NULL THEN RAISE EXCEPTION 'not-authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM collections c WHERE c.id = p_collection_id AND c.owner = v_email) THEN
    RAISE EXCEPTION 'not-allowed';
  END IF;

  LOOP
    v_token := generate_share_token();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM collection_share_tokens t WHERE t.token = v_token);
  END LOOP;

  IF p_expires_days IS NOT NULL THEN
    v_expires := now() + (p_expires_days || ' days')::interval;
  END IF;

  INSERT INTO collection_share_tokens (collection_id, owner, token, expires_at)
  VALUES (p_collection_id, v_email, v_token, v_expires);

  RETURN QUERY SELECT v_token, v_expires;
END;
$$;

-- ============================================================
-- get_collection_share_info(p_token) — preview for the accept page; no connection created.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_collection_share_info(p_token text)
RETURNS TABLE(collection_id uuid, collection_name text, sharer_name text, sharer_email text,
              recipe_count bigint, already_connected boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_email text := current_setting('request.jwt.claims', true)::jsonb ->> 'email';
  v_tok   RECORD;
  v_coll  RECORD;
BEGIN
  SELECT * INTO v_tok FROM collection_share_tokens t
  WHERE t.token = p_token AND t.revoked_at IS NULL AND (t.expires_at IS NULL OR t.expires_at > now());
  IF v_tok.id IS NULL THEN RETURN; END IF;

  SELECT c.id, c.name, c.owner INTO v_coll FROM collections c WHERE c.id = v_tok.collection_id;
  IF v_coll.id IS NULL THEN RETURN; END IF;

  RETURN QUERY SELECT
    v_coll.id,
    v_coll.name,
    (SELECT u.name FROM users u WHERE u.email = v_coll.owner),
    v_coll.owner,
    (SELECT count(*) FROM collection_recipes cr WHERE cr.collection_id = v_coll.id),
    CASE WHEN v_email IS NULL THEN false
         ELSE EXISTS (SELECT 1 FROM collection_share_connections s
                      WHERE s.collection_id = v_coll.id AND s.recipient_email = v_email) END;
END;
$$;

-- ============================================================
-- accept_collection_share(p_token) — creates the connection. Idempotent.
-- ============================================================
CREATE OR REPLACE FUNCTION public.accept_collection_share(p_token text)
RETURNS TABLE(collection_id uuid, collection_name text, sharer_name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
-- OUT-param names (collection_id, …) collide with table columns in ON CONFLICT below;
-- resolve bare ambiguous identifiers to the column.
#variable_conflict use_column
DECLARE
  v_email text := current_setting('request.jwt.claims', true)::jsonb ->> 'email';
  v_tok   RECORD;
  v_coll  RECORD;
BEGIN
  IF v_email IS NULL THEN RAISE EXCEPTION 'not-authenticated'; END IF;

  SELECT * INTO v_tok FROM collection_share_tokens t
  WHERE t.token = p_token AND t.revoked_at IS NULL AND (t.expires_at IS NULL OR t.expires_at > now());
  IF v_tok.id IS NULL THEN RAISE EXCEPTION 'invalid-or-expired-token'; END IF;

  SELECT c.id, c.name, c.owner INTO v_coll FROM collections c WHERE c.id = v_tok.collection_id;
  IF v_coll.id IS NULL THEN RAISE EXCEPTION 'invalid-or-expired-token'; END IF;
  IF v_coll.owner = v_email THEN RAISE EXCEPTION 'cannot-share-with-self'; END IF;

  INSERT INTO collection_share_connections (collection_id, sharer_email, recipient_email)
  VALUES (v_coll.id, v_coll.owner, v_email)
  ON CONFLICT (collection_id, recipient_email) DO NOTHING;

  RETURN QUERY SELECT v_coll.id, v_coll.name, (SELECT u.name FROM users u WHERE u.email = v_coll.owner);
END;
$$;

-- ============================================================
-- get_shared_collections() — collections shared WITH the current user.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_shared_collections()
RETURNS TABLE(connection_id uuid, collection_id uuid, collection_name text, sharer_name text, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_email text := current_setting('request.jwt.claims', true)::jsonb ->> 'email';
BEGIN
  IF v_email IS NULL THEN RAISE EXCEPTION 'not-authenticated'; END IF;
  RETURN QUERY
  SELECT s.id, c.id, c.name, u.name, s.created_at
  FROM collection_share_connections s
  JOIN collections c ON c.id = s.collection_id
  JOIN users u ON u.email = s.sharer_email
  WHERE s.recipient_email = v_email
  ORDER BY s.created_at;
END;
$$;

-- ============================================================
-- revoke_collection_share_token(p_token) — owner revokes a link.
-- ============================================================
CREATE OR REPLACE FUNCTION public.revoke_collection_share_token(p_token text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_email text := current_setting('request.jwt.claims', true)::jsonb ->> 'email';
BEGIN
  IF v_email IS NULL THEN RAISE EXCEPTION 'not-authenticated'; END IF;
  UPDATE collection_share_tokens SET revoked_at = now()
  WHERE token = p_token AND revoked_at IS NULL AND owner = v_email;
  RETURN FOUND;
END;
$$;

-- ============================================================
-- remove_collection_share_connection(p_connection_id) — either party removes.
-- ============================================================
CREATE OR REPLACE FUNCTION public.remove_collection_share_connection(p_connection_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_email text := current_setting('request.jwt.claims', true)::jsonb ->> 'email';
BEGIN
  IF v_email IS NULL THEN RAISE EXCEPTION 'not-authenticated'; END IF;
  DELETE FROM collection_share_connections
  WHERE id = p_connection_id AND (sharer_email = v_email OR recipient_email = v_email);
  RETURN FOUND;
END;
$$;

-- Authenticated only (defensive REVOKE + grant; matches V57/V58).
DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'create_collection_share_token(uuid, integer)',
    'get_collection_share_info(text)',
    'accept_collection_share(text)',
    'get_shared_collections()',
    'revoke_collection_share_token(text)',
    'remove_collection_share_connection(uuid)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', fn);
  END LOOP;
END;
$$;
