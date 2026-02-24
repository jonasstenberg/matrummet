import { createFileRoute } from '@tanstack/react-router'

const DOCS = `# Matrummet API Documentation

API for managing recipes, pantry, shopping lists, and households in Matrummet.

## Authentication

All API requests require the \`x-api-key\` header:

\`\`\`
x-api-key: sk_...
\`\`\`

Create API keys at [/installningar/api-nycklar](https://matrummet.se/installningar/api-nycklar) after logging in.

The key is validated by PostgREST's \`pre_request()\` hook, which sets the JWT claims for row-level security (RLS). You can only read/modify your own data.

### Household-scoped requests

For operations that are scoped to a household (pantry, shopping lists), include the \`X-Active-Home-Id\` header:

\`\`\`
X-Active-Home-Id: <home-uuid>
\`\`\`

Get your home ID from \`get_user_homes\` or \`get_home_info\`.

## Base URL

\`\`\`
https://api.matrummet.se
\`\`\`

All RPC calls use \`POST /rpc/<function_name>\` with a JSON body. Table/view queries use \`GET /<view_name>\`.

## Quick Start

Verify your key works:

\`\`\`bash
curl -s https://api.matrummet.se/rpc/current_user_info \\
  -H "x-api-key: sk_YOUR_KEY" \\
  -X POST
\`\`\`

Returns your user info (email, name, role).

## Images

Images are handled by a separate image service on \`api.matrummet.se\`. Upload an image, get back a UUID, and link it to a recipe via \`p_image\`.

### POST /upload

Upload an image. Returns a UUID identifying the image. The service automatically generates five sizes (thumb, small, medium, large, full) in WebP format.

\`\`\`bash
curl -s https://api.matrummet.se/upload \\
  -H "x-api-key: sk_YOUR_KEY" \\
  -F "file=@my-image.jpg"
\`\`\`

Response:

\`\`\`json
{"filename": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"}
\`\`\`

Max file size: 20 MB. Accepted formats: JPEG, PNG, WebP, and other common image formats.

### GET /images/:id/:size

Fetch an image in a specific size. Size can be omitted (defaults to \`full\`).

\`\`\`bash
curl -s https://api.matrummet.se/images/IMAGE_UUID/thumb -o thumb.webp
\`\`\`

**Available sizes:**

| Size | Dimensions | Use case |
|------|-----------|----------|
| thumb | 320x240 | Thumbnails for lists and cards |
| small | 640x480 | Small images for mobile views |
| medium | 960x720 | Medium images for recipe pages |
| large | 1280x960 | Large images for desktop |
| full | 1920x1440 | Full resolution (default) |

Image serving requires no authentication. All images are served as \`image/webp\` with long cache and ETag support.

### DELETE /images/:id

Delete an image and all its size variants. Requires an internal service token and is **not available via API key**.

Images are automatically cleaned up via a database trigger when a recipe is deleted or when its image is replaced. No manual deletion is needed when using the API.

The operation is idempotent — deleting an already-deleted image returns \`{"success": true}\`.

### Linking images to recipes

Use the UUID from upload as \`p_image\` when calling \`insert_recipe\` or \`update_recipe\`:

\`\`\`bash
# 1. Upload the image
IMAGE_ID=$(curl -s https://api.matrummet.se/upload \\
  -H "x-api-key: sk_YOUR_KEY" \\
  -F "file=@pasta.jpg" | jq -r '.filename')

# 2. Create recipe with image
curl -s https://api.matrummet.se/rpc/insert_recipe \\
  -H "x-api-key: sk_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "p_name": "Pasta Carbonara",
    "p_image": "'$IMAGE_ID'",
    ...
  }'
\`\`\`

Images are automatically cleaned up when a recipe is deleted or when the image is replaced — you never need to delete images manually. When using \`copy_recipe\`, the copy shares the same image and it won't be deleted until no recipe references it.

## Recipes

### insert_recipe

Create a new recipe. Returns the new recipe UUID.

\`\`\`bash
curl -s https://api.matrummet.se/rpc/insert_recipe \\
  -H "x-api-key: sk_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "p_name": "Pasta Carbonara",
    "p_author": "Chef",
    "p_url": "",
    "p_recipe_yield": 4,
    "p_recipe_yield_name": "portioner",
    "p_prep_time": 10,
    "p_cook_time": 20,
    "p_description": "Classic Italian pasta",
    "p_categories": ["Pasta", "Middag"],
    "p_ingredients": [
      {"name": "Spaghetti", "quantity": 400, "measurement": "g", "group_name": null},
      {"name": "Pancetta", "quantity": 150, "measurement": "g", "group_name": null}
    ],
    "p_instructions": [
      {"step": "Koka pastan al dente."},
      {"step": "Stek pancettan krispig."}
    ],
    "p_cuisine": "Italienskt"
  }'
\`\`\`

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| p_name | text | yes | Recipe name |
| p_author | text | yes | Author name |
| p_url | text | yes | Source URL (empty string if none) |
| p_recipe_yield | integer | yes | Number of servings |
| p_recipe_yield_name | text | yes | Serving unit (e.g. "portioner") |
| p_prep_time | integer | yes | Prep time in minutes |
| p_cook_time | integer | yes | Cook time in minutes |
| p_description | text | yes | Short description |
| p_categories | text[] | yes | Category names |
| p_ingredients | jsonb[] | yes | Ingredient objects (see data model below) |
| p_instructions | jsonb[] | yes | Instruction objects (see data model below) |
| p_cuisine | text | no | Cuisine type |
| p_image | text | no | Image ID from /upload (UUID, see Images above) |

### update_recipe

Update an existing recipe. You must own the recipe.

Takes the same parameters as \`insert_recipe\` plus:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| p_recipe_id | uuid | yes | Recipe to update |
| p_date_published | text | no | Publish date (ISO 8601) |

Returns nothing.

### copy_recipe

Copy someone else's recipe to your collection. Returns the new recipe UUID.

\`\`\`bash
curl -s https://api.matrummet.se/rpc/copy_recipe \\
  -H "x-api-key: sk_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"p_source_recipe_id": "uuid-here"}'
\`\`\`

### search_recipes

Full-text search across recipes (Swedish stemming).

\`\`\`bash
curl -s https://api.matrummet.se/rpc/search_recipes \\
  -H "x-api-key: sk_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "p_query": "pasta",
    "p_owner_only": true,
    "p_limit": 20,
    "p_offset": 0
  }'
\`\`\`

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| p_query | text | required | Search query |
| p_owner_only | boolean | false | Only your own recipes |
| p_category | text | null | Filter by category name |
| p_limit | integer | 50 | Max results |
| p_offset | integer | 0 | Pagination offset |
| p_owner_ids | uuid[] | null | Filter by specific owner IDs |

Returns rows from the \`user_recipes\` view.

### search_liked_recipes

Search only your liked recipes.

\`\`\`bash
curl -s https://api.matrummet.se/rpc/search_liked_recipes \\
  -H "x-api-key: sk_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"p_query": "pasta", "p_category": null}'
\`\`\`

### search_public_recipes

Search all public recipes (no ownership required). Supports filtering by category and author.

\`\`\`bash
curl -s https://api.matrummet.se/rpc/search_public_recipes \\
  -H "x-api-key: sk_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"p_query": "pasta", "p_category": null, "p_author_id": null}'
\`\`\`

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| p_query | text | required | Search query |
| p_category | text | null | Filter by category name |
| p_author_id | uuid | null | Filter by recipe owner ID |
| p_limit | integer | 50 | Max results |
| p_offset | integer | 0 | Pagination offset |

Returns rows from the \`public_recipes\` view.

### toggle_recipe_like

Like or unlike a recipe (not your own). Returns \`{"liked": true}\` or \`{"liked": false}\`.

\`\`\`bash
curl -s https://api.matrummet.se/rpc/toggle_recipe_like \\
  -H "x-api-key: sk_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"p_recipe_id": "uuid-here"}'
\`\`\`

## Recipe Data Model

### Ingredient object (for insert_recipe / update_recipe)

\`\`\`json
{
  "name": "Spaghetti",
  "quantity": 400,
  "measurement": "g",
  "group_name": null
}
\`\`\`

| Field | Type | Description |
|-------|------|-------------|
| name | string | Ingredient name |
| quantity | number or null | Amount |
| measurement | string or null | Unit (e.g. "g", "dl", "st") |
| group_name | string or null | Group heading (e.g. "Sas", "Topping") |

### Instruction object

\`\`\`json
{
  "step": "Koka pastan al dente."
}
\`\`\`

| Field | Type | Description |
|-------|------|-------------|
| step | string | Instruction text |

## Recipe Sharing

### create_share_token

Create a shareable link for one of your recipes. Returns a token and optional expiry.

\`\`\`bash
curl -s https://api.matrummet.se/rpc/create_share_token \\
  -H "x-api-key: sk_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"p_recipe_id": "uuid-here", "p_expires_days": 30}'
\`\`\`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| p_recipe_id | uuid | yes | Recipe to share (must be yours) |
| p_expires_days | integer | no | Days until expiry (null = never) |

Returns: \`{token, expires_at}\`.

### get_recipe_share_tokens

List all share tokens for a recipe you own.

\`\`\`bash
curl -s https://api.matrummet.se/rpc/get_recipe_share_tokens \\
  -H "x-api-key: sk_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"p_recipe_id": "uuid-here"}'
\`\`\`

Returns: id, token, created_at, expires_at, revoked_at, view_count, last_viewed_at, is_active.

### revoke_share_token

Revoke a share token so it can no longer be used. Returns \`true\` if revoked.

\`\`\`bash
curl -s https://api.matrummet.se/rpc/revoke_share_token \\
  -H "x-api-key: sk_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"p_token": "abc123"}'
\`\`\`

### get_shared_recipe

Fetch a recipe via share token. No authentication required.

\`\`\`bash
curl -s https://api.matrummet.se/rpc/get_shared_recipe \\
  -H "Content-Type: application/json" \\
  -d '{"p_token": "abc123"}'
\`\`\`

Returns full recipe data including ingredients, instructions, and sharer name. Returns empty if the token is invalid, expired, or revoked.

### copy_shared_recipe

Copy a shared recipe to your own collection using the share token. Returns the new recipe UUID.

\`\`\`bash
curl -s https://api.matrummet.se/rpc/copy_shared_recipe \\
  -H "x-api-key: sk_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"p_token": "abc123"}'
\`\`\`

## Recipe Book Sharing

Share your entire recipe collection with another user via a link.

### create_book_share_token

Create a shareable link for your recipe book.

\`\`\`bash
curl -s https://api.matrummet.se/rpc/create_book_share_token \\
  -H "x-api-key: sk_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"p_expires_days": 30}'
\`\`\`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| p_expires_days | integer | no | Days until expiry (null = never) |

Returns: \`{token, expires_at}\`.

### get_book_share_info

Get info about a book share link before accepting. Works without authentication.

\`\`\`bash
curl -s https://api.matrummet.se/rpc/get_book_share_info \\
  -H "Content-Type: application/json" \\
  -d '{"p_token": "abc123"}'
\`\`\`

Returns: sharer_name, sharer_email, recipe_count, already_connected.

### accept_book_share

Accept a book share link and connect to the sharer's recipe collection.

\`\`\`bash
curl -s https://api.matrummet.se/rpc/accept_book_share \\
  -H "x-api-key: sk_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"p_token": "abc123"}'
\`\`\`

Returns: sharer_name, sharer_id. Idempotent — accepting the same token twice is safe.

### get_shared_books

List recipe books shared with you.

\`\`\`bash
curl -s https://api.matrummet.se/rpc/get_shared_books \\
  -H "x-api-key: sk_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{}'
\`\`\`

Returns: id, sharer_name, sharer_id, created_at.

### revoke_book_share_token

Revoke one of your book share tokens. Returns \`true\` if revoked.

\`\`\`bash
curl -s https://api.matrummet.se/rpc/revoke_book_share_token \\
  -H "x-api-key: sk_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"p_token": "abc123"}'
\`\`\`

### remove_book_share_connection

Remove a book share connection. Either the sharer or recipient can remove it. Returns \`true\` if removed.

\`\`\`bash
curl -s https://api.matrummet.se/rpc/remove_book_share_connection \\
  -H "x-api-key: sk_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"p_connection_id": "uuid-here"}'
\`\`\`

## Search Helpers

### search_foods

Search the food database by name. Useful for finding food IDs for pantry operations.

\`\`\`bash
curl -s https://api.matrummet.se/rpc/search_foods \\
  -H "x-api-key: sk_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"p_query": "tomat", "p_limit": 5}'
\`\`\`

Returns: id, name, rank, status, is_own_pending, canonical_food_id, canonical_food_name.

### search_units

Search available units.

\`\`\`bash
curl -s https://api.matrummet.se/rpc/search_units \\
  -H "x-api-key: sk_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"p_query": "gram", "p_limit": 5}'
\`\`\`

Returns: id, name, plural, abbreviation, rank.

## Pantry

Pantry operations are household-scoped. Include the \`X-Active-Home-Id\` header if you belong to a household.

### add_to_pantry

Add a food item to your pantry. Also used to update expiry on existing items (upsert). Returns the pantry entry UUID.

\`\`\`bash
curl -s https://api.matrummet.se/rpc/add_to_pantry \\
  -H "x-api-key: sk_YOUR_KEY" \\
  -H "X-Active-Home-Id: home-uuid" \\
  -H "Content-Type: application/json" \\
  -d '{"p_food_id": "uuid-here", "p_expires_at": "2025-12-31"}'
\`\`\`

All parameters except \`p_food_id\` are optional: \`p_quantity\` (numeric), \`p_unit\` (text), \`p_expires_at\` (date).

### remove_from_pantry

Remove a food from your pantry.

\`\`\`bash
curl -s https://api.matrummet.se/rpc/remove_from_pantry \\
  -H "x-api-key: sk_YOUR_KEY" \\
  -H "X-Active-Home-Id: home-uuid" \\
  -H "Content-Type: application/json" \\
  -d '{"p_food_id": "uuid-here"}'
\`\`\`

### get_user_pantry

List all items in your pantry.

\`\`\`bash
curl -s https://api.matrummet.se/rpc/get_user_pantry \\
  -H "x-api-key: sk_YOUR_KEY" \\
  -H "X-Active-Home-Id: home-uuid" \\
  -H "Content-Type: application/json" \\
  -d '{}'
\`\`\`

Returns: id, food_id, food_name, quantity, unit, added_at, expires_at, is_expired, added_by.

### get_common_pantry_items

Get commonly added pantry items (for quick-add suggestions).

\`\`\`bash
curl -s https://api.matrummet.se/rpc/get_common_pantry_items \\
  -H "x-api-key: sk_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{}'
\`\`\`

### find_recipes_from_pantry

Find recipes you can make with what's currently in your pantry.

\`\`\`bash
curl -s https://api.matrummet.se/rpc/find_recipes_from_pantry \\
  -H "x-api-key: sk_YOUR_KEY" \\
  -H "X-Active-Home-Id: home-uuid" \\
  -H "Content-Type: application/json" \\
  -d '{"p_min_match_percentage": 50, "p_limit": 10}'
\`\`\`

Returns recipes ranked by ingredient match percentage, including missing ingredients.

### find_recipes_by_ingredients

Find recipes matching specific food IDs (useful when you want to search without relying on pantry state).

\`\`\`bash
curl -s https://api.matrummet.se/rpc/find_recipes_by_ingredients \\
  -H "x-api-key: sk_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "p_food_ids": ["food-uuid-1", "food-uuid-2"],
    "p_user_email": null,
    "p_min_match_percentage": 50,
    "p_limit": 20
  }'
\`\`\`

### deduct_from_pantry

Deduct amounts from pantry items after cooking. Returns count of deducted items.

\`\`\`bash
curl -s https://api.matrummet.se/rpc/deduct_from_pantry \\
  -H "x-api-key: sk_YOUR_KEY" \\
  -H "X-Active-Home-Id: home-uuid" \\
  -H "Content-Type: application/json" \\
  -d '{"p_deductions": [{"food_id": "uuid", "amount": 200}]}'
\`\`\`

## Shopping Lists

Shopping list operations are household-scoped. Include the \`X-Active-Home-Id\` header if you belong to a household.

### create_shopping_list

Create a new shopping list. Returns the list UUID.

\`\`\`bash
curl -s https://api.matrummet.se/rpc/create_shopping_list \\
  -H "x-api-key: sk_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"p_name": "Veckans inköp"}'
\`\`\`

Optional: \`p_home_id\` (uuid) to create a shared household list.

### get_user_shopping_lists

List all your shopping lists with item counts.

\`\`\`bash
curl -s https://api.matrummet.se/rpc/get_user_shopping_lists \\
  -H "x-api-key: sk_YOUR_KEY" \\
  -H "X-Active-Home-Id: home-uuid" \\
  -H "Content-Type: application/json" \\
  -d '{}'
\`\`\`

Returns: id, name, is_default, item_count, checked_count, date_published, date_modified, home_id, home_name.

### add_recipe_to_shopping_list

Add a recipe's ingredients to a shopping list.

\`\`\`bash
curl -s https://api.matrummet.se/rpc/add_recipe_to_shopping_list \\
  -H "x-api-key: sk_YOUR_KEY" \\
  -H "X-Active-Home-Id: home-uuid" \\
  -H "Content-Type: application/json" \\
  -d '{"p_recipe_id": "uuid-here", "p_servings": 4}'
\`\`\`

Optional: \`p_shopping_list_id\` (null = default list), \`p_ingredient_ids\` (uuid[], null = all).

### add_custom_shopping_list_item

Add a custom (non-recipe) item to a shopping list.

\`\`\`bash
curl -s https://api.matrummet.se/rpc/add_custom_shopping_list_item \\
  -H "x-api-key: sk_YOUR_KEY" \\
  -H "X-Active-Home-Id: home-uuid" \\
  -H "Content-Type: application/json" \\
  -d '{"p_name": "Hushållspapper", "p_shopping_list_id": "uuid-here"}'
\`\`\`

Optional: \`p_food_id\` (uuid) to link to a food item.

### toggle_shopping_list_item

Check/uncheck a shopping list item.

\`\`\`bash
curl -s https://api.matrummet.se/rpc/toggle_shopping_list_item \\
  -H "x-api-key: sk_YOUR_KEY" \\
  -H "X-Active-Home-Id: home-uuid" \\
  -H "Content-Type: application/json" \\
  -d '{"p_item_id": "uuid-here"}'
\`\`\`

### clear_checked_items

Remove all checked items from a shopping list.

\`\`\`bash
curl -s https://api.matrummet.se/rpc/clear_checked_items \\
  -H "x-api-key: sk_YOUR_KEY" \\
  -H "X-Active-Home-Id: home-uuid" \\
  -H "Content-Type: application/json" \\
  -d '{"p_shopping_list_id": "uuid-here"}'
\`\`\`

If \`p_shopping_list_id\` is null, clears from the default list.

### rename_shopping_list

\`\`\`bash
curl -s https://api.matrummet.se/rpc/rename_shopping_list \\
  -H "x-api-key: sk_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"p_list_id": "uuid-here", "p_name": "Nytt namn"}'
\`\`\`

### set_default_shopping_list

Set which shopping list is your default.

\`\`\`bash
curl -s https://api.matrummet.se/rpc/set_default_shopping_list \\
  -H "x-api-key: sk_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"p_list_id": "uuid-here"}'
\`\`\`

### delete_shopping_list

Delete a shopping list and all its items.

\`\`\`bash
curl -s https://api.matrummet.se/rpc/delete_shopping_list \\
  -H "x-api-key: sk_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"p_list_id": "uuid-here"}'
\`\`\`

### Reading shopping list items

Shopping list items are read via the \`shopping_list_view\` view:

\`\`\`bash
curl -s "https://api.matrummet.se/shopping_list_view?shopping_list_id=eq.LIST_UUID&order=is_checked.asc,sort_order.asc" \\
  -H "x-api-key: sk_YOUR_KEY" \\
  -H "X-Active-Home-Id: home-uuid"
\`\`\`

## Meal Plans

Meal plans are household-scoped. Include the \`X-Active-Home-Id\` header if you belong to a household.

### get_meal_plan

Get the current active meal plan, or a specific plan by ID.

\`\`\`bash
curl -s https://api.matrummet.se/rpc/get_meal_plan \\
  -H "x-api-key: sk_YOUR_KEY" \\
  -H "X-Active-Home-Id: home-uuid" \\
  -H "Content-Type: application/json" \\
  -d '{"p_plan_id": null}'
\`\`\`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| p_plan_id | uuid | no | Specific plan ID (null = latest active) |

Returns a JSON object with plan details and entries array. Each entry has day_of_week, meal_type, recipe info, servings, etc. Returns null if no active plan.

### save_meal_plan

Save a new meal plan. Archives any existing active plan for the same user/home.

\`\`\`bash
curl -s https://api.matrummet.se/rpc/save_meal_plan \\
  -H "x-api-key: sk_YOUR_KEY" \\
  -H "X-Active-Home-Id: home-uuid" \\
  -H "Content-Type: application/json" \\
  -d '{
    "p_week_start": "2026-02-23",
    "p_preferences": {},
    "p_entries": [
      {"day_of_week": 0, "meal_type": "dinner", "recipe_id": "uuid-here", "servings": 4, "sort_order": 0},
      {"day_of_week": 1, "meal_type": "dinner", "suggested_name": "Tacos", "suggested_description": "Fredagsmys", "servings": 4, "sort_order": 0}
    ]
  }'
\`\`\`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| p_week_start | date | yes | Monday of the week |
| p_preferences | jsonb | yes | Diet preferences (can be \`{}\`) |
| p_entries | jsonb | yes | Array of meal plan entries |

Returns the new plan UUID.

### swap_meal_plan_entry

Replace a single entry in an existing meal plan.

\`\`\`bash
curl -s https://api.matrummet.se/rpc/swap_meal_plan_entry \\
  -H "x-api-key: sk_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"p_entry_id": "uuid-here", "p_recipe_id": "new-recipe-uuid"}'
\`\`\`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| p_entry_id | uuid | yes | Entry to replace |
| p_recipe_id | uuid | no | New recipe ID |
| p_suggested_name | text | no | Name for non-recipe entry |
| p_suggested_description | text | no | Description for non-recipe entry |

At least one of \`p_recipe_id\` or \`p_suggested_name\` must be provided.

### add_meal_plan_to_shopping_list

Add all recipe ingredients from a meal plan to a shopping list.

\`\`\`bash
curl -s https://api.matrummet.se/rpc/add_meal_plan_to_shopping_list \\
  -H "x-api-key: sk_YOUR_KEY" \\
  -H "X-Active-Home-Id: home-uuid" \\
  -H "Content-Type: application/json" \\
  -d '{"p_plan_id": "uuid-here", "p_shopping_list_id": null}'
\`\`\`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| p_plan_id | uuid | yes | Meal plan to add from |
| p_shopping_list_id | uuid | no | Target list (null = default) |

Returns \`{"recipes_added": N}\`.

### get_base_recipes

Get random recipes from the curated base recipe pool (Swedish dinner recipes). Useful for meal plan suggestions.

\`\`\`bash
curl -s https://api.matrummet.se/rpc/get_base_recipes \\
  -H "x-api-key: sk_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"p_diet_types": ["vegetarian", "vegan"], "p_categories": null, "p_limit": 10}'
\`\`\`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| p_diet_types | text[] | no | Filter: "vegan", "vegetarian", "pescetarian", "meat" |
| p_categories | text[] | no | Filter by category names |
| p_limit | integer | no | Max results (default: 50) |

## Household

### get_user_homes

List all households you belong to.

\`\`\`bash
curl -s https://api.matrummet.se/rpc/get_user_homes \\
  -H "x-api-key: sk_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{}'
\`\`\`

### create_home

Create a new household. Returns the home UUID.

\`\`\`bash
curl -s https://api.matrummet.se/rpc/create_home \\
  -H "x-api-key: sk_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"p_name": "Familjen"}'
\`\`\`

### get_home_info

Get household details including members.

\`\`\`bash
curl -s https://api.matrummet.se/rpc/get_home_info \\
  -H "x-api-key: sk_YOUR_KEY" \\
  -H "X-Active-Home-Id: home-uuid" \\
  -H "Content-Type: application/json" \\
  -d '{"p_home_id": null}'
\`\`\`

If \`p_home_id\` is null, returns info for your current home. Returns JSON with home details and member list (or null if no home).

### update_home_name

\`\`\`bash
curl -s https://api.matrummet.se/rpc/update_home_name \\
  -H "x-api-key: sk_YOUR_KEY" \\
  -H "X-Active-Home-Id: home-uuid" \\
  -H "Content-Type: application/json" \\
  -d '{"p_name": "Nytt namn"}'
\`\`\`

### invite_to_home

Invite a user by email. Returns an invitation UUID.

\`\`\`bash
curl -s https://api.matrummet.se/rpc/invite_to_home \\
  -H "x-api-key: sk_YOUR_KEY" \\
  -H "X-Active-Home-Id: home-uuid" \\
  -H "Content-Type: application/json" \\
  -d '{"p_email": "someone@example.com"}'
\`\`\`

### generate_join_code

Generate a shareable join code for your household.

\`\`\`bash
curl -s https://api.matrummet.se/rpc/generate_join_code \\
  -H "x-api-key: sk_YOUR_KEY" \\
  -H "X-Active-Home-Id: home-uuid" \\
  -H "Content-Type: application/json" \\
  -d '{"p_expires_hours": 48}'
\`\`\`

### join_home_by_code

Join a household using a code.

\`\`\`bash
curl -s https://api.matrummet.se/rpc/join_home_by_code \\
  -H "x-api-key: sk_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"p_code": "ABC123"}'
\`\`\`

### leave_home

Leave a household.

\`\`\`bash
curl -s https://api.matrummet.se/rpc/leave_home \\
  -H "x-api-key: sk_YOUR_KEY" \\
  -H "X-Active-Home-Id: home-uuid" \\
  -H "Content-Type: application/json" \\
  -d '{}'
\`\`\`

### remove_home_member

Remove another member from your household.

\`\`\`bash
curl -s https://api.matrummet.se/rpc/remove_home_member \\
  -H "x-api-key: sk_YOUR_KEY" \\
  -H "X-Active-Home-Id: home-uuid" \\
  -H "Content-Type: application/json" \\
  -d '{"p_member_email": "someone@example.com"}'
\`\`\`

### get_pending_invitations

List household invitations sent to you.

\`\`\`bash
curl -s https://api.matrummet.se/rpc/get_pending_invitations \\
  -H "x-api-key: sk_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{}'
\`\`\`

Returns: id, home_id, home_name, invited_by_email, invited_by_name, token, expires_at, date_published.

### accept_invitation

Accept a household invitation. Returns the home UUID.

\`\`\`bash
curl -s https://api.matrummet.se/rpc/accept_invitation \\
  -H "x-api-key: sk_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"p_token": "invitation-token-here"}'
\`\`\`

### decline_invitation

Decline a household invitation.

\`\`\`bash
curl -s https://api.matrummet.se/rpc/decline_invitation \\
  -H "x-api-key: sk_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"p_token": "invitation-token-here"}'
\`\`\`

### disable_join_code

Disable the current join code for your household so it can no longer be used.

\`\`\`bash
curl -s https://api.matrummet.se/rpc/disable_join_code \\
  -H "x-api-key: sk_YOUR_KEY" \\
  -H "X-Active-Home-Id: home-uuid" \\
  -H "Content-Type: application/json" \\
  -d '{}'
\`\`\`

## Credits

AI-powered features (recipe generation, meal plans) cost credits.

### get_user_credits

Get your current credit balance.

\`\`\`bash
curl -s https://api.matrummet.se/rpc/get_user_credits \\
  -H "x-api-key: sk_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{}'
\`\`\`

Returns an integer (your current balance).

### get_credit_history

Get your credit transaction history.

\`\`\`bash
curl -s https://api.matrummet.se/rpc/get_credit_history \\
  -H "x-api-key: sk_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"p_limit": 50, "p_offset": 0}'
\`\`\`

Returns: id, amount, balance_after, transaction_type, description, created_at.

## API Key Management

### get_user_api_keys

List your API keys (the full key is only shown at creation).

\`\`\`bash
curl -s https://api.matrummet.se/rpc/get_user_api_keys \\
  -H "x-api-key: sk_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{}'
\`\`\`

Returns: id, name, api_key_prefix, last_used_at, expires_at, is_active, date_published.

### create_user_api_key

Create a new API key. The full key is only returned once.

\`\`\`bash
curl -s https://api.matrummet.se/rpc/create_user_api_key \\
  -H "x-api-key: sk_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"p_name": "My integration"}'
\`\`\`

Returns a JSON object with the full API key. Store it securely — it cannot be retrieved later.

### revoke_api_key

Revoke an API key so it can no longer be used.

\`\`\`bash
curl -s https://api.matrummet.se/rpc/revoke_api_key \\
  -H "x-api-key: sk_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"p_key_id": "uuid-here"}'
\`\`\`

## Direct Table Access

PostgREST exposes tables and views directly. Use standard PostgREST query syntax:

\`\`\`bash
# Get your recipes via the user_recipes view
curl -s "https://api.matrummet.se/user_recipes?limit=10&order=date_modified.desc" \\
  -H "x-api-key: sk_YOUR_KEY"

# Filter by column
curl -s "https://api.matrummet.se/user_recipes?name=ilike.*pasta*" \\
  -H "x-api-key: sk_YOUR_KEY"

# Select specific columns
curl -s "https://api.matrummet.se/user_recipes?select=id,name,categories&limit=5" \\
  -H "x-api-key: sk_YOUR_KEY"

# Browse public recipes
curl -s "https://api.matrummet.se/public_recipes?limit=10&order=date_modified.desc" \\
  -H "x-api-key: sk_YOUR_KEY"

# Get your liked recipes
curl -s "https://api.matrummet.se/liked_recipes?limit=10" \\
  -H "x-api-key: sk_YOUR_KEY"

# Featured recipes
curl -s "https://api.matrummet.se/featured_recipes?limit=5" \\
  -H "x-api-key: sk_YOUR_KEY"
\`\`\`

**Available views:** \`user_recipes\`, \`public_recipes\`, \`liked_recipes\`, \`featured_recipes\`, \`shopping_list_view\`.

Common operators: \`eq\`, \`neq\`, \`gt\`, \`lt\`, \`gte\`, \`lte\`, \`like\`, \`ilike\`, \`in\`, \`is\`.

See the [PostgREST documentation](https://postgrest.org/en/stable/references/api/tables_views.html) for full query syntax.

## Limits

- Maximum 1000 rows per request
- Default pagination: use \`limit\` and \`offset\` query parameters
- RLS enforced: you can only modify your own data

## OpenAPI Spec

For a machine-readable OpenAPI specification:

\`\`\`bash
curl -s https://api.matrummet.se/ -H "Accept: application/openapi+json"
\`\`\`

This returns a full Swagger 2.0 spec with all endpoints, parameters, and schemas.
`

export const Route = createFileRoute('/api/docs')({
  server: {
    handlers: {
      GET: async () => {
        return new Response(DOCS, {
          headers: {
            'Content-Type': 'text/markdown; charset=utf-8',
            'Cache-Control': 'public, max-age=3600',
          },
        })
      },
    },
  },
})
