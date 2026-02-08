-- Migration: Remove public recipes functionality
-- Only signed-in users can see recipes (their own + household members)

-- Update existing public recipes to private
UPDATE recipes SET visibility = 'private' WHERE visibility = 'public';

-- Add constraint to prevent public visibility in the future
ALTER TABLE recipes ADD CONSTRAINT recipes_visibility_private_only
  CHECK (visibility = 'private');

-- Drop public-related RLS policies
DROP POLICY IF EXISTS recipes_anon_select ON recipes;
DROP POLICY IF EXISTS recipes_public_select ON recipes;

-- Drop search function for public recipes FIRST (depends on public_recipes view)
DROP FUNCTION IF EXISTS search_public_recipes(text, text, uuid, integer, integer);

-- Drop public_recipes view
DROP VIEW IF EXISTS public_recipes;

-- Drop partial index for public visibility (no longer needed)
DROP INDEX IF EXISTS recipes_visibility_public_idx;
