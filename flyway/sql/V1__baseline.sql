-- V1: Baseline migration for Recept database
-- This migration represents the initial schema

-- =============================================================================
-- Extensions and General Setup
-- =============================================================================

-- Note: uuid-ossp is legacy; prefer gen_random_uuid() in new code
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE SCHEMA IF NOT EXISTS "auth";

ALTER DATABASE recept SET timezone TO 'UTC';
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE "anon";
    END IF;
END
$$;

GRANT "anon" TO "recept";

CREATE OR REPLACE FUNCTION set_timestamptz ()
    RETURNS TRIGGER
    AS $func$
BEGIN
    NEW.date_modified = now()::timestamptz;
    RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

-- =============================================================================
-- Users and Authentication
-- =============================================================================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL CHECK (length(name) >= 1 AND length(name) <= 255),
  measures_system TEXT DEFAULT 'metric' CHECK (measures_system IN ('metric', 'imperial')),
  email TEXT UNIQUE NOT NULL CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  provider TEXT,
  owner TEXT NOT NULL DEFAULT current_setting('request.jwt.claims', true)::jsonb->>'email'
);

CREATE INDEX users_owner_idx ON users (owner);

GRANT SELECT, UPDATE, INSERT, DELETE ON users TO "anon";

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

CREATE POLICY users_policy_select
  ON users
  FOR SELECT
  USING (owner = current_setting('request.jwt.claims', true)::jsonb->>'email');

CREATE POLICY users_policy_insert
  ON users
  FOR INSERT
  WITH CHECK (owner = current_setting('request.jwt.claims', true)::jsonb->>'email');

CREATE POLICY users_policy_update
  ON users
  FOR UPDATE
  USING (owner = current_setting('request.jwt.claims', true)::jsonb->>'email');

CREATE POLICY users_policy_delete
  ON users
  FOR DELETE
  USING (owner = current_setting('request.jwt.claims', true)::jsonb->>'email');

CREATE TABLE IF NOT EXISTS user_passwords (
  email text PRIMARY KEY REFERENCES users (email) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT NULL,
  password text NOT NULL,
  owner TEXT NOT NULL DEFAULT current_setting('request.jwt.claims', true)::jsonb->>'email'
);

GRANT SELECT, UPDATE, INSERT, DELETE ON user_passwords TO "anon";

ALTER TABLE user_passwords ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_passwords FORCE ROW LEVEL SECURITY;

CREATE POLICY user_passwords_policy_select
  ON user_passwords
  FOR SELECT
  USING (owner = current_setting('request.jwt.claims', true)::jsonb->>'email');

CREATE POLICY user_passwords_policy_insert
  ON user_passwords
  FOR INSERT
  WITH CHECK (owner = current_setting('request.jwt.claims', true)::jsonb->>'email');

CREATE POLICY user_passwords_policy_update
  ON user_passwords
  FOR UPDATE
  USING (owner = current_setting('request.jwt.claims', true)::jsonb->>'email');

CREATE POLICY user_passwords_policy_delete
  ON user_passwords
  FOR DELETE
  USING (owner = current_setting('request.jwt.claims', true)::jsonb->>'email');

CREATE OR REPLACE FUNCTION
encrypt_password() RETURNS TRIGGER AS $func$
BEGIN
  -- Only encrypt if password is not null and has changed
  IF NEW.password IS NOT NULL AND (tg_op = 'INSERT' OR NEW.password <> OLD.password) THEN
    NEW.password = crypt(NEW.password, gen_salt('bf'));
  END IF;
  RETURN NEW;
END
$func$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS encrypt_password ON user_passwords;

CREATE TRIGGER encrypt_password
  BEFORE INSERT OR UPDATE ON user_passwords
  FOR EACH ROW
  EXECUTE FUNCTION encrypt_password();

CREATE OR REPLACE FUNCTION
login(login_email TEXT, login_password TEXT) RETURNS users AS $func$
DECLARE
  _role NAME;
  result users;
BEGIN
  SELECT
      user_passwords.email
  FROM
      users
      INNER JOIN user_passwords ON users.email = user_passwords.email
  WHERE
      users.email = login_email
      AND user_passwords.password = crypt(login_password, user_passwords.password)
  INTO _role;

  IF _role IS NULL THEN
    RAISE EXCEPTION 'invalid user or password';
  END IF;

  SELECT * INTO result FROM users WHERE email = login_email;

  RETURN result;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION login(TEXT,TEXT) TO anon;

CREATE OR REPLACE FUNCTION signup (p_name text, p_email text, p_password text default null, p_provider text default null)
    RETURNS jsonb
    AS $func$
DECLARE
  _user_id uuid;
  _json_result jsonb;
BEGIN
    -- Validate name
    IF p_name IS NULL OR length(p_name) < 1 OR length(p_name) > 255 THEN
      RAISE EXCEPTION 'invalid-name';
    END IF;

    -- Validate password requirements if password-based signup
    IF p_provider IS NULL THEN
      IF p_password IS NULL OR
         LENGTH(p_password) < 8 OR
         NOT (p_password ~* '.*[A-Z].*') OR
         NOT (p_password ~* '.*[a-z].*') OR
         NOT (p_password ~ '\d') THEN
        RAISE EXCEPTION 'password-not-meet-requirements';
      END IF;
    END IF;

    -- Check if user already exists
    SELECT u.id
    INTO _user_id
    FROM users u
    WHERE u.email = p_email;

    IF _user_id IS NOT NULL THEN
      RAISE EXCEPTION 'already-exists';
    ELSE
      INSERT INTO users (name, email, provider, owner) VALUES (p_name, p_email, p_provider, p_email)
      RETURNING id INTO _user_id;

      IF p_provider IS NULL THEN
        INSERT INTO user_passwords (email, password, owner) VALUES (p_email, p_password, p_email);
      END IF;
    END IF;

    _json_result := jsonb_build_object('id', _user_id);

    RETURN _json_result;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION signup(TEXT, TEXT, TEXT, TEXT) TO "anon";

CREATE OR REPLACE FUNCTION signup_provider(p_name text, p_email text, p_provider text default null)
    RETURNS jsonb
    AS $func$
DECLARE
  _json_result jsonb;
BEGIN
  SELECT INTO _json_result signup(p_name, p_email, NULL, p_provider);
  RETURN _json_result;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION signup_provider(TEXT, TEXT, TEXT) TO "anon";

CREATE OR REPLACE FUNCTION reset_password(p_email text, p_old_password text, p_new_password text)
    RETURNS void
    AS $func$
DECLARE
    stored_password text;
BEGIN
    SELECT password INTO stored_password FROM user_passwords WHERE user_passwords.email = p_email;

    IF stored_password IS NULL THEN
        RAISE EXCEPTION 'no-email-found';
    END IF;

    IF stored_password <> crypt(p_old_password, stored_password) THEN
        RAISE EXCEPTION 'incorrect-old-password';
    END IF;

    IF LENGTH(p_new_password) < 8 OR
       NOT (p_new_password ~* '.*[A-Z].*') OR
       NOT (p_new_password ~* '.*[a-z].*') OR
       NOT (p_new_password ~ '\d') THEN
        RAISE EXCEPTION 'password-not-meet-requirements';
    END IF;

    UPDATE
        user_passwords
    SET
        password = p_new_password
    WHERE
        user_passwords.email = p_email;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION reset_password TO "anon";

-- =============================================================================
-- Recipes
-- =============================================================================

CREATE TABLE IF NOT EXISTS recipes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date_published TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  date_modified TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  name TEXT NOT NULL CHECK (length(name) >= 1),
  author TEXT NOT NULL CHECK (length(author) >= 1),
  url TEXT,
  recipe_yield INTEGER DEFAULT 4 CHECK (recipe_yield > 0),
  recipe_yield_name TEXT DEFAULT 'portioner' NOT NULL,
  prep_time INTEGER DEFAULT 0 NOT NULL CHECK (prep_time >= 0),
  cook_time INTEGER DEFAULT 0 NOT NULL CHECK (cook_time >= 0),
  cuisine TEXT,
  description TEXT NOT NULL CHECK (length(description) >= 1),
  image TEXT,
  thumbnail TEXT,
  owner TEXT REFERENCES users (email) ON DELETE CASCADE DEFAULT current_setting('request.jwt.claims', true)::jsonb->>'email' NOT NULL,
  tsv tsvector
);

CREATE INDEX recipes_owner_idx ON recipes (owner);
CREATE INDEX recipes_tsv_idx ON recipes USING GIN (tsv);

GRANT ALL ON "recipes" TO "anon";

DROP TRIGGER IF EXISTS set_timestamptz ON recipes;
CREATE TRIGGER set_timestamptz
    BEFORE UPDATE ON recipes
    FOR EACH ROW
    EXECUTE FUNCTION set_timestamptz ();

ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes FORCE ROW LEVEL SECURITY;

CREATE POLICY recipes_policy_select
  ON recipes
  FOR SELECT
  USING (true);

CREATE POLICY recipes_policy_insert
  ON recipes
  FOR INSERT
  WITH CHECK (owner = current_setting('request.jwt.claims', true)::jsonb->>'email');

CREATE POLICY recipes_policy_update
  ON recipes
  FOR UPDATE
  USING (owner = current_setting('request.jwt.claims', true)::jsonb->>'email');

CREATE POLICY recipes_policy_delete
  ON recipes
  FOR DELETE
  USING (owner = current_setting('request.jwt.claims', true)::jsonb->>'email');

-- =============================================================================
-- Ingredients
-- =============================================================================

CREATE TABLE IF NOT EXISTS ingredients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date_published TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  date_modified TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL CHECK (length(name) >= 1),
  measurement TEXT NOT NULL,
  quantity TEXT NOT NULL,
  owner TEXT NOT NULL DEFAULT current_setting('request.jwt.claims', true)::jsonb->>'email'
);

CREATE INDEX ingredients_recipe_id_idx ON ingredients (recipe_id);
CREATE INDEX ingredients_owner_idx ON ingredients (owner);

GRANT ALL ON "ingredients" TO "anon";

DROP TRIGGER IF EXISTS set_timestamptz ON ingredients;
CREATE TRIGGER set_timestamptz
    BEFORE UPDATE ON ingredients
    FOR EACH ROW
    EXECUTE FUNCTION set_timestamptz ();

ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients FORCE ROW LEVEL SECURITY;

CREATE POLICY ingredients_policy_select
  ON ingredients
  FOR SELECT
  USING (true);

CREATE POLICY ingredients_policy_insert
  ON ingredients
  FOR INSERT
  WITH CHECK (owner = current_setting('request.jwt.claims', true)::jsonb->>'email');

CREATE POLICY ingredients_policy_update
  ON ingredients
  FOR UPDATE
  USING (owner = current_setting('request.jwt.claims', true)::jsonb->>'email');

CREATE POLICY ingredients_policy_delete
  ON ingredients
  FOR DELETE
  USING (owner = current_setting('request.jwt.claims', true)::jsonb->>'email');

-- =============================================================================
-- Instructions
-- =============================================================================

CREATE TABLE IF NOT EXISTS instructions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date_published TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  date_modified TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE NOT NULL,
  step TEXT NOT NULL CHECK (length(step) >= 1),
  owner TEXT NOT NULL DEFAULT current_setting('request.jwt.claims', true)::jsonb->>'email'
);

CREATE INDEX instructions_recipe_id_idx ON instructions (recipe_id);
CREATE INDEX instructions_owner_idx ON instructions (owner);

GRANT ALL ON "instructions" TO "anon";

DROP TRIGGER IF EXISTS set_timestamptz ON instructions;
CREATE TRIGGER set_timestamptz
    BEFORE UPDATE ON instructions
    FOR EACH ROW
    EXECUTE FUNCTION set_timestamptz ();

ALTER TABLE instructions ENABLE ROW LEVEL SECURITY;
ALTER TABLE instructions FORCE ROW LEVEL SECURITY;

CREATE POLICY instructions_policy_select
  ON instructions
  FOR SELECT
  USING (true);

CREATE POLICY instructions_policy_insert
  ON instructions
  FOR INSERT
  WITH CHECK (owner = current_setting('request.jwt.claims', true)::jsonb->>'email');

CREATE POLICY instructions_policy_update
  ON instructions
  FOR UPDATE
  USING (owner = current_setting('request.jwt.claims', true)::jsonb->>'email');

CREATE POLICY instructions_policy_delete
  ON instructions
  FOR DELETE
  USING (owner = current_setting('request.jwt.claims', true)::jsonb->>'email');

-- =============================================================================
-- Categories
-- =============================================================================

CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date_published TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  date_modified TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  name TEXT UNIQUE NOT NULL CHECK (length(name) >= 1),
  owner TEXT NOT NULL DEFAULT current_setting('request.jwt.claims', true)::jsonb->>'email'
);

CREATE INDEX categories_owner_idx ON categories (owner);

GRANT ALL ON "categories" TO "anon";

DROP TRIGGER IF EXISTS set_timestamptz ON categories;
CREATE TRIGGER set_timestamptz
    BEFORE UPDATE ON categories
    FOR EACH ROW
    EXECUTE FUNCTION set_timestamptz ();

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories FORCE ROW LEVEL SECURITY;

CREATE POLICY categories_policy_select
  ON categories
  FOR SELECT
  USING (true);

CREATE POLICY categories_policy_insert
  ON categories
  FOR INSERT
  WITH CHECK (owner = current_setting('request.jwt.claims', true)::jsonb->>'email');

CREATE POLICY categories_policy_update
  ON categories
  FOR UPDATE
  USING (owner = current_setting('request.jwt.claims', true)::jsonb->>'email');

CREATE POLICY categories_policy_delete
  ON categories
  FOR DELETE
  USING (owner = current_setting('request.jwt.claims', true)::jsonb->>'email');

-- =============================================================================
-- Recipe Categories (Junction Table)
-- =============================================================================

CREATE TABLE IF NOT EXISTS recipe_categories (
  date_published TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  recipe UUID REFERENCES recipes(id) ON DELETE CASCADE NOT NULL,
  category UUID REFERENCES categories(id) ON DELETE CASCADE NOT NULL,
  PRIMARY KEY (recipe, category),
  owner TEXT NOT NULL DEFAULT current_setting('request.jwt.claims', true)::jsonb->>'email'
);

CREATE INDEX recipe_categories_recipe_idx ON recipe_categories (recipe);
CREATE INDEX recipe_categories_category_idx ON recipe_categories (category);
CREATE INDEX recipe_categories_owner_idx ON recipe_categories (owner);

GRANT ALL ON "recipe_categories" TO "anon";

ALTER TABLE recipe_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_categories FORCE ROW LEVEL SECURITY;

CREATE POLICY recipe_categories_policy_select
  ON recipe_categories
  FOR SELECT
  USING (true);

CREATE POLICY recipe_categories_policy_insert
  ON recipe_categories
  FOR INSERT
  WITH CHECK (owner = current_setting('request.jwt.claims', true)::jsonb->>'email');

CREATE POLICY recipe_categories_policy_update
  ON recipe_categories
  FOR UPDATE
  USING (owner = current_setting('request.jwt.claims', true)::jsonb->>'email');

CREATE POLICY recipe_categories_policy_delete
  ON recipe_categories
  FOR DELETE
  USING (owner = current_setting('request.jwt.claims', true)::jsonb->>'email');

-- =============================================================================
-- Views
-- =============================================================================

CREATE OR REPLACE VIEW recipes_and_categories
AS
SELECT
  recipes.*,
  COALESCE(ARRAY(SELECT jsonb_array_elements_text(rc.categories)), ARRAY[]::text[]) AS categories,
  ing.ingredients,
  ins.instructions,
  to_tsvector('pg_catalog.swedish',
              concat_ws(' ',
                        recipes.name,
                        recipes.description,
                        ing.names,
                        jsonb_path_query_array(rc.categories::jsonb, '$'::jsonpath),
                        ins.steps
                       )
             ) as full_tsv
FROM recipes
LEFT JOIN LATERAL (
  SELECT jsonb_agg(name) AS categories FROM (
    SELECT categories.name FROM categories, recipe_categories WHERE recipe_categories.category = categories.id AND recipe_categories.recipe = recipes.id
  ) AS rc_categories
) AS rc ON TRUE
LEFT JOIN LATERAL (
  SELECT
    jsonb_agg(ingredient.*) AS ingredients,
    string_agg(ingredient.name, ' ') AS names
  FROM (
    SELECT ingredients.* FROM ingredients WHERE ingredients.recipe_id = recipes.id
  ) AS ingredient
) AS ing ON TRUE
LEFT JOIN LATERAL (
  SELECT
    jsonb_agg(instruction.*) AS instructions,
    string_agg(instruction.step, ' ') AS steps
  FROM (
    SELECT instructions.* FROM instructions WHERE instructions.recipe_id = recipes.id
  ) AS instruction
) AS ins ON TRUE;

GRANT SELECT ON "recipes_and_categories" TO "anon";

-- =============================================================================
-- Functions
-- =============================================================================

CREATE OR REPLACE FUNCTION insert_recipe(
  p_name TEXT,
  p_author TEXT,
  p_url TEXT,
  p_recipe_yield INTEGER,
  p_recipe_yield_name TEXT,
  p_prep_time INTEGER,
  p_cook_time INTEGER,
  p_description TEXT,
  p_categories TEXT[],
  p_ingredients JSONB[],
  p_instructions JSONB[],
  p_cuisine TEXT DEFAULT NULL,
  p_image TEXT DEFAULT NULL,
  p_thumbnail TEXT DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql AS $func$
DECLARE
  new_recipe_id UUID;
  cat TEXT;
  cat_id UUID;
  ing JSONB;
  instr JSONB;
BEGIN
  -- Insert into the recipes table
  INSERT INTO recipes(name, author, url, recipe_yield, recipe_yield_name, prep_time, cook_time, cuisine, description, image, thumbnail)
  VALUES(p_name, p_author, p_url, p_recipe_yield, p_recipe_yield_name, p_prep_time, p_cook_time, p_cuisine, p_description, p_image, p_thumbnail)
  RETURNING id INTO new_recipe_id;

  -- Handle categories
  IF p_categories IS NOT NULL THEN
    FOREACH cat IN ARRAY p_categories
    LOOP
      SELECT id INTO cat_id FROM categories WHERE categories.name = cat;
      IF cat_id IS NULL THEN
        INSERT INTO categories(name) VALUES(cat) RETURNING id INTO cat_id;
      END IF;
      INSERT INTO recipe_categories(recipe, category) VALUES(new_recipe_id, cat_id);
    END LOOP;
  END IF;

  -- Handle ingredients
  IF p_ingredients IS NOT NULL THEN
    FOREACH ing IN ARRAY p_ingredients
    LOOP
      INSERT INTO ingredients(recipe_id, name, measurement, quantity)
      VALUES(new_recipe_id, ing->>'name', ing->>'measurement', ing->>'quantity');
    END LOOP;
  END IF;

  -- Handle instructions
  IF p_instructions IS NOT NULL THEN
    FOREACH instr IN ARRAY p_instructions
    LOOP
      INSERT INTO instructions(recipe_id, step)
      VALUES(new_recipe_id, instr->>'step');
    END LOOP;
  END IF;

  RETURN new_recipe_id;
END;
$func$;

GRANT EXECUTE ON FUNCTION insert_recipe TO "anon";

CREATE OR REPLACE FUNCTION update_recipe(
  p_recipe_id UUID,
  p_name TEXT,
  p_author TEXT,
  p_url TEXT,
  p_recipe_yield INTEGER,
  p_recipe_yield_name TEXT,
  p_prep_time INTEGER,
  p_cook_time INTEGER,
  p_description TEXT,
  p_categories TEXT[],
  p_ingredients JSONB[],
  p_instructions JSONB[],
  p_cuisine TEXT DEFAULT NULL,
  p_image TEXT DEFAULT NULL,
  p_thumbnail TEXT DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql AS $func$
DECLARE
  cat TEXT;
  cat_id UUID;
  ing JSONB;
  instr JSONB;
BEGIN
  -- Update the recipes table
  UPDATE recipes SET
    name = p_name,
    author = p_author,
    url = p_url,
    recipe_yield = p_recipe_yield,
    recipe_yield_name = p_recipe_yield_name,
    prep_time = p_prep_time,
    cook_time = p_cook_time,
    cuisine = p_cuisine,
    description = p_description,
    image = p_image,
    thumbnail = p_thumbnail
  WHERE id = p_recipe_id;

  -- Handle categories: delete and recreate
  DELETE FROM recipe_categories WHERE recipe = p_recipe_id;

  IF p_categories IS NOT NULL THEN
    FOREACH cat IN ARRAY p_categories
    LOOP
      SELECT id INTO cat_id FROM categories WHERE categories.name = cat;
      IF cat_id IS NULL THEN
        INSERT INTO categories(name) VALUES(cat) RETURNING id INTO cat_id;
      END IF;
      INSERT INTO recipe_categories(recipe, category) VALUES(p_recipe_id, cat_id);
    END LOOP;
  END IF;

  -- Handle ingredients: delete and recreate
  DELETE FROM ingredients WHERE recipe_id = p_recipe_id;

  IF p_ingredients IS NOT NULL THEN
    FOREACH ing IN ARRAY p_ingredients
    LOOP
      INSERT INTO ingredients(recipe_id, name, measurement, quantity)
      VALUES(p_recipe_id, ing->>'name', ing->>'measurement', ing->>'quantity');
    END LOOP;
  END IF;

  -- Handle instructions: delete and recreate
  DELETE FROM instructions WHERE recipe_id = p_recipe_id;

  IF p_instructions IS NOT NULL THEN
    FOREACH instr IN ARRAY p_instructions
    LOOP
      INSERT INTO instructions(recipe_id, step)
      VALUES(p_recipe_id, instr->>'step');
    END LOOP;
  END IF;
END;
$func$;

GRANT EXECUTE ON FUNCTION update_recipe TO "anon";
