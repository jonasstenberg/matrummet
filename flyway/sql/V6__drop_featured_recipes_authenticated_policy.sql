-- Featured recipes should only be visible on the landing page (anonymous users).
-- Authenticated users don't need a separate RLS policy for featured recipes —
-- public featured recipes are already accessible via recipes_public_select,
-- and the API layer filters them out of listings.

DROP POLICY IF EXISTS recipes_featured_select ON recipes;
