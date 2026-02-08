/**
 * Test data seeding utilities
 *
 * Creates and cleans up test data for API tests
 */

import {
  createAuthenticatedClient,
  createAdminClient,
  createAnonymousClient,
  TEST_USERS,
  type PostgrestClient,
} from "./setup";

// Track created resources for cleanup
interface CreatedResources {
  recipes: string[];
  categories: string[];
  shoppingLists: string[];
  users: string[];
  homes: string[];
  apiKeys: string[];
  foods: string[];
}

let createdResources: CreatedResources = {
  recipes: [],
  categories: [],
  shoppingLists: [],
  users: [],
  homes: [],
  apiKeys: [],
  foods: [],
};

/**
 * Reset the tracking of created resources
 */
export function resetCreatedResources(): void {
  createdResources = {
    recipes: [],
    categories: [],
    shoppingLists: [],
    users: [],
    homes: [],
    apiKeys: [],
    foods: [],
  };
}

/**
 * Create a test user via the signup RPC
 *
 * The security-hardened signup function returns a generic "signup-failed" error
 * for both existing users and other failures to prevent user enumeration.
 * So we try login first if the user might already exist.
 */
export async function createTestUser(user: {
  email: string;
  name: string;
  password: string;
}): Promise<{ id: string }> {
  const client = createAnonymousClient();

  // First, try to login in case user already exists from previous test runs
  const loginResult = await client.rpc<{ id: string }>("login", {
    login_email: user.email,
    login_password: user.password,
  });

  if (!loginResult.error && loginResult.data) {
    // User exists and login succeeded
    return { id: loginResult.data.id ?? user.email };
  }

  // User doesn't exist, try to create
  // Note: p_provider must be null for password-based signup
  const result = await client.rpc<{ id: string }>("signup", {
    p_name: user.name,
    p_email: user.email,
    p_password: user.password,
    p_provider: null,
  });

  if (result.error) {
    // Signup failed - could be duplicate, rate limiting, or actual failure
    // Try login again to verify the user actually exists in the database
    const verifyLogin = await client.rpc<{ id: string }>("login", {
      login_email: user.email,
      login_password: user.password,
    });

    if (!verifyLogin.error && verifyLogin.data) {
      // User exists (likely was created by a concurrent test or previous run)
      return { id: verifyLogin.data.id ?? user.email };
    }

    // User doesn't exist and we couldn't create them - this is an actual failure
    throw new Error(
      `Failed to create test user ${user.email}: ${result.error.message}. ` +
      `Login verification also failed: ${verifyLogin.error?.message ?? "unknown error"}`
    );
  }

  createdResources.users.push(user.email);
  return result.data!;
}

/**
 * Create all standard test users
 */
export async function seedTestUsers(): Promise<void> {
  await createTestUser(TEST_USERS.userA);
  await createTestUser(TEST_USERS.userB);
  // Admin user may need special handling
}

/**
 * Create a test recipe
 */
export async function createTestRecipe(
  client: PostgrestClient,
  overrides?: Partial<{
    name: string;
    description: string;
    author: string;
    categories: string[];
    ingredients: Array<{ name: string; measurement: string; quantity: string }>;
    instructions: Array<{ step: string }>;
    recipe_yield: number;
    prep_time: number;
    cook_time: number;
  }>
): Promise<string> {
  const recipeData = {
    p_name: overrides?.name ?? `Test Recipe ${Date.now()}`,
    p_description: overrides?.description ?? "A test recipe for API testing",
    p_author: overrides?.author ?? "Test Author",
    p_url: null,
    p_recipe_yield: overrides?.recipe_yield ?? 4,
    p_recipe_yield_name: "portioner",
    p_prep_time: overrides?.prep_time ?? 15,
    p_cook_time: overrides?.cook_time ?? 30,
    p_cuisine: "Swedish",
    p_image: null,
    p_thumbnail: null,
    p_categories: overrides?.categories ?? ["Middag"],
    p_ingredients: overrides?.ingredients ?? [
      { name: "Salt", measurement: "tsk", quantity: "1" },
      { name: "Vatten", measurement: "dl", quantity: "2" },
    ],
    p_instructions: overrides?.instructions ?? [
      { step: "Blanda alla ingredienser." },
      { step: "Servera." },
    ],
  };

  const result = await client.rpc<string>("insert_recipe", recipeData);

  if (result.error) {
    throw new Error(`Failed to create test recipe: ${result.error.message}`);
  }

  const recipeId = result.data!;
  createdResources.recipes.push(recipeId);

  return recipeId;
}

/**
 * Create a test category
 *
 * Note: categories INSERT is admin-only since V12.
 * We use an admin client for this setup operation.
 */
export async function createTestCategory(
  _client: PostgrestClient,
  name?: string
): Promise<{ id: string; name: string }> {
  const categoryName = name ?? `Test Category ${Date.now()}`;
  const adminCli = await createAdminClient(TEST_USERS.admin.email);

  const result = await adminCli
    .from("categories")
    .insert({ name: categoryName })
    .select()
    .single();

  if (result.error) {
    throw new Error(`Failed to create test category: ${result.error.message}`);
  }

  const category = result.data as { id: string; name: string };
  createdResources.categories.push(category.id);
  return category;
}

/**
 * Create a test shopping list
 *
 * Automatically ensures the user has a home, since shopping lists require a home.
 */
export async function createTestShoppingList(
  client: PostgrestClient,
  name?: string
): Promise<string> {
  // Ensure user has a home (shopping lists require a home)
  await ensureUserHasHome(client);

  const listName = name ?? `Test List ${Date.now()}`;

  const result = await client.rpc<string>("create_shopping_list", {
    p_name: listName,
  });

  if (result.error) {
    throw new Error(`Failed to create shopping list: ${result.error.message}`);
  }

  const listId = result.data!;
  createdResources.shoppingLists.push(listId);
  return listId;
}

/**
 * Add an item to a shopping list (direct insert)
 *
 * Note: RLS requires home_id to match the user's current home.
 * We fetch the home_id from the shopping list to ensure consistency.
 */
export async function addShoppingListItem(
  client: PostgrestClient,
  shoppingListId: string,
  item: {
    display_name: string;
    display_unit?: string;
    quantity?: number;
  }
): Promise<string> {
  // First, get the home_id and user_email from the shopping list
  // This is needed because RLS requires home_id = get_current_user_home_id()
  const listResult = await client
    .from("shopping_lists")
    .select("home_id, user_email")
    .eq("id", shoppingListId)
    .single();

  if (listResult.error) {
    throw new Error(`Failed to get shopping list: ${listResult.error.message}`);
  }

  const { home_id, user_email } = listResult.data as {
    home_id: string;
    user_email: string;
  };

  if (!home_id) {
    throw new Error(
      `Shopping list ${shoppingListId} has no home_id - user may not have a home`
    );
  }

  const result = await client
    .from("shopping_list_items")
    .insert({
      shopping_list_id: shoppingListId,
      home_id: home_id,
      display_name: item.display_name,
      display_unit: item.display_unit ?? "",
      quantity: item.quantity ?? 1,
      user_email: user_email,
    })
    .select("id")
    .single();

  if (result.error) {
    throw new Error(`Failed to add shopping list item: ${result.error.message}`);
  }

  return (result.data as { id: string }).id;
}

/**
 * Ensure the user has a home, creating one if needed.
 * Returns the home ID.
 */
export async function ensureUserHasHome(
  client: PostgrestClient,
  homeName?: string
): Promise<string> {
  // Check if user already has a home
  const homeInfo = await client.rpc<{ id: string; name: string } | null>(
    "get_home_info"
  );

  if (!homeInfo.error && homeInfo.data && homeInfo.data.id) {
    return homeInfo.data.id;
  }

  // User has no home, create one
  const name = homeName ?? `Test Home ${Date.now()}`;
  const result = await client.rpc<string>("create_home", {
    p_name: name,
  });

  if (result.error) {
    throw new Error(`Failed to create home: ${result.error.message}`);
  }

  const homeId = result.data!;
  createdResources.homes.push(homeId);
  return homeId;
}

/**
 * Create a test home
 *
 * If the user already has a home, this will leave the current home first
 * and then create a new one. This ensures test isolation.
 */
export async function createTestHome(
  client: PostgrestClient,
  name?: string
): Promise<string> {
  const homeName = name ?? `Test Home ${Date.now()}`;

  // First attempt to create home
  let result = await client.rpc<string>("create_home", {
    p_name: homeName,
  });

  // If user already has a home, leave it first and try again
  if (result.error?.message?.includes("user-already-has-home")) {
    await client.rpc("leave_home");
    result = await client.rpc<string>("create_home", {
      p_name: homeName,
    });
  }

  if (result.error) {
    throw new Error(`Failed to create home: ${result.error.message}`);
  }

  const homeId = result.data!;
  createdResources.homes.push(homeId);
  return homeId;
}

/**
 * Create a test API key
 */
export async function createTestApiKey(
  client: PostgrestClient,
  name?: string
): Promise<{ id: string; api_key: string; prefix: string }> {
  const keyName = name ?? `Test API Key ${Date.now()}`;

  const result = await client.rpc<{
    id: string;
    api_key: string;
    api_key_prefix: string;
  }>("create_user_api_key", {
    p_name: keyName,
  });

  if (result.error) {
    throw new Error(`Failed to create API key: ${result.error.message}`);
  }

  const keyData = result.data!;
  createdResources.apiKeys.push(keyData.id);
  return {
    id: keyData.id,
    api_key: keyData.api_key,
    prefix: keyData.api_key_prefix,
  };
}

/**
 * Add item to pantry
 *
 * Automatically ensures the user has a home, since pantry requires a home.
 */
export async function addToPantry(
  client: PostgrestClient,
  foodId: string,
  options?: { quantity?: number; unit?: string }
): Promise<string> {
  // Ensure user has a home (pantry requires a home)
  await ensureUserHasHome(client);

  const result = await client.rpc<string>("add_to_pantry", {
    p_food_id: foodId,
    p_quantity: options?.quantity ?? 1,
    p_unit: options?.unit ?? "st",
    p_expires_at: null,
  });

  if (result.error) {
    throw new Error(`Failed to add to pantry: ${result.error.message}`);
  }

  return result.data!;
}

/**
 * Get or create a food item
 *
 * Note: The get_or_create_food RPC is an internal function (grant revoked from
 * authenticated in V13). We use an admin client for this setup operation.
 * The client param is kept for API compatibility but ignored.
 */
export async function getOrCreateFood(
  _client: PostgrestClient,
  name: string
): Promise<{ id: string; name: string }> {
  const adminCli = await createAdminClient(TEST_USERS.admin.email);
  const result = await adminCli.rpc<string>(
    "get_or_create_food",
    { p_name: name }
  );

  if (result.error) {
    throw new Error(`Failed to get/create food: ${result.error.message}`);
  }

  const foodId = result.data;
  if (!foodId) {
    throw new Error(`Failed to get/create food: no ID returned for "${name}"`);
  }

  createdResources.foods.push(foodId);
  return { id: foodId, name: name };
}

/**
 * Create a pending food owned by a specific user.
 * Uses admin client for INSERT (table grants) but sets created_by to the user's email.
 */
export async function createPendingFoodForUser(
  userEmail: string,
  name: string
): Promise<{ id: string; name: string }> {
  const adminCli = await createAdminClient(TEST_USERS.admin.email);

  const result = await adminCli
    .from("foods")
    .insert({ name, status: "pending", created_by: userEmail })
    .select("id, name")
    .single();

  if (result.error) {
    throw new Error(`Failed to create pending food: ${result.error.message}`);
  }

  const food = result.data as { id: string; name: string };
  createdResources.foods.push(food.id);
  return food;
}

/**
 * Clean up all created test data
 */
export async function cleanupTestData(userEmail: string): Promise<void> {
  const client = await createAuthenticatedClient(userEmail);

  // Delete in reverse order of dependencies
  for (const keyId of createdResources.apiKeys) {
    try {
      await client.rpc("revoke_api_key", { p_key_id: keyId });
    } catch {
      // Ignore cleanup errors
    }
  }

  for (const listId of createdResources.shoppingLists) {
    try {
      await client.rpc("delete_shopping_list", { p_list_id: listId });
    } catch {
      // Ignore cleanup errors
    }
  }

  for (const recipeId of createdResources.recipes) {
    try {
      await client.from("recipes").delete().eq("id", recipeId);
    } catch {
      // Ignore cleanup errors
    }
  }

  for (const categoryId of createdResources.categories) {
    try {
      await client.from("categories").delete().eq("id", categoryId);
    } catch {
      // Ignore cleanup errors
    }
  }

  // Leave homes and users for now - they're harder to clean up

  resetCreatedResources();
}

/**
 * Generate unique test data identifier
 */
export function uniqueId(prefix = "test"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Refresh the recipe_ingredient_summary materialized view.
 * Call this after creating recipes in tests that use find_recipes_by_ingredients
 * to ensure the view is up-to-date.
 *
 * Note: refresh_recipe_ingredient_summary is admin-only since V13.
 * We use an admin client regardless of what's passed in.
 */
export async function refreshRecipeIngredientSummary(
  _client: PostgrestClient
): Promise<void> {
  const adminCli = await createAdminClient(TEST_USERS.admin.email);
  const result = await adminCli.rpc("refresh_recipe_ingredient_summary", {});
  if (result.error) {
    throw new Error(`Failed to refresh recipe ingredient summary: ${result.error.message}`);
  }
}

/**
 * Sample recipe data for testing
 */
export const SAMPLE_RECIPES = {
  simple: {
    name: "Enkel Sallad",
    description: "En enkel sallad",
    author: "Test Chef",
    categories: ["Förrätt"],
    ingredients: [
      { name: "Sallad", measurement: "st", quantity: "1" },
      { name: "Tomat", measurement: "st", quantity: "2" },
    ],
    instructions: [{ step: "Tvätta salladen." }, { step: "Skär tomaterna." }],
    recipe_yield: 2,
    prep_time: 10,
    cook_time: 0,
  },
  complex: {
    name: "Köttbullar med Potatis",
    description: "Klassiska svenska köttbullar med potatismos",
    author: "Mamma",
    categories: ["Middag", "Svenskt"],
    ingredients: [
      { name: "Köttfärs", measurement: "g", quantity: "500" },
      { name: "Lök", measurement: "st", quantity: "1" },
      { name: "Ägg", measurement: "st", quantity: "1" },
      { name: "Ströbröd", measurement: "dl", quantity: "1" },
      { name: "Mjölk", measurement: "dl", quantity: "1" },
      { name: "Potatis", measurement: "kg", quantity: "1" },
      { name: "Smör", measurement: "msk", quantity: "2" },
    ],
    instructions: [
      { step: "Blanda köttfärs med lök, ägg, ströbröd och mjölk." },
      { step: "Forma till bullar." },
      { step: "Stek bullarna i smör." },
      { step: "Koka potatisen." },
      { step: "Mosa potatisen med smör." },
    ],
    recipe_yield: 4,
    prep_time: 20,
    cook_time: 30,
  },
};
