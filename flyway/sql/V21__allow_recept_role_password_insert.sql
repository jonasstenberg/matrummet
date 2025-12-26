-- Allow the recept role to insert password records during signup.
-- The signup function uses SECURITY DEFINER and runs as 'recept',
-- but FORCE ROW LEVEL SECURITY is enabled on user_passwords table,
-- so we need an explicit policy to allow inserts during signup flow.

CREATE POLICY user_passwords_policy_service_insert
  ON user_passwords
  FOR INSERT
  TO recept
  WITH CHECK (true);

COMMENT ON POLICY user_passwords_policy_service_insert ON user_passwords IS
  'Allow the recept service role to insert password records during signup';
