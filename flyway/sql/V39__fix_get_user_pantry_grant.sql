-- V39: Fix missing grants for objects dropped and recreated in V38
-- When DROP is used before CREATE, all grants are lost and must be re-applied.

-- The get_user_pantry function was dropped (line 930) and recreated with a new
-- return type in V38, causing the EXECUTE permission to be lost.
GRANT EXECUTE ON FUNCTION get_user_pantry() TO "authenticated";

-- The shopping_list_view was dropped (line 1739) and recreated in V38,
-- causing the SELECT permission to be lost.
GRANT SELECT ON shopping_list_view TO "authenticated";
