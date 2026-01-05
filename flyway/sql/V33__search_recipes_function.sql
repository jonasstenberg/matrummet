-- V33: Add search_recipes RPC function with trigram substring matching
-- Solves the problem where "sås" should match "vaniljsås" and "lamm" matches "Lammlåda"
-- Uses pg_trgm extension for fast substring search with GIN index

-- =============================================================================
-- 1. Add search_text column with trigram GIN index
-- =============================================================================

-- Add search_text column (denormalized, maintained by triggers)
-- Contains: name + description + ingredient names for fast substring search
-- Note: On INSERT, search_text initially contains only name+description.
-- The ingredient trigger provides eventual consistency when ingredients are added.
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS search_text TEXT;

-- Create trigram GIN index for fast ILIKE '%query%' matching
-- This index supports: ILIKE, similarity %, word_similarity <%, and more
CREATE INDEX IF NOT EXISTS recipes_search_text_trgm_idx
  ON recipes USING GIN (search_text gin_trgm_ops);

-- =============================================================================
-- 2. Helper function to escape LIKE metacharacters
-- =============================================================================

CREATE OR REPLACE FUNCTION escape_like_pattern(p_text TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  -- Escape \, %, and _ which have special meaning in LIKE patterns
  SELECT replace(replace(replace(p_text, '\', '\\'), '%', '\%'), '_', '\_')
$$;

-- =============================================================================
-- 3. Function to rebuild search_text for a recipe
-- =============================================================================

CREATE OR REPLACE FUNCTION rebuild_recipe_search_text(p_recipe_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE recipes r SET
    search_text = concat_ws(' ',
      r.name,
      r.description,
      (SELECT string_agg(COALESCE(f.name, i.name), ' ')
       FROM ingredients i
       LEFT JOIN foods f ON i.food_id = f.id AND f.status = 'approved'
       WHERE i.recipe_id = p_recipe_id)
    )
  WHERE r.id = p_recipe_id;
END;
$$;

-- =============================================================================
-- 4. Trigger on recipes table (for name/description changes)
-- =============================================================================

CREATE OR REPLACE FUNCTION trigger_recipe_search_text()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Build search_text inline for the NEW row
  -- Note: On INSERT, ingredients don't exist yet, so only name+description are included.
  -- The ingredient trigger will rebuild search_text when ingredients are added.
  NEW.search_text := concat_ws(' ',
    NEW.name,
    NEW.description,
    (SELECT string_agg(COALESCE(f.name, i.name), ' ')
     FROM ingredients i
     LEFT JOIN foods f ON i.food_id = f.id AND f.status = 'approved'
     WHERE i.recipe_id = NEW.id)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS recipe_search_text_trigger ON recipes;
CREATE TRIGGER recipe_search_text_trigger
  BEFORE INSERT OR UPDATE OF name, description ON recipes
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recipe_search_text();

-- =============================================================================
-- 5. Trigger on ingredients table (for ingredient changes)
-- =============================================================================

CREATE OR REPLACE FUNCTION trigger_ingredient_search_text()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_recipe_id UUID;
BEGIN
  -- Get the affected recipe_id (handles INSERT, UPDATE, DELETE)
  v_recipe_id := COALESCE(NEW.recipe_id, OLD.recipe_id);

  -- Rebuild the parent recipe's search_text
  PERFORM rebuild_recipe_search_text(v_recipe_id);

  RETURN NULL; -- AFTER trigger, return value is ignored
END;
$$;

DROP TRIGGER IF EXISTS ingredient_search_text_trigger ON ingredients;
CREATE TRIGGER ingredient_search_text_trigger
  AFTER INSERT OR UPDATE OR DELETE ON ingredients
  FOR EACH ROW
  EXECUTE FUNCTION trigger_ingredient_search_text();

-- =============================================================================
-- 6. Trigger on foods table (for approved food name changes or status changes)
-- =============================================================================

CREATE OR REPLACE FUNCTION trigger_food_search_text()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Rebuild if name changed, or if status changed involving 'approved'
  -- This handles: approved→rejected (fallback to ingredient.name)
  --               rejected→approved (use new food.name)
  --               name change while approved (update to new name)
  IF (TG_OP = 'UPDATE' AND
      (OLD.name IS DISTINCT FROM NEW.name OR OLD.status IS DISTINCT FROM NEW.status) AND
      (NEW.status = 'approved' OR OLD.status = 'approved')) THEN
    -- Rebuild search_text for all recipes using this food
    -- Note: For common foods (e.g., "salt"), this may touch many recipes
    UPDATE recipes r SET
      search_text = concat_ws(' ',
        r.name,
        r.description,
        (SELECT string_agg(COALESCE(f.name, i.name), ' ')
         FROM ingredients i
         LEFT JOIN foods f ON i.food_id = f.id AND f.status = 'approved'
         WHERE i.recipe_id = r.id)
      )
    WHERE r.id IN (
      SELECT DISTINCT recipe_id FROM ingredients WHERE food_id = NEW.id
    );
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS food_search_text_trigger ON foods;
CREATE TRIGGER food_search_text_trigger
  AFTER UPDATE ON foods
  FOR EACH ROW
  EXECUTE FUNCTION trigger_food_search_text();

-- =============================================================================
-- 7. Populate search_text for all existing recipes
-- =============================================================================

UPDATE recipes r SET
  search_text = concat_ws(' ',
    r.name,
    r.description,
    (SELECT string_agg(COALESCE(f.name, i.name), ' ')
     FROM ingredients i
     LEFT JOIN foods f ON i.food_id = f.id AND f.status = 'approved'
     WHERE i.recipe_id = r.id)
  )
WHERE search_text IS NULL OR search_text = '';  -- Only backfill missing

-- =============================================================================
-- 8. Main search function with optimized ranking
-- =============================================================================

CREATE OR REPLACE FUNCTION search_recipes(
  p_query TEXT,
  p_owner TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS SETOF recipes_and_categories
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT rac.*
  FROM recipes_and_categories rac
  JOIN recipes r ON r.id = rac.id
  WHERE
    -- Guard against NULL/empty query
    COALESCE(trim(p_query), '') != ''
    -- Trigram ILIKE uses GIN index for large tables
    -- escape_like_pattern prevents %, _, \ from being interpreted as wildcards
    AND r.search_text ILIKE '%' || escape_like_pattern(p_query) || '%'
    -- Optional filters
    AND (p_owner IS NULL OR rac.owner = p_owner)
    AND (p_category IS NULL OR p_category = ANY(rac.categories))
  ORDER BY
    -- Priority 1: Exact name match
    CASE WHEN rac.name ILIKE escape_like_pattern(p_query) THEN 0
    -- Priority 2: Name starts with query
         WHEN rac.name ILIKE escape_like_pattern(p_query) || '%' THEN 1
    -- Priority 3: Name contains query
         WHEN rac.name ILIKE '%' || escape_like_pattern(p_query) || '%' THEN 2
    -- Priority 4: Match in description/ingredients
         ELSE 3
    END,
    -- Secondary: word_similarity for better substring ranking
    -- word_similarity('lamm', 'Lammlåda') = 0.8 vs similarity = 0.18
    word_similarity(p_query, rac.name) DESC,
    -- Tertiary: newest first
    rac.date_published DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;

GRANT EXECUTE ON FUNCTION search_recipes(TEXT, TEXT, TEXT, INTEGER, INTEGER) TO "anon";
GRANT EXECUTE ON FUNCTION escape_like_pattern(TEXT) TO "anon";

COMMENT ON FUNCTION search_recipes IS
  'Substring search for recipes using pg_trgm. Finds "sås" in "vaniljsås".
   Uses GIN trigram index for fast ILIKE matching at scale.
   Results ranked by: exact match > prefix > contains > word_similarity.
   Returns empty result set if query is NULL or empty.';

-- =============================================================================
-- 9. Search function for liked recipes
-- =============================================================================

CREATE OR REPLACE FUNCTION search_liked_recipes(
  p_query TEXT,
  p_category TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  date_published TIMESTAMPTZ,
  date_modified TIMESTAMPTZ,
  name TEXT,
  author TEXT,
  url TEXT,
  recipe_yield INTEGER,
  recipe_yield_name TEXT,
  prep_time INTEGER,
  cook_time INTEGER,
  cuisine TEXT,
  description TEXT,
  image TEXT,
  thumbnail TEXT,
  owner TEXT,
  tsv TSVECTOR,
  categories TEXT[],
  ingredient_groups JSONB,
  ingredients JSONB,
  instruction_groups JSONB,
  instructions JSONB,
  full_tsv TSVECTOR,
  is_liked BOOLEAN,
  liked_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT lr.*
  FROM liked_recipes lr
  JOIN recipes r ON r.id = lr.id
  WHERE
    -- Guard against NULL/empty query
    COALESCE(trim(p_query), '') != ''
    AND r.search_text ILIKE '%' || escape_like_pattern(p_query) || '%'
    AND (p_category IS NULL OR p_category = ANY(lr.categories))
  ORDER BY
    CASE WHEN lr.name ILIKE escape_like_pattern(p_query) THEN 0
         WHEN lr.name ILIKE escape_like_pattern(p_query) || '%' THEN 1
         WHEN lr.name ILIKE '%' || escape_like_pattern(p_query) || '%' THEN 2
         ELSE 3
    END,
    word_similarity(p_query, lr.name) DESC,
    lr.liked_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;

GRANT EXECUTE ON FUNCTION search_liked_recipes(TEXT, TEXT, INTEGER, INTEGER) TO "anon";
