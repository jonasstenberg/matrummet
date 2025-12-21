-- V8: Allow NULL values for prep_time and cook_time
-- This migration makes prep_time and cook_time columns nullable
-- to support imported recipes that don't have timing information.

-- Drop the existing NOT NULL constraints and re-add columns as nullable
-- The CHECK constraint (>= 0) remains to validate non-null values

-- 1. Make prep_time nullable
ALTER TABLE recipes
  ALTER COLUMN prep_time DROP NOT NULL;

-- 2. Make cook_time nullable
ALTER TABLE recipes
  ALTER COLUMN cook_time DROP NOT NULL;

-- 3. Update existing rows: convert 0 values to NULL (since 0 was the default for "no value")
UPDATE recipes
  SET prep_time = NULL
  WHERE prep_time = 0;

UPDATE recipes
  SET cook_time = NULL
  WHERE cook_time = 0;

-- 4. Update the default value to NULL instead of 0
ALTER TABLE recipes
  ALTER COLUMN prep_time SET DEFAULT NULL;

ALTER TABLE recipes
  ALTER COLUMN cook_time SET DEFAULT NULL;

-- Note: The CHECK constraints (prep_time >= 0 AND cook_time >= 0) remain active
-- and will validate non-null values. NULL values are allowed and pass CHECK constraints.
