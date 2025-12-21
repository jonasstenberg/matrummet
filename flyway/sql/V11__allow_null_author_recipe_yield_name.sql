-- V11: Make author and recipe_yield_name columns nullable in recipes table
-- This allows recipes imported from external sources without this information

-- Drop the CHECK constraint on author
-- Note: PostgreSQL doesn't support DROP CONSTRAINT IF EXISTS for CHECK constraints
-- We need to find the constraint name first
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  -- Find the CHECK constraint on author column
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  WHERE rel.relname = 'recipes'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) LIKE '%length(author)%';

  -- Drop the constraint if it exists
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE recipes DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

-- Make the author column nullable
ALTER TABLE recipes ALTER COLUMN author DROP NOT NULL;

-- Make the recipe_yield_name column nullable
ALTER TABLE recipes ALTER COLUMN recipe_yield_name DROP NOT NULL;
