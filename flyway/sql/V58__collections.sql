-- V58: First-class Collections.
--
-- A collection is a named, many-to-many set of recipes owned by a user. Personal
-- collections group your own recipes; curated collections (admin) hold imported sets.
-- Access: owner OR admin OR shared-with-you (link/token, see collection_share_*).
-- Visibility is an additive RLS path on recipes (recipes_collection_select) — it does
-- NOT use visibility='public' (blocked by recipes_visibility_private_only since V3),
-- mirroring recipes_book_share_select (V31).

------------------------------------------------------------------------------------
-- Tables
------------------------------------------------------------------------------------
CREATE TABLE public.collections (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner          text NOT NULL DEFAULT ((current_setting('request.jwt.claims', true))::jsonb ->> 'email')
                   REFERENCES public.users(email) ON DELETE CASCADE,
  name           text NOT NULL,
  description    text,
  kind           text NOT NULL DEFAULT 'personal' CHECK (kind IN ('personal', 'curated')),
  cover_image    text,
  date_published timestamptz NOT NULL DEFAULT now(),
  date_modified  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX collections_owner_idx ON public.collections (owner);

CREATE TABLE public.collection_recipes (
  collection_id uuid NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  recipe_id     uuid NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  sort_order    integer NOT NULL DEFAULT 0,
  added_by      text DEFAULT ((current_setting('request.jwt.claims', true))::jsonb ->> 'email'),
  date_added    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (collection_id, recipe_id)
);
CREATE INDEX collection_recipes_recipe_idx ON public.collection_recipes (recipe_id);
CREATE INDEX collection_recipes_coll_sort_idx ON public.collection_recipes (collection_id, sort_order);

-- Share-by-link (mirrors V31 book_share_*). RPCs to mint/accept tokens come in a later migration.
CREATE TABLE public.collection_share_tokens (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  owner         text NOT NULL DEFAULT ((current_setting('request.jwt.claims', true))::jsonb ->> 'email')
                  REFERENCES public.users(email) ON DELETE CASCADE,
  token         text NOT NULL UNIQUE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz,
  revoked_at    timestamptz
);
CREATE INDEX collection_share_tokens_collection_idx ON public.collection_share_tokens (collection_id);

CREATE TABLE public.collection_share_connections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id   uuid NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  sharer_email    text NOT NULL REFERENCES public.users(email) ON DELETE CASCADE,
  recipient_email text NOT NULL REFERENCES public.users(email) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (collection_id, recipient_email),
  CHECK (sharer_email <> recipient_email)
);
CREATE INDEX collection_share_connections_recipient_idx ON public.collection_share_connections (recipient_email);

-- Table-level privileges (RLS gates the rows; PostgREST needs the grant too). Authenticated only.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collection_recipes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collection_share_tokens TO authenticated;
GRANT SELECT, DELETE ON public.collection_share_connections TO authenticated;  -- INSERT only via the SECURITY DEFINER accept RPC

------------------------------------------------------------------------------------
-- Access helpers (SECURITY DEFINER: bypass RLS internally; only gate, never expose data)
------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_access_collection(p_collection_id uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM collections c
    WHERE c.id = p_collection_id
      AND ( c.owner = (current_setting('request.jwt.claims', true)::jsonb ->> 'email')
            OR is_admin()
            OR EXISTS (SELECT 1 FROM collection_share_connections s
                       WHERE s.collection_id = c.id
                         AND s.recipient_email = (current_setting('request.jwt.claims', true)::jsonb ->> 'email')) )
  );
$$;

-- A recipe is reachable via collections if it is in any collection the caller can access.
CREATE OR REPLACE FUNCTION public.has_collection_access(p_recipe_id uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM collection_recipes cr
    WHERE cr.recipe_id = p_recipe_id AND public.can_access_collection(cr.collection_id)
  );
$$;

------------------------------------------------------------------------------------
-- RLS
------------------------------------------------------------------------------------
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY collections_select ON public.collections FOR SELECT TO authenticated
  USING ( owner = (current_setting('request.jwt.claims', true)::jsonb ->> 'email')
          OR is_admin()
          OR EXISTS (SELECT 1 FROM collection_share_connections s
                     WHERE s.collection_id = collections.id
                       AND s.recipient_email = (current_setting('request.jwt.claims', true)::jsonb ->> 'email')) );
CREATE POLICY collections_insert ON public.collections FOR INSERT TO authenticated
  WITH CHECK (owner = (current_setting('request.jwt.claims', true)::jsonb ->> 'email'));
CREATE POLICY collections_update ON public.collections FOR UPDATE TO authenticated
  USING (owner = (current_setting('request.jwt.claims', true)::jsonb ->> 'email'))
  WITH CHECK (owner = (current_setting('request.jwt.claims', true)::jsonb ->> 'email'));
CREATE POLICY collections_delete ON public.collections FOR DELETE TO authenticated
  USING (owner = (current_setting('request.jwt.claims', true)::jsonb ->> 'email'));

ALTER TABLE public.collection_recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY collection_recipes_select ON public.collection_recipes FOR SELECT TO authenticated
  USING (public.can_access_collection(collection_id));
CREATE POLICY collection_recipes_write ON public.collection_recipes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM collections c WHERE c.id = collection_id
                 AND c.owner = (current_setting('request.jwt.claims', true)::jsonb ->> 'email')))
  WITH CHECK (EXISTS (SELECT 1 FROM collections c WHERE c.id = collection_id
                 AND c.owner = (current_setting('request.jwt.claims', true)::jsonb ->> 'email')));

ALTER TABLE public.collection_share_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY collection_share_tokens_owner ON public.collection_share_tokens FOR ALL TO authenticated
  USING (owner = (current_setting('request.jwt.claims', true)::jsonb ->> 'email'))
  WITH CHECK (owner = (current_setting('request.jwt.claims', true)::jsonb ->> 'email'));

ALTER TABLE public.collection_share_connections ENABLE ROW LEVEL SECURITY;
-- Both parties can see/remove; inserts happen via the SECURITY DEFINER accept RPC (later migration).
CREATE POLICY collection_share_connections_select ON public.collection_share_connections FOR SELECT TO authenticated
  USING ( sharer_email = (current_setting('request.jwt.claims', true)::jsonb ->> 'email')
          OR recipient_email = (current_setting('request.jwt.claims', true)::jsonb ->> 'email') );
CREATE POLICY collection_share_connections_delete ON public.collection_share_connections FOR DELETE TO authenticated
  USING ( sharer_email = (current_setting('request.jwt.claims', true)::jsonb ->> 'email')
          OR recipient_email = (current_setting('request.jwt.claims', true)::jsonb ->> 'email') );

-- Additive recipe visibility: a private recipe is also SELECTable if reachable via an accessible collection.
CREATE POLICY recipes_collection_select ON public.recipes FOR SELECT TO authenticated
  USING (visibility = 'private' AND public.has_collection_access(id));

------------------------------------------------------------------------------------
-- RPCs (SECURITY INVOKER: recipes/collections RLS applies)
------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_collection(
  p_name text, p_description text DEFAULT NULL, p_kind text DEFAULT 'personal'
) RETURNS public.collections LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE v_row public.collections;
BEGIN
  IF coalesce(trim(p_name), '') = '' THEN RAISE EXCEPTION 'invalid-name'; END IF;
  IF p_kind = 'curated' AND NOT is_admin() THEN RAISE EXCEPTION 'not-allowed'; END IF;
  INSERT INTO collections (name, description, kind)
  VALUES (trim(p_name), p_description, coalesce(p_kind, 'personal'))
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_collection(
  p_id uuid, p_name text DEFAULT NULL, p_description text DEFAULT NULL, p_cover_image text DEFAULT NULL
) RETURNS public.collections LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE v_row public.collections;
BEGIN
  UPDATE collections SET
    name = coalesce(nullif(trim(p_name), ''), name),
    description = coalesce(p_description, description),
    cover_image = coalesce(p_cover_image, cover_image),
    date_modified = now()
  WHERE id = p_id
  RETURNING * INTO v_row;       -- RLS update policy already gates to owner
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'not-found'; END IF;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_collection(p_id uuid) RETURNS void
  LANGUAGE sql SET search_path TO 'public' AS $$
  DELETE FROM collections WHERE id = p_id;  -- RLS delete policy gates to owner; cascades membership
$$;

CREATE OR REPLACE FUNCTION public.add_recipe_to_collection(p_collection_id uuid, p_recipe_id uuid) RETURNS void
  LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE v_email text := (current_setting('request.jwt.claims', true)::jsonb ->> 'email');
BEGIN
  -- Only the collection owner may add, and only their own recipes (so sharing a collection
  -- never leaks someone else's recipe).
  IF NOT EXISTS (SELECT 1 FROM collections c WHERE c.id = p_collection_id AND c.owner = v_email)
     OR NOT EXISTS (SELECT 1 FROM recipes r WHERE r.id = p_recipe_id AND r.owner = v_email) THEN
    RAISE EXCEPTION 'not-allowed';
  END IF;
  INSERT INTO collection_recipes (collection_id, recipe_id)
  VALUES (p_collection_id, p_recipe_id)
  ON CONFLICT (collection_id, recipe_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_recipe_from_collection(p_collection_id uuid, p_recipe_id uuid) RETURNS void
  LANGUAGE sql SET search_path TO 'public' AS $$
  DELETE FROM collection_recipes WHERE collection_id = p_collection_id AND recipe_id = p_recipe_id;
$$;  -- RLS write policy gates to collection owner

CREATE OR REPLACE FUNCTION public.list_collections() RETURNS TABLE(
  id uuid, name text, description text, kind text, cover_image text,
  owner text, owner_name text, is_owner boolean, recipe_count bigint, date_published timestamptz
) LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT c.id, c.name, c.description, c.kind, c.cover_image, c.owner,
         get_user_display_name(c.owner),
         c.owner = (current_setting('request.jwt.claims', true)::jsonb ->> 'email'),
         (SELECT count(*) FROM collection_recipes cr WHERE cr.collection_id = c.id),
         c.date_published
  FROM collections c                       -- RLS select policy gates to owner/admin/shared
  ORDER BY c.date_published DESC;
$$;

-- Which of the caller's collections contain a recipe (for the "Add to collection" checkboxes).
CREATE OR REPLACE FUNCTION public.collections_for_recipe(p_recipe_id uuid) RETURNS TABLE(
  id uuid, name text, contains boolean
) LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT c.id, c.name,
         EXISTS (SELECT 1 FROM collection_recipes cr WHERE cr.collection_id = c.id AND cr.recipe_id = p_recipe_id)
  FROM collections c
  WHERE c.owner = (current_setting('request.jwt.claims', true)::jsonb ->> 'email')
  ORDER BY c.name;
$$;

-- Fast browse: page of recipe ids first (V57 limit-first pattern), hydrate the view for the page only.
CREATE OR REPLACE FUNCTION public.list_recipes_by_collection(
  p_collection_id uuid, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0
) RETURNS SETOF public.user_recipes LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT ur.*
  FROM public.user_recipes ur
  WHERE public.can_access_collection(p_collection_id)
    AND ur.id = ANY (ARRAY(
      SELECT cr.recipe_id
      FROM public.collection_recipes cr
      JOIN public.recipes r ON r.id = cr.recipe_id
      WHERE cr.collection_id = p_collection_id
      ORDER BY r.date_published DESC
      LIMIT GREATEST(p_limit, 0) OFFSET GREATEST(p_offset, 0)
    ))
  ORDER BY ur.date_published DESC;
$$;

CREATE OR REPLACE FUNCTION public.count_recipes_by_collection(p_collection_id uuid) RETURNS bigint
  LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT CASE WHEN public.can_access_collection(p_collection_id)
    THEN (SELECT count(*) FROM public.collection_recipes cr WHERE cr.collection_id = p_collection_id)
    ELSE 0::bigint END;
$$;

------------------------------------------------------------------------------------
-- Grants (authenticated only; revoke the implicit PUBLIC EXECUTE)
------------------------------------------------------------------------------------
DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'create_collection(text, text, text)',
    'update_collection(uuid, text, text, text)',
    'delete_collection(uuid)',
    'add_recipe_to_collection(uuid, uuid)',
    'remove_recipe_from_collection(uuid, uuid)',
    'list_collections()',
    'collections_for_recipe(uuid)',
    'list_recipes_by_collection(uuid, integer, integer)',
    'count_recipes_by_collection(uuid)',
    'can_access_collection(uuid)',
    'has_collection_access(uuid)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', fn);
  END LOOP;
END;
$$;

------------------------------------------------------------------------------------
-- Keep curated-collection recipes OUT of the personal/owner browse + search.
-- Curated recipes are owner-owned (per the curated design), so without this they would
-- appear in the owner's "my recipes" and search results. They surface only through
-- list_recipes_by_collection. Re-creates V57 list_recipes/count_recipes + V38
-- search_recipes verbatim with one added NOT EXISTS; CREATE OR REPLACE preserves grants.
------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_recipes(
  p_owner_only boolean DEFAULT false, p_categories text[] DEFAULT NULL,
  p_limit integer DEFAULT 50, p_offset integer DEFAULT 0, p_owner_ids uuid[] DEFAULT NULL
) RETURNS SETOF public.user_recipes LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT ur.*
  FROM public.user_recipes ur
  WHERE ur.id = ANY (ARRAY(
    SELECT r.id FROM public.recipes r
    WHERE (p_owner_ids IS NULL OR public.get_user_id(r.owner) = ANY (p_owner_ids))
      AND (NOT p_owner_only OR r.owner = (current_setting('request.jwt.claims', true)::jsonb ->> 'email'))
      AND (NOT r.is_featured OR r.owner = (current_setting('request.jwt.claims', true)::jsonb ->> 'email'))
      AND (p_categories IS NULL OR array_length(p_categories, 1) IS NULL OR EXISTS (
            SELECT 1 FROM public.recipe_categories rc JOIN public.categories c ON c.id = rc.category
            WHERE rc.recipe = r.id AND c.name = ANY (p_categories)))
      AND NOT EXISTS (SELECT 1 FROM public.collection_recipes cr JOIN public.collections col ON col.id = cr.collection_id
                      WHERE cr.recipe_id = r.id AND col.kind = 'curated')
    ORDER BY r.date_published DESC
    LIMIT GREATEST(p_limit, 0) OFFSET GREATEST(p_offset, 0)
  ))
  ORDER BY ur.date_published DESC;
$$;

CREATE OR REPLACE FUNCTION public.count_recipes(
  p_owner_only boolean DEFAULT false, p_categories text[] DEFAULT NULL, p_owner_ids uuid[] DEFAULT NULL
) RETURNS bigint LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT count(*) FROM public.recipes r
  WHERE (p_owner_ids IS NULL OR public.get_user_id(r.owner) = ANY (p_owner_ids))
    AND (NOT p_owner_only OR r.owner = (current_setting('request.jwt.claims', true)::jsonb ->> 'email'))
    AND (NOT r.is_featured OR r.owner = (current_setting('request.jwt.claims', true)::jsonb ->> 'email'))
    AND (p_categories IS NULL OR array_length(p_categories, 1) IS NULL OR EXISTS (
          SELECT 1 FROM public.recipe_categories rc JOIN public.categories c ON c.id = rc.category
          WHERE rc.recipe = r.id AND c.name = ANY (p_categories)))
    AND NOT EXISTS (SELECT 1 FROM public.collection_recipes cr JOIN public.collections col ON col.id = cr.collection_id
                    WHERE cr.recipe_id = r.id AND col.kind = 'curated');
$$;

CREATE OR REPLACE FUNCTION public.search_recipes(
  p_query text, p_owner_only boolean DEFAULT false, p_category text DEFAULT NULL,
  p_limit integer DEFAULT 50, p_offset integer DEFAULT 0, p_owner_ids uuid[] DEFAULT NULL
) RETURNS SETOF public.user_recipes LANGUAGE sql STABLE SET search_path TO 'public', 'extensions' AS $$
  SELECT ur.* FROM user_recipes ur JOIN recipes r ON r.id = ur.id
  WHERE COALESCE(trim(p_query), '') != '' AND r.search_text ILIKE '%' || escape_like_pattern(p_query) || '%'
    AND (NOT p_owner_only OR ur.is_owner = TRUE)
    AND (p_owner_ids IS NULL OR ur.owner_id = ANY(p_owner_ids))
    AND (p_category IS NULL OR p_category = ANY(ur.categories))
    AND NOT EXISTS (SELECT 1 FROM collection_recipes cr JOIN collections col ON col.id = cr.collection_id
                    WHERE cr.recipe_id = ur.id AND col.kind = 'curated')
  ORDER BY CASE WHEN ur.name ILIKE escape_like_pattern(p_query) THEN 0 WHEN ur.name ILIKE escape_like_pattern(p_query) || '%' THEN 1 WHEN ur.name ILIKE '%' || escape_like_pattern(p_query) || '%' THEN 2 ELSE 3 END,
           word_similarity(p_query, ur.name) DESC, ur.date_published DESC
  LIMIT p_limit OFFSET p_offset;
$$;
