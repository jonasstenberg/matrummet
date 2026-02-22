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
| p_image | text | no | Image ID from /upload (UUID) |
| p_thumbnail | text | no | Thumbnail ID from /upload (UUID, can be same as p_image) |

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

## Images

Images are handled by a separate image service on \`api.matrummet.se\`. Upload an image, get back a UUID, and link it to a recipe via \`p_image\` / \`p_thumbnail\`.

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

Use the UUID from upload as \`p_image\` and/or \`p_thumbnail\` when calling \`insert_recipe\` or \`update_recipe\`:

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
    "p_thumbnail": "'$IMAGE_ID'",
    ...
  }'
\`\`\`

Images are automatically cleaned up when a recipe is deleted or when the image is replaced — you never need to delete images manually. When using \`copy_recipe\`, the copy shares the same image and it won't be deleted until no recipe references it.

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
\`\`\`

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
