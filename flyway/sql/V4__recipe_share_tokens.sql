-- Migration: Recipe share tokens
-- Enables share links for recipes (Apple-style: tap share, get link, anyone can view)

-- Create table for share tokens
CREATE TABLE recipe_share_tokens (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ, -- NULL means never expires
    revoked_at TIMESTAMPTZ, -- NULL means not revoked
    view_count INTEGER NOT NULL DEFAULT 0,
    last_viewed_at TIMESTAMPTZ
);

-- Index for fast token lookups
CREATE INDEX recipe_share_tokens_token_idx ON recipe_share_tokens(token);

-- Index for listing tokens by recipe
CREATE INDEX recipe_share_tokens_recipe_id_idx ON recipe_share_tokens(recipe_id);

-- Enable RLS
ALTER TABLE recipe_share_tokens ENABLE ROW LEVEL SECURITY;

-- RLS: Owner can see their tokens (via recipe ownership)
CREATE POLICY recipe_share_tokens_owner_select ON recipe_share_tokens
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM recipes r
            WHERE r.id = recipe_share_tokens.recipe_id
            AND r.owner = current_setting('request.jwt.claims', true)::jsonb->>'email'
        )
    );

-- RLS: Owner can insert tokens for their recipes
CREATE POLICY recipe_share_tokens_owner_insert ON recipe_share_tokens
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM recipes r
            WHERE r.id = recipe_share_tokens.recipe_id
            AND r.owner = current_setting('request.jwt.claims', true)::jsonb->>'email'
        )
    );

-- RLS: Owner can update (revoke) their tokens
CREATE POLICY recipe_share_tokens_owner_update ON recipe_share_tokens
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM recipes r
            WHERE r.id = recipe_share_tokens.recipe_id
            AND r.owner = current_setting('request.jwt.claims', true)::jsonb->>'email'
        )
    );

-- RLS: Owner can delete their tokens
CREATE POLICY recipe_share_tokens_owner_delete ON recipe_share_tokens
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM recipes r
            WHERE r.id = recipe_share_tokens.recipe_id
            AND r.owner = current_setting('request.jwt.claims', true)::jsonb->>'email'
        )
    );

-- Grant table access to authenticated role
GRANT SELECT, INSERT, UPDATE, DELETE ON recipe_share_tokens TO authenticated;

-- Grant SELECT to anon for get_shared_recipe function
GRANT SELECT ON recipe_share_tokens TO anon;


-- Function: Generate a URL-safe random token
CREATE OR REPLACE FUNCTION generate_share_token()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    v_bytes BYTEA;
    v_token TEXT;
BEGIN
    -- Generate 24 random bytes (will be 32 chars in base64)
    v_bytes := extensions.gen_random_bytes(24);
    -- Encode to base64 and make URL-safe (replace + with -, / with _, remove padding)
    v_token := regexp_replace(
        encode(v_bytes, 'base64'),
        '[+/=]',
        CASE
            WHEN substring(encode(v_bytes, 'base64') from '[+]') IS NOT NULL THEN '-'
            WHEN substring(encode(v_bytes, 'base64') from '[/]') IS NOT NULL THEN '_'
            ELSE ''
        END,
        'g'
    );
    -- Actually do proper replacement
    v_token := encode(v_bytes, 'base64');
    v_token := replace(v_token, '+', '-');
    v_token := replace(v_token, '/', '_');
    v_token := replace(v_token, '=', '');
    RETURN v_token;
END;
$$;


-- Function: Create a share token for a recipe
-- Returns the generated token
CREATE OR REPLACE FUNCTION create_share_token(
    p_recipe_id UUID,
    p_expires_days INTEGER DEFAULT NULL
)
RETURNS TABLE(token TEXT, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_email TEXT;
    v_token TEXT;
    v_expires_at TIMESTAMPTZ;
    v_token_id UUID;
BEGIN
    -- Get current user email from JWT
    v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

    IF v_user_email IS NULL THEN
        RAISE EXCEPTION 'not-authenticated';
    END IF;

    -- Verify user owns the recipe
    IF NOT EXISTS (
        SELECT 1 FROM recipes r
        WHERE r.id = p_recipe_id
        AND r.owner = v_user_email
    ) THEN
        RAISE EXCEPTION 'access-denied';
    END IF;

    -- Generate unique token
    LOOP
        v_token := generate_share_token();
        -- Check uniqueness
        EXIT WHEN NOT EXISTS (
            SELECT 1 FROM recipe_share_tokens rst WHERE rst.token = v_token
        );
    END LOOP;

    -- Calculate expiration if provided
    IF p_expires_days IS NOT NULL THEN
        v_expires_at := now() + (p_expires_days || ' days')::INTERVAL;
    END IF;

    -- Insert the token
    INSERT INTO recipe_share_tokens (recipe_id, token, expires_at)
    VALUES (p_recipe_id, v_token, v_expires_at)
    RETURNING recipe_share_tokens.id INTO v_token_id;

    RETURN QUERY SELECT v_token, v_expires_at;
END;
$$;

GRANT EXECUTE ON FUNCTION create_share_token(UUID, INTEGER) TO authenticated;


-- Function: Revoke a share token
CREATE OR REPLACE FUNCTION revoke_share_token(p_token TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_email TEXT;
    v_updated BOOLEAN;
BEGIN
    -- Get current user email from JWT
    v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

    IF v_user_email IS NULL THEN
        RAISE EXCEPTION 'not-authenticated';
    END IF;

    -- Revoke the token (only if user owns the recipe)
    UPDATE recipe_share_tokens rst
    SET revoked_at = now()
    WHERE rst.token = p_token
    AND rst.revoked_at IS NULL
    AND EXISTS (
        SELECT 1 FROM recipes r
        WHERE r.id = rst.recipe_id
        AND r.owner = v_user_email
    );

    v_updated := FOUND;

    RETURN v_updated;
END;
$$;

GRANT EXECUTE ON FUNCTION revoke_share_token(TEXT) TO authenticated;


-- Function: Get a shared recipe by token (accessible by anyone, including anon)
-- Returns the full recipe data if the token is valid
CREATE OR REPLACE FUNCTION get_shared_recipe(p_token TEXT)
RETURNS TABLE(
    id UUID,
    name TEXT,
    author TEXT,
    description TEXT,
    url TEXT,
    recipe_yield INTEGER,
    recipe_yield_name TEXT,
    prep_time INTEGER,
    cook_time INTEGER,
    cuisine TEXT,
    image TEXT,
    thumbnail TEXT,
    date_published TIMESTAMPTZ,
    date_modified TIMESTAMPTZ,
    categories TEXT[],
    ingredient_groups JSONB,
    ingredients JSONB,
    instruction_groups JSONB,
    instructions JSONB,
    owner_name TEXT,
    shared_by_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_token_record RECORD;
    v_recipe_id UUID;
BEGIN
    -- Find the token
    SELECT rst.*, r.owner as recipe_owner
    INTO v_token_record
    FROM recipe_share_tokens rst
    JOIN recipes r ON r.id = rst.recipe_id
    WHERE rst.token = p_token;

    -- Check if token exists
    IF v_token_record.id IS NULL THEN
        RETURN; -- Return empty result
    END IF;

    -- Check if token is revoked
    IF v_token_record.revoked_at IS NOT NULL THEN
        RETURN; -- Return empty result
    END IF;

    -- Check if token is expired
    IF v_token_record.expires_at IS NOT NULL AND v_token_record.expires_at < now() THEN
        RETURN; -- Return empty result
    END IF;

    v_recipe_id := v_token_record.recipe_id;

    -- Update view count and last viewed
    UPDATE recipe_share_tokens rst
    SET view_count = view_count + 1,
        last_viewed_at = now()
    WHERE rst.token = p_token;

    -- Return the recipe data with aggregated arrays
    RETURN QUERY
    SELECT
        r.id,
        r.name,
        r.author,
        r.description,
        r.url,
        r.recipe_yield,
        r.recipe_yield_name,
        r.prep_time,
        r.cook_time,
        r.cuisine,
        r.image,
        r.thumbnail,
        r.date_published,
        r.date_modified,
        COALESCE(
            ARRAY(
                SELECT c.name
                FROM recipe_categories rc
                JOIN categories c ON c.id = rc.category
                WHERE rc.recipe = r.id
                ORDER BY c.name
            ),
            '{}'::TEXT[]
        ) AS categories,
        COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id', ig.id,
                        'name', ig.name,
                        'sort_order', ig.sort_order
                    ) ORDER BY ig.sort_order
                )
                FROM ingredient_groups ig
                WHERE ig.recipe_id = r.id
            ),
            '[]'::JSONB
        ) AS ingredient_groups,
        COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id', i.id,
                        'name', i.name,
                        'measurement', i.measurement,
                        'quantity', i.quantity,
                        'form', i.form,
                        'group_id', i.group_id,
                        'sort_order', i.sort_order
                    ) ORDER BY
                        COALESCE((SELECT ig.sort_order FROM ingredient_groups ig WHERE ig.id = i.group_id), -1),
                        i.sort_order
                )
                FROM ingredients i
                WHERE i.recipe_id = r.id
            ),
            '[]'::JSONB
        ) AS ingredients,
        COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id', isg.id,
                        'name', isg.name,
                        'sort_order', isg.sort_order
                    ) ORDER BY isg.sort_order
                )
                FROM instruction_groups isg
                WHERE isg.recipe_id = r.id
            ),
            '[]'::JSONB
        ) AS instruction_groups,
        COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id', ins.id,
                        'step', ins.step,
                        'group_id', ins.group_id,
                        'sort_order', ins.sort_order
                    ) ORDER BY
                        COALESCE((SELECT isg.sort_order FROM instruction_groups isg WHERE isg.id = ins.group_id), -1),
                        ins.sort_order
                )
                FROM instructions ins
                WHERE ins.recipe_id = r.id
            ),
            '[]'::JSONB
        ) AS instructions,
        u.name AS owner_name,
        u.name AS shared_by_name
    FROM recipes r
    JOIN users u ON u.email = r.owner
    WHERE r.id = v_recipe_id;
END;
$$;

-- Grant execute to both anon and authenticated
GRANT EXECUTE ON FUNCTION get_shared_recipe(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_shared_recipe(TEXT) TO authenticated;


-- Function: Get all share tokens for a recipe (owner only)
CREATE OR REPLACE FUNCTION get_recipe_share_tokens(p_recipe_id UUID)
RETURNS TABLE(
    id UUID,
    token TEXT,
    created_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    view_count INTEGER,
    last_viewed_at TIMESTAMPTZ,
    is_active BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_email TEXT;
BEGIN
    -- Get current user email from JWT
    v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

    IF v_user_email IS NULL THEN
        RAISE EXCEPTION 'not-authenticated';
    END IF;

    -- Verify user owns the recipe
    IF NOT EXISTS (
        SELECT 1 FROM recipes r
        WHERE r.id = p_recipe_id
        AND r.owner = v_user_email
    ) THEN
        RAISE EXCEPTION 'access-denied';
    END IF;

    -- Return all tokens for this recipe
    RETURN QUERY
    SELECT
        rst.id,
        rst.token,
        rst.created_at,
        rst.expires_at,
        rst.revoked_at,
        rst.view_count,
        rst.last_viewed_at,
        (rst.revoked_at IS NULL AND (rst.expires_at IS NULL OR rst.expires_at > now())) AS is_active
    FROM recipe_share_tokens rst
    WHERE rst.recipe_id = p_recipe_id
    ORDER BY rst.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_recipe_share_tokens(UUID) TO authenticated;


-- Function: Copy a shared recipe to current user's collection
-- Uses a token to copy a recipe without needing household access
CREATE OR REPLACE FUNCTION copy_shared_recipe(p_token TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_email TEXT;
    v_token_record RECORD;
    v_source_recipe RECORD;
    v_new_recipe_id UUID;
    v_source_owner_name TEXT;
BEGIN
    -- Get current user email from JWT
    v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';

    IF v_user_email IS NULL THEN
        RAISE EXCEPTION 'not-authenticated';
    END IF;

    -- Find and validate the token
    SELECT rst.*
    INTO v_token_record
    FROM recipe_share_tokens rst
    WHERE rst.token = p_token
    AND rst.revoked_at IS NULL
    AND (rst.expires_at IS NULL OR rst.expires_at > now());

    IF v_token_record.id IS NULL THEN
        RAISE EXCEPTION 'invalid-or-expired-token';
    END IF;

    -- Get source recipe details
    SELECT r.*, u.name as owner_name
    INTO v_source_recipe
    FROM recipes r
    JOIN users u ON u.email = r.owner
    WHERE r.id = v_token_record.recipe_id;

    IF v_source_recipe.id IS NULL THEN
        RAISE EXCEPTION 'recipe-not-found';
    END IF;

    v_source_owner_name := v_source_recipe.owner_name;

    -- Create the new recipe (copy)
    INSERT INTO recipes (
        name, author, description, url,
        recipe_yield, recipe_yield_name, prep_time, cook_time,
        cuisine, image, thumbnail,
        owner, visibility,
        copied_from_recipe_id, copied_from_user_id
    )
    SELECT
        v_source_recipe.name,
        v_source_recipe.author,
        v_source_recipe.description,
        v_source_recipe.url,
        v_source_recipe.recipe_yield,
        v_source_recipe.recipe_yield_name,
        v_source_recipe.prep_time,
        v_source_recipe.cook_time,
        v_source_recipe.cuisine,
        v_source_recipe.image,
        v_source_recipe.thumbnail,
        v_user_email,
        'private',
        v_source_recipe.id,
        v_source_recipe.owner
    RETURNING id INTO v_new_recipe_id;

    -- Copy categories (recipe_categories uses 'recipe' and 'category' columns, plus 'owner')
    INSERT INTO recipe_categories (recipe, category, owner)
    SELECT v_new_recipe_id, rc.category, v_user_email
    FROM recipe_categories rc
    WHERE rc.recipe = v_source_recipe.id;

    -- Copy ingredient groups and maintain mapping (include owner column)
    WITH group_mapping AS (
        INSERT INTO ingredient_groups (recipe_id, name, sort_order, owner)
        SELECT v_new_recipe_id, ig.name, ig.sort_order, v_user_email
        FROM ingredient_groups ig
        WHERE ig.recipe_id = v_source_recipe.id
        RETURNING id, name, sort_order
    )
    -- Copy ingredients with new group IDs (include owner column)
    INSERT INTO ingredients (recipe_id, name, measurement, quantity, form, group_id, sort_order, food_id, unit_id, owner)
    SELECT
        v_new_recipe_id,
        i.name,
        i.measurement,
        i.quantity,
        i.form,
        gm.id, -- New group ID from mapping
        i.sort_order,
        i.food_id,
        i.unit_id,
        v_user_email
    FROM ingredients i
    LEFT JOIN ingredient_groups old_ig ON old_ig.id = i.group_id
    LEFT JOIN group_mapping gm ON gm.name = old_ig.name AND gm.sort_order = old_ig.sort_order
    WHERE i.recipe_id = v_source_recipe.id;

    -- Copy instruction groups (include owner column)
    WITH inst_group_mapping AS (
        INSERT INTO instruction_groups (recipe_id, name, sort_order, owner)
        SELECT v_new_recipe_id, isg.name, isg.sort_order, v_user_email
        FROM instruction_groups isg
        WHERE isg.recipe_id = v_source_recipe.id
        RETURNING id, name, sort_order
    )
    -- Copy instructions with new group IDs (include owner column)
    INSERT INTO instructions (recipe_id, step, group_id, sort_order, owner)
    SELECT
        v_new_recipe_id,
        ins.step,
        igm.id, -- New group ID from mapping
        ins.sort_order,
        v_user_email
    FROM instructions ins
    LEFT JOIN instruction_groups old_isg ON old_isg.id = ins.group_id
    LEFT JOIN inst_group_mapping igm ON igm.name = old_isg.name AND igm.sort_order = old_isg.sort_order
    WHERE ins.recipe_id = v_source_recipe.id;

    RETURN v_new_recipe_id;
END;
$$;

GRANT EXECUTE ON FUNCTION copy_shared_recipe(TEXT) TO authenticated;
