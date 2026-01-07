-- V37: Grant BYPASSRLS to recept role
-- Required for SECURITY DEFINER functions with SET row_security = off to work correctly
-- Specifically needed for is_admin_or_system() when called from apply_ai_food_review()

ALTER ROLE recept BYPASSRLS;
