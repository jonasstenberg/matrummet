-- Remove .webp extension from image filenames in recipes table.
-- The app previously stored image filenames with .webp extension (e.g., abc123.webp).
-- After migrating to a new image storage structure, filenames should be just the UUID
-- without extension (e.g., abc123).

UPDATE recipes
SET image = REPLACE(image, '.webp', '')
WHERE image IS NOT NULL
  AND image LIKE '%.webp'
  AND image NOT LIKE 'http%';
