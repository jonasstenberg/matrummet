-- Change auth function owners to postgres so SECURITY DEFINER can bypass RLS
-- These functions need to read from user_passwords table which has RLS enabled

ALTER FUNCTION login(text, text) OWNER TO postgres;
ALTER FUNCTION signup(text, text, text, text) OWNER TO postgres;
ALTER FUNCTION signup_provider(text, text, text) OWNER TO postgres;
ALTER FUNCTION reset_password(text, text, text) OWNER TO postgres;
