-- Add NOT NULL constraint to recipes.owner
-- All other owner columns already have NOT NULL, but recipes.owner was missing it.
-- This is important because RLS policies depend on owner = jwt_email, and a NULL
-- owner would make the recipe invisible to everyone and un-deletable by non-admins.

-- Safety check: fail migration if any NULL owners exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM recipes WHERE owner IS NULL) THEN
    RAISE EXCEPTION 'Cannot add NOT NULL constraint: recipes with NULL owner exist. Please fix data first.';
  END IF;
END;
$$;

ALTER TABLE recipes ALTER COLUMN owner SET NOT NULL;
