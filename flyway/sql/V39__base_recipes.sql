-- Base recipe pool for meal planner suggestions
-- ~200 curated Swedish dinner recipes from public sources (JSON-LD data)
-- Used as suggestion pool so new users get real recipes without AI generation costs

CREATE TABLE base_recipes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL CHECK (length(name) >= 1),
    description text NOT NULL DEFAULT '',
    author text,
    source_url text NOT NULL UNIQUE,
    source_site text NOT NULL,
    prep_time integer,
    cook_time integer,
    recipe_yield integer DEFAULT 4,
    recipe_yield_name text DEFAULT 'portioner',
    diet_type text NOT NULL CHECK (diet_type IN ('vegan', 'vegetarian', 'pescetarian', 'meat')),
    categories text[] DEFAULT '{}',
    ingredients jsonb NOT NULL,   -- [{group_name, ingredients: [{name, measurement, quantity}]}]
    instructions jsonb NOT NULL   -- [{group_name, instructions: [{step}]}]
);

-- Indexes
CREATE INDEX idx_base_recipes_diet_type ON base_recipes (diet_type);
CREATE INDEX idx_base_recipes_categories ON base_recipes USING GIN (categories);

-- RLS: read-only for authenticated users
ALTER TABLE base_recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "base_recipes_select" ON base_recipes
    FOR SELECT TO authenticated USING (true);

-- Grant access
GRANT SELECT ON base_recipes TO authenticated;

-- RPC to fetch random base recipes with optional filters
CREATE OR REPLACE FUNCTION get_base_recipes(
    p_diet_types text[] DEFAULT NULL,
    p_categories text[] DEFAULT NULL,
    p_limit integer DEFAULT 50
)
RETURNS SETOF base_recipes
LANGUAGE sql STABLE
SET search_path TO 'public'
AS $$
    SELECT *
    FROM base_recipes
    WHERE (p_diet_types IS NULL OR diet_type = ANY(p_diet_types))
      AND (p_categories IS NULL OR categories && p_categories)
    ORDER BY random()
    LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION get_base_recipes(text[], text[], integer) TO authenticated;
