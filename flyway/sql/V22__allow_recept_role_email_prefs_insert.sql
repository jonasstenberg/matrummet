-- Allow the recept role to insert email preferences during signup.
-- The ensure_email_preferences trigger runs during user creation and needs
-- to insert into user_email_preferences. Since the signup function runs
-- as 'recept' role with FORCE ROW LEVEL SECURITY, we need this policy.

CREATE POLICY user_email_preferences_policy_service_insert
  ON user_email_preferences
  FOR INSERT
  TO recept
  WITH CHECK (true);

COMMENT ON POLICY user_email_preferences_policy_service_insert ON user_email_preferences IS
  'Allow the recept service role to insert email preferences during signup';
