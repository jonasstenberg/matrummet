-- V12: Create admin database role and tighten grants
--
-- Problem: Many admin-only tables are granted to `authenticated`, so they
-- appear in the OpenAPI spec for all logged-in users even though RLS blocks
-- access. This migration creates a proper `admin` role and moves admin-only
-- grants there, so the Swagger spec only shows what each role can actually use.

-- 1. Create admin role inheriting from authenticated
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'admin') THEN
    CREATE ROLE admin NOLOGIN;
  END IF;
END
$$;

GRANT authenticated TO admin;
GRANT admin TO matrummet;

-- 2. Revoke overly broad table grants from authenticated
-- and grant to admin instead

-- email_templates: admin-only (all RLS policies use is_admin())
REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.email_templates FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.email_templates TO admin;

-- email_messages: write is admin-only, SELECT is admin + own recipient
REVOKE INSERT, UPDATE, DELETE ON TABLE public.email_messages FROM authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.email_messages TO admin;

-- food_review_logs: admin-only SELECT
REVOKE SELECT ON TABLE public.food_review_logs FROM authenticated;
GRANT SELECT ON TABLE public.food_review_logs TO admin;

-- user_passwords: should never be accessed directly via API
-- (auth functions use SECURITY DEFINER, the matrummet role has service policies)
REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_passwords FROM authenticated;

-- stripe_customers: keep — used by checkout route via PostgREST with RLS (owner-only)

-- user_credits: regular users use get_user_credits(); admin can read directly
REVOKE SELECT ON TABLE public.user_credits FROM authenticated;
GRANT SELECT ON TABLE public.user_credits TO admin;

-- 3. Revoke admin_* functions from authenticated, grant to admin

REVOKE ALL ON FUNCTION public.admin_count_foods(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_count_foods(text) TO admin;

REVOKE ALL ON FUNCTION public.admin_count_foods(text, public.food_status) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_count_foods(text, public.food_status) TO admin;

REVOKE ALL ON FUNCTION public.admin_count_units(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_count_units(text) TO admin;

REVOKE ALL ON FUNCTION public.admin_count_users(text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_count_users(text, text) TO admin;

REVOKE ALL ON FUNCTION public.admin_delete_user(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO admin;

REVOKE ALL ON FUNCTION public.admin_list_foods(text, public.food_status, integer, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_foods(text, public.food_status, integer, integer) TO admin;

REVOKE ALL ON FUNCTION public.admin_list_units(text, integer, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_units(text, integer, integer) TO admin;

REVOKE ALL ON FUNCTION public.admin_list_users(text, text, integer, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users(text, text, integer, integer) TO admin;

REVOKE ALL ON FUNCTION public.admin_update_user(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_user(uuid, text) TO admin;

REVOKE ALL ON FUNCTION public.admin_update_user_role(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_user_role(uuid, text) TO admin;

-- 4. Tighten table grants where authenticated has write but RLS is admin-only

-- categories: SELECT is public, write is admin-only
REVOKE INSERT, UPDATE, DELETE ON TABLE public.categories FROM authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.categories TO admin;

-- units: SELECT is public, write is admin-only
REVOKE INSERT, UPDATE, DELETE ON TABLE public.units FROM authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.units TO admin;

-- foods: SELECT is public/owner, DELETE/UPDATE is admin-only
-- INSERT stays with authenticated (users can suggest foods, RLS allows it)
REVOKE UPDATE, DELETE ON TABLE public.foods FROM authenticated;
GRANT UPDATE, DELETE ON TABLE public.foods TO admin;

-- credit_transactions: regular users use get_credit_history(); admin can read directly
REVOKE SELECT ON TABLE public.credit_transactions FROM authenticated;
GRANT SELECT ON TABLE public.credit_transactions TO admin;
