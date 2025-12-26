-- Allow the recept role to insert users for signup_provider function
-- The signup_provider function uses SECURITY DEFINER and runs as 'recept',
-- but FORCE ROW LEVEL SECURITY is enabled on users table, so we need
-- an explicit policy to allow inserts during OAuth signup flow.

CREATE POLICY users_policy_service_insert
  ON users
  FOR INSERT
  TO recept
  WITH CHECK (true);

COMMENT ON POLICY users_policy_service_insert ON users IS
  'Allow the recept service role to insert new users during signup';
