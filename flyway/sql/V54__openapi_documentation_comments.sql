-- V54: Add OpenAPI documentation comments
-- PostgREST uses COMMENT ON to generate OpenAPI schema descriptions.
-- This migration documents public-facing tables, columns, views, and functions.

-- =============================================================================
-- 1. Table Comments
-- =============================================================================
-- Skip: users (V30), homes (V38), home_invitations (V38) — already documented.

COMMENT ON TABLE recipes IS
'Core recipe data. Use the insert_recipe() and update_recipe() RPCs to create/modify recipes — they atomically handle categories, ingredients, and instructions together. Direct INSERT/UPDATE works but requires managing related tables manually.';

COMMENT ON TABLE ingredients IS
'Recipe ingredients with optional food/unit references. Managed atomically via insert_recipe() and update_recipe() RPCs — do not insert directly unless managing groups and sort order yourself.';

COMMENT ON TABLE instructions IS
'Recipe cooking steps with optional grouping. Managed atomically via insert_recipe() and update_recipe() RPCs.';

COMMENT ON TABLE categories IS
'Recipe categories (e.g. "Middag", "Dessert"). Auto-created when referenced in insert_recipe()/update_recipe(). Many-to-many relationship with recipes via recipe_categories.';

COMMENT ON TABLE recipe_categories IS
'Junction table linking recipes to categories. Managed by insert_recipe()/update_recipe() RPCs.';

COMMENT ON TABLE ingredient_groups IS
'Named groups for organizing ingredients within a recipe (e.g. "Sås", "Deg"). Created via insert_recipe()/update_recipe() when ingredients array contains {"group":"Name"} entries.';

COMMENT ON TABLE instruction_groups IS
'Named groups for organizing instructions within a recipe (e.g. "Förberedelse", "Tillagning"). Created via insert_recipe()/update_recipe() when instructions array contains {"group":"Name"} entries.';

COMMENT ON TABLE recipe_likes IS
'Tracks which users have liked which recipes. A user cannot like their own recipe. Use toggle_recipe_like() RPC to like/unlike.';

COMMENT ON TABLE shopping_lists IS
'Shopping lists belonging to a home. Each home has one default list. Use create_shopping_list(), rename_shopping_list(), delete_shopping_list() RPCs.';

COMMENT ON TABLE shopping_list_items IS
'Individual items on a shopping list. Added via add_recipe_to_shopping_list() RPC. Use toggle_shopping_list_item() to check/uncheck items.';

COMMENT ON TABLE shopping_list_item_sources IS
'Tracks which recipe contributed each shopping list item, including the servings multiplier used.';

COMMENT ON TABLE foods IS
'Normalized food items referenced by ingredients and pantry. Read-only via PostgREST — foods are created automatically when recipes are saved via insert_recipe()/update_recipe(). New foods start as pending and require approval.';

COMMENT ON TABLE units IS
'Measurement units (dl, msk, g, etc.) referenced by ingredients. Read-only via PostgREST — use search_units() to find available units.';

COMMENT ON TABLE user_pantry IS
'Home pantry inventory for recipe matching. Use add_to_pantry(), remove_from_pantry(), and get_user_pantry() RPCs.';

COMMENT ON TABLE user_api_keys IS
'API keys for external integrations. Keys are hashed — the plaintext is only returned once at creation. Use create_user_api_key(), get_user_api_keys(), and revoke_api_key() RPCs.';

COMMENT ON TABLE user_passwords IS
'Hashed user passwords. Managed via signup(), reset_password(), and complete_password_reset() RPCs. Passwords are bcrypt-hashed via trigger — never set directly.';

COMMENT ON TABLE user_email_preferences IS
'User email notification preferences. Controls which email types a user receives.';

COMMENT ON TABLE password_reset_tokens IS
'Time-limited tokens for password reset flow. Created by request_password_reset(), consumed by complete_password_reset(). Tokens expire after 1 hour.';

COMMENT ON TABLE food_review_logs IS
'Audit log of food approval/rejection decisions made by AI or admin reviewers.';


-- =============================================================================
-- 2. Column Comments — Image Workflow (Critical)
-- =============================================================================

COMMENT ON COLUMN recipes.image IS
'Recipe image identifier. Either a UUID filename from the /api/upload endpoint or an external URL. Images are NOT uploaded through PostgREST — use the Next.js /api/upload endpoint first, then pass the returned UUID here. Served at /api/images/{id}/{size} where size is thumb|small|medium|large|full.';

COMMENT ON COLUMN recipes.thumbnail IS
'Recipe thumbnail identifier. Same format as image — a UUID from /api/upload or an external URL. Typically the same value as image. Served at /api/images/{id}/thumb.';


-- =============================================================================
-- 3. Other Column Comments
-- =============================================================================

COMMENT ON COLUMN recipes.tsv IS
'Auto-generated Swedish full-text search vector. Do not set directly — maintained by trigger on INSERT/UPDATE.';

COMMENT ON COLUMN recipes.search_text IS
'Denormalized text combining recipe name, description, ingredients, and forms for trigram (pg_trgm) substring search. Auto-maintained by trigger — do not set directly.';

COMMENT ON COLUMN recipes.owner IS
'Email of the recipe owner. Automatically set from JWT claims on insert. Used for RLS ownership checks.';

COMMENT ON COLUMN recipes.recipe_yield IS
'Number of servings the recipe makes.';

COMMENT ON COLUMN recipes.recipe_yield_name IS
'Unit name for servings (e.g. "portioner", "bitar", "liter"). Defaults to "portioner".';

COMMENT ON COLUMN recipes.prep_time IS
'Preparation time in minutes. NULL if not specified.';

COMMENT ON COLUMN recipes.cook_time IS
'Cooking time in minutes. NULL if not specified.';

COMMENT ON COLUMN ingredients.food_id IS
'Reference to normalized food item. Auto-resolved by insert_recipe()/update_recipe() from the ingredient name.';

COMMENT ON COLUMN ingredients.unit_id IS
'Reference to normalized measurement unit. Auto-resolved by insert_recipe()/update_recipe() from the measurement name.';

COMMENT ON COLUMN ingredients.group_id IS
'Reference to the ingredient group this item belongs to. NULL if ungrouped. Set by insert_recipe()/update_recipe().';

COMMENT ON COLUMN ingredients.sort_order IS
'Display order within the group (or within ungrouped ingredients). Set by insert_recipe()/update_recipe().';

-- Skip ingredients.form — already has comment from V43.

COMMENT ON COLUMN foods.status IS
'Approval workflow status: pending (newly created, awaiting review), approved (verified food item), rejected (not a valid food), needs_review (flagged for human review after AI uncertainty).';

COMMENT ON COLUMN foods.common_pantry_category IS
'Category for common pantry suggestions: basic, seasoning, herb, or spice. NULL for non-pantry-staple foods.';

COMMENT ON COLUMN foods.tsv IS
'Auto-generated Swedish full-text search vector on the food name.';

COMMENT ON COLUMN units.tsv IS
'Auto-generated Swedish full-text search vector on unit name, plural, and abbreviation.';

COMMENT ON COLUMN units.abbreviation IS
'Short form of the unit (e.g. dl, msk, tsk, g, kg, ml, l, st, krm). Empty string if no standard abbreviation.';


-- =============================================================================
-- 4. View Comments
-- =============================================================================

COMMENT ON VIEW recipes_and_categories IS
'Primary recipe view with denormalized categories, ingredient groups, ingredients, instruction groups, instructions, full-text search vector, like status, and pantry match statistics. This is the main endpoint for reading recipe data.';

COMMENT ON VIEW liked_recipes IS
'Current user''s liked recipes. Returns the same structure as recipes_and_categories, filtered to recipes the authenticated user has liked.';

COMMENT ON VIEW shopping_list_view IS
'Shopping lists with their items, including food names, unit info, and recipe source details. Filtered to the current user''s home.';

COMMENT ON MATERIALIZED VIEW recipe_ingredient_summary IS
'Pre-computed recipe-to-food mapping for efficient pantry matching. Refreshed automatically by triggers when recipes or ingredients change. Do not query directly — use find_recipes_from_pantry() or get_recipes_with_pantry_match().';

-- Skip email_users_view — already documented in V28.


-- =============================================================================
-- 5. Function Comments — Recipe CRUD (Replace Outdated V28 Comments)
-- =============================================================================

COMMENT ON FUNCTION insert_recipe(TEXT, TEXT, TEXT, INTEGER, TEXT, INTEGER, INTEGER, TEXT, TEXT[], JSONB[], JSONB[], TEXT, TEXT, TEXT) IS
'Creates a new recipe with categories, ingredients, and instructions atomically.

Parameters: p_name, p_author, p_url, p_recipe_yield, p_recipe_yield_name, p_prep_time, p_cook_time, p_description, p_categories, p_ingredients, p_instructions, p_cuisine, p_image, p_thumbnail.

Image/thumbnail: Pass a UUID filename from /api/upload or an external URL. Images are NOT uploaded through this function.

Ingredients array: Mix of {"group":"Group Name"} for section headers and {"name":"...","measurement":"...","quantity":"...","form":"..."} for items. Items after a group header belong to that group.

Instructions array: Mix of {"group":"Group Name"} for section headers and {"step":"..."} for steps.

Limits: max 20 categories, 100 ingredients, 100 instructions. Returns the new recipe UUID.';

COMMENT ON FUNCTION update_recipe(UUID, TEXT, TEXT, TEXT, INTEGER, TEXT, INTEGER, INTEGER, TEXT, TEXT[], JSONB[], JSONB[], TEXT, TEXT, TEXT) IS
'Updates an existing recipe with ownership verification. Replaces all categories, ingredients, and instructions atomically.

Parameters: p_recipe_id, then same as insert_recipe.

Image/thumbnail: Pass a UUID filename from /api/upload or an external URL. Images are NOT uploaded through this function.

Ingredients array: Mix of {"group":"Group Name"} for section headers and {"name":"...","measurement":"...","quantity":"...","form":"..."} for items.

Instructions array: Mix of {"group":"Group Name"} for section headers and {"step":"..."} for steps.

Limits: max 20 categories, 100 ingredients, 100 instructions.';


-- =============================================================================
-- 6. Function Comments — Auth
-- =============================================================================
-- Skip request_password_reset — already has comment in V15.

COMMENT ON FUNCTION login(TEXT, TEXT) IS
'Authenticates a user with email and password. Returns the user record on success. Raises an exception on invalid credentials.';

COMMENT ON FUNCTION signup(TEXT, TEXT, TEXT, TEXT) IS
'Creates a new user account. Parameters: p_name, p_email, p_password, p_provider. Password must be at least 8 characters. If p_provider is set (e.g. "google"), no password is required. Returns the created user record.';

COMMENT ON FUNCTION signup_provider(TEXT, TEXT, TEXT) IS
'OAuth signup wrapper. Creates a user account for external auth providers (e.g. Google). Parameters: p_name, p_email, p_provider. Returns JSONB with the created user data and JWT token.';

COMMENT ON FUNCTION reset_password(TEXT, TEXT, TEXT) IS
'Changes a user''s password. Parameters: p_email, p_old_password, p_new_password. Requires the current password for verification. New password must be at least 8 characters.';

COMMENT ON FUNCTION complete_password_reset(TEXT, TEXT) IS
'Completes a token-based password reset. Parameters: p_token (from the reset email link), p_new_password. Token must be valid and not expired. New password must be at least 8 characters. Returns JSONB with success status.';

COMMENT ON FUNCTION validate_password_reset_token(TEXT) IS
'Validates a password reset token without consuming it. Parameters: p_token. Returns JSONB with valid (boolean) and email if valid. Use before showing the reset password form.';


-- =============================================================================
-- 7. Function Comments — Search & Likes
-- =============================================================================

-- Re-add comment lost when V52 dropped and recreated search_recipes.
COMMENT ON FUNCTION search_recipes(TEXT, TEXT, TEXT, INTEGER, INTEGER) IS
'Substring search for recipes using pg_trgm. Finds "sås" in "vaniljsås".
 Uses GIN trigram index for fast ILIKE matching at scale.
 Results ranked by: exact match > prefix > contains > word_similarity.
 Returns empty result set if query is NULL or empty.';

COMMENT ON FUNCTION search_foods(TEXT, INTEGER) IS
'Searches foods by name using Swedish full-text search with prefix matching. Parameters: p_query, p_limit (default 10). Returns id, name, rank, status, and is_own_pending flag.';

COMMENT ON FUNCTION search_units(TEXT, INTEGER) IS
'Searches measurement units by name or abbreviation. Parameters: p_query, p_limit (default 10). Uses Swedish full-text search. Returns id, name, and rank.';

COMMENT ON FUNCTION toggle_recipe_like(UUID) IS
'Toggles a like on a recipe for the current user. Cannot like your own recipes. Returns JSONB with liked (boolean) and recipe_id.';

COMMENT ON FUNCTION search_liked_recipes(TEXT, TEXT, INTEGER, INTEGER) IS
'Searches within the current user''s liked recipes. Parameters: p_query, p_category, p_limit (default 50), p_offset (default 0). Uses trigram substring matching. Returns recipe data with like timestamp.';


-- =============================================================================
-- 8. Function Comments — Shopping Lists
-- =============================================================================

COMMENT ON FUNCTION add_recipe_to_shopping_list(UUID, UUID, INTEGER, UUID[]) IS
'Adds a recipe''s ingredients to a shopping list. Parameters: p_recipe_id, p_shopping_list_id (default: user''s default list), p_servings (scales quantities), p_ingredient_ids (subset of ingredients, default: all). Merges duplicate foods by summing quantities. Returns JSONB with the shopping list id and number of items added.';

COMMENT ON FUNCTION toggle_shopping_list_item(UUID) IS
'Toggles a shopping list item between checked and unchecked. When checking an item, it is also added to the user''s pantry. Returns JSONB with the item id and checked status.';

COMMENT ON FUNCTION clear_checked_items(UUID) IS
'Deletes all checked items from a shopping list. Parameters: p_shopping_list_id (default: user''s default list). Returns JSONB with the number of items removed.';

COMMENT ON FUNCTION get_user_shopping_lists() IS
'Returns all shopping lists for the current user''s home, including item counts and checked counts.';

COMMENT ON FUNCTION create_shopping_list(TEXT) IS
'Creates a new shopping list for the current user''s home. Parameters: p_name. Returns the new list UUID.';

COMMENT ON FUNCTION rename_shopping_list(UUID, TEXT) IS
'Renames a shopping list. Parameters: p_list_id, p_name. Must be a list belonging to the user''s home.';

COMMENT ON FUNCTION delete_shopping_list(UUID) IS
'Deletes a shopping list. Parameters: p_list_id. Cannot delete the default list. Unchecked items are moved to the default list before deletion.';

COMMENT ON FUNCTION set_default_shopping_list(UUID) IS
'Sets a shopping list as the default for the current user''s home. Parameters: p_list_id. The previous default is unset.';

COMMENT ON FUNCTION get_or_create_default_shopping_list() IS
'Returns the default shopping list UUID for the current user''s home. Creates one named "Inköpslista" if none exists.';


-- =============================================================================
-- 9. Function Comments — API Keys
-- =============================================================================
-- Skip validate_api_key — internal, called by PostgREST pre_request() hook.

COMMENT ON FUNCTION create_user_api_key(TEXT) IS
'Creates a new API key for the current user. Parameters: p_name (description). Returns JSONB with id, name, api_key (plaintext — only returned once), and expiration. The key is stored hashed and cannot be retrieved again.';

COMMENT ON FUNCTION revoke_api_key(UUID) IS
'Deactivates an API key. Parameters: p_key_id. The key must belong to the current user. Returns JSONB with success status.';

COMMENT ON FUNCTION get_user_api_keys() IS
'Lists the current user''s API keys with id, name, key prefix (first 8 chars), last_used_at, expires_at, is_active, and creation date. Does not return the full key.';


-- =============================================================================
-- 10. Function Comments — Pantry
-- =============================================================================
-- Skip refresh_recipe_ingredient_summary — internal, auto-triggered.

COMMENT ON FUNCTION add_to_pantry(UUID, DECIMAL, TEXT, DATE) IS
'Adds or updates a pantry item for the current user''s home. Parameters: p_food_id, p_quantity, p_unit, p_expires_at. Upserts by food_id — if already in pantry, updates quantity/unit/expiry. Returns true on success.';

COMMENT ON FUNCTION remove_from_pantry(UUID) IS
'Removes a food item from the current user''s home pantry. Parameters: p_food_id. Returns true if removed, false if not found.';

COMMENT ON FUNCTION get_user_pantry() IS
'Lists all pantry items for the current user''s home. Returns id, food_id, food_name, quantity, unit, added_at, expires_at, is_expired flag, and who added the item.';


-- =============================================================================
-- 11. Function Comments — Account & Misc
-- =============================================================================

COMMENT ON FUNCTION delete_all_user_recipes() IS
'Deletes all recipes owned by the current user. This is irreversible. Used before account deletion to clean up recipe data.';

COMMENT ON FUNCTION disable_join_code() IS
'Disables the current home''s join code so it can no longer be used. Requires the caller to be a member of the home.';

COMMENT ON FUNCTION cancel_invitation(UUID) IS
'Cancels a pending home invitation. Parameters: p_invitation_id. The invitation must belong to the caller''s home.';

COMMENT ON FUNCTION get_pending_invitations() IS
'Lists pending home invitations for the current user. Returns invitation id, home details, inviter info, token, and expiration.';

COMMENT ON FUNCTION update_home_name(TEXT) IS
'Renames the current user''s home. Parameters: p_name. Must be a member of the home.';
