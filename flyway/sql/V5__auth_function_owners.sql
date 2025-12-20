-- Change auth function owners to the migration user (superuser) so SECURITY DEFINER can bypass RLS
-- These functions need to read from user_passwords table which has RLS enabled
-- Note: This migration must be run by a superuser for SECURITY DEFINER to work properly

DO $$
BEGIN
  EXECUTE format('ALTER FUNCTION login(text, text) OWNER TO %I', current_user);
  EXECUTE format('ALTER FUNCTION signup(text, text, text, text) OWNER TO %I', current_user);
  EXECUTE format('ALTER FUNCTION signup_provider(text, text, text) OWNER TO %I', current_user);
  EXECUTE format('ALTER FUNCTION reset_password(text, text, text) OWNER TO %I', current_user);
END $$;
