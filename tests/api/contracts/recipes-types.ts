/**
 * Shared types and setup helpers for recipe contract tests.
 */

import {
  createAuthenticatedClient,
  createAnonymousClient,
  TEST_USERS,
  type PostgrestClient,
} from "../setup";
import {
  createTestUser,
  cleanupTestData,
  leaveAllHomes,
} from "../seed";

// Recipe shape from user_recipes view (V68-V72)
// Note: owner email removed in V72 for privacy, use is_owner and owner_id instead
export interface RecipeFromView {
  id: string;
  name: string;
  description: string;
  author: string | null;
  url: string | null;
  owner_id: string;
  owner_name: string;
  recipe_yield: number | null;
  recipe_yield_name: string | null;
  prep_time: number | null;
  cook_time: number | null;
  cuisine: string | null;
  image: string | null;
  thumbnail: string | null;
  date_published: string | null;
  date_modified: string | null;
  visibility: string;
  categories: string[];
  ingredient_groups: IngredientGroup[] | null;
  ingredients: Ingredient[] | null;
  instruction_groups: InstructionGroup[] | null;
  instructions: Instruction[] | null;
  is_liked: boolean;
  is_owner: boolean;
  is_copy: boolean;
  copied_from_recipe_id: string | null;
  copied_from_author_name: string | null;
  // Pantry match fields (V52)
  pantry_matching_count: number;
  pantry_total_count: number;
  pantry_match_percentage: number;
  // Internal fields from view - may not be needed in frontend
  full_tsv?: unknown;
}

export interface IngredientGroup {
  id: string;
  name: string;
  sort_order: number;
}

export interface Ingredient {
  id: string;
  name: string;
  measurement: string;
  quantity: string;
  form: string | null;
  group_id: string | null;
  sort_order: number;
  food_id: string | null;
  unit_id: string | null;
  in_pantry: boolean;
}

export interface InstructionGroup {
  id: string;
  name: string;
  sort_order: number;
}

export interface MatchedIngredient {
  id: string;
  name: string;
  quantity: string | null;
  measurement: string | null;
}

export interface Instruction {
  id: string;
  step: string;
  group_id: string | null;
  sort_order: number;
  matched_ingredients: MatchedIngredient[];
}

// Extended recipe type for liked recipes with liked_at
export interface LikedRecipe extends RecipeFromView {
  liked_at: string;
}

// Toggle like response shape
export interface ToggleLikeResponse {
  liked: boolean;
}

/**
 * Shared test context with authenticated clients and household setup.
 * Most recipe tests need two users sharing a household.
 */
export interface RecipeTestContext {
  clientA: PostgrestClient;
  clientB: PostgrestClient;
  anonymousClient: PostgrestClient;
}

/**
 * Set up two users sharing a household (required for cross-user recipe tests).
 */
export async function setupRecipeTestContext(): Promise<RecipeTestContext> {
  await createTestUser(TEST_USERS.userA);
  await createTestUser(TEST_USERS.userB);

  const clientA = await createAuthenticatedClient(TEST_USERS.userA.email);
  const clientB = await createAuthenticatedClient(TEST_USERS.userB.email);
  const anonymousClient = createAnonymousClient();

  await leaveAllHomes(clientA);
  await leaveAllHomes(clientB);

  // User B creates a home
  const homeResult = await clientB.rpc<string>("create_home", {
    p_name: `Recipe Test Home ${Date.now()}`,
  });
  if (homeResult.error) {
    throw new Error(`Failed to create home: ${homeResult.error.message}`);
  }

  // Generate a join code for the home
  const joinCodeResult = await clientB.rpc<string>("generate_join_code");
  if (joinCodeResult.error) {
    throw new Error(`Failed to generate join code: ${joinCodeResult.error.message}`);
  }
  const joinCode = joinCodeResult.data;
  if (!joinCode) {
    throw new Error("No join code returned");
  }

  // User A joins the home using the code
  const joinResult = await clientA.rpc("join_home_by_code", {
    p_code: joinCode,
  });
  if (joinResult.error) {
    throw new Error(`Failed to join home: ${joinResult.error.message}`);
  }

  return { clientA, clientB, anonymousClient };
}

/**
 * Tear down the household and clean up test data.
 */
export async function teardownRecipeTestContext(ctx: RecipeTestContext): Promise<void> {
  await leaveAllHomes(ctx.clientA);
  await leaveAllHomes(ctx.clientB);
  await cleanupTestData(TEST_USERS.userA.email);
  await cleanupTestData(TEST_USERS.userB.email);
}
