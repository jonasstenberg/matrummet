-- V13: Revoke internal and admin-only functions from authenticated role
--
-- These functions show in the OpenAPI spec but should not be visible to
-- regular users. Admin-only functions move to the admin role; internal
-- functions (called only by other SECURITY DEFINER functions) have their
-- grants removed entirely.

-- 1. Admin-only functions → move from authenticated to admin

REVOKE ALL ON FUNCTION public.approve_food(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.approve_food(uuid) TO admin;

REVOKE ALL ON FUNCTION public.reject_food(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.reject_food(uuid) TO admin;

REVOKE ALL ON FUNCTION public.approve_food_as_alias(uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.approve_food_as_alias(uuid, uuid) TO admin;

REVOKE ALL ON FUNCTION public.set_food_canonical(uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.set_food_canonical(uuid, uuid) TO admin;

REVOKE ALL ON FUNCTION public.get_pending_foods_for_review(integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_pending_foods_for_review(integer) TO admin;

REVOKE ALL ON FUNCTION public.apply_ai_food_review(uuid, public.food_status, text, real, uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.apply_ai_food_review(uuid, public.food_status, text, real, uuid, text) TO admin;

REVOKE ALL ON FUNCTION public.get_all_recipes_for_summary() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_recipes_for_summary() TO admin;

REVOKE ALL ON FUNCTION public.refresh_recipe_ingredient_summary() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_recipe_ingredient_summary() TO admin;

REVOKE ALL ON FUNCTION public.delete_all_user_recipes() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.delete_all_user_recipes() TO admin;

-- 2. Internal functions → revoke from authenticated, grant to admin where needed

REVOKE ALL ON FUNCTION public.cleanup_expired_password_reset_tokens() FROM authenticated;
REVOKE ALL ON FUNCTION public.queue_email(text, text, jsonb, jsonb, text) FROM authenticated;
REVOKE ALL ON FUNCTION public.get_email_template(text, text) FROM authenticated;
REVOKE ALL ON FUNCTION public.get_or_create_food(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_food(text) TO admin;

-- 3. Revoke email_messages SELECT from authenticated
-- (no user-facing UI reads email messages; RLS allows it but it's unused)
REVOKE SELECT ON TABLE public.email_messages FROM authenticated;
GRANT SELECT ON TABLE public.email_messages TO admin;
