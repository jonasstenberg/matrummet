-- Allow the recept role to read password hashes for login verification.
-- The login function uses SECURITY DEFINER and runs as 'recept',
-- but FORCE ROW LEVEL SECURITY is enabled on user_passwords table.

CREATE POLICY user_passwords_policy_service_select
  ON user_passwords
  FOR SELECT
  TO recept
  USING (true);

COMMENT ON POLICY user_passwords_policy_service_select ON user_passwords IS
  'Allow the recept service role to read passwords for login verification';
