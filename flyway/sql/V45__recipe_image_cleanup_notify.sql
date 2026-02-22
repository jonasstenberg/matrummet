-- Notify image service when recipe images become orphaned.
-- Fires on DELETE or UPDATE of image/thumbnail columns.
-- Only notifies if no other recipe still references the old image ID.

CREATE OR REPLACE FUNCTION notify_image_cleanup() RETURNS trigger AS $$
DECLARE
  check_images text[];
  img text;
  ref_count integer;
BEGIN
  check_images := ARRAY[]::text[];

  IF TG_OP = 'DELETE' THEN
    IF OLD.image IS NOT NULL THEN
      check_images := array_append(check_images, OLD.image);
    END IF;
    -- Only check thumbnail separately if it differs from image
    IF OLD.thumbnail IS NOT NULL AND OLD.thumbnail IS DISTINCT FROM OLD.image THEN
      check_images := array_append(check_images, OLD.thumbnail);
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.image IS DISTINCT FROM NEW.image AND OLD.image IS NOT NULL THEN
      check_images := array_append(check_images, OLD.image);
    END IF;
    IF OLD.thumbnail IS DISTINCT FROM NEW.thumbnail AND OLD.thumbnail IS NOT NULL
       AND OLD.thumbnail IS DISTINCT FROM OLD.image THEN
      check_images := array_append(check_images, OLD.thumbnail);
    END IF;
  END IF;

  -- For each candidate, check if any recipe still references it
  FOREACH img IN ARRAY check_images LOOP
    SELECT count(*) INTO ref_count
    FROM recipes
    WHERE image = img OR thumbnail = img;

    IF ref_count = 0 THEN
      PERFORM pg_notify('image_cleanup', json_build_object('image_id', img)::text);
    END IF;
  END LOOP;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recipe_image_cleanup
  AFTER DELETE OR UPDATE OF image, thumbnail ON recipes
  FOR EACH ROW
  EXECUTE FUNCTION notify_image_cleanup();
