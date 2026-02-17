-- Fix SECURITY DEFINER functions missing SET search_path
-- signup() and signup_provider() (last recreated in V29) are SECURITY DEFINER
-- but lack SET search_path, which is a security risk: an attacker who can create
-- objects in the user's search_path could hijack table references.
-- Using ALTER FUNCTION to add search_path without recreating the function body.

ALTER FUNCTION public.signup(text, text, text, text) SET search_path = public;
ALTER FUNCTION public.signup_provider(text, text, text) SET search_path = public;
