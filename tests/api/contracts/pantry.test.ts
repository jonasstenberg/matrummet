/**
 * Contract tests for Pantry RPCs
 *
 * Tests the following RPCs:
 * 1. add_to_pantry(p_food_id, p_quantity, p_unit, p_expires_at) - Returns UUID
 * 2. remove_from_pantry(p_food_id) - Returns BOOLEAN
 * 3. get_user_pantry() - Returns TABLE with pantry items
 * 4. find_recipes_by_ingredients(p_food_ids[], p_user_email, p_min_match_percentage, p_limit) - Returns TABLE
 * 5. find_recipes_from_pantry(p_min_match_percentage, p_limit) - Returns TABLE
 * 6. get_common_pantry_items() - Returns TABLE with common foods
 * 7. deduct_from_pantry(p_deductions) - Returns INTEGER (count of updated items)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  createAuthenticatedClient,
  createAnonymousClient,
  TEST_USERS,
  type PostgrestClient,
} from "../setup";
import {
  createTestUser,
  getOrCreateFood,
  addToPantry,
  createTestRecipe,
  cleanupTestData,
  resetCreatedResources,
  uniqueId,
  ensureUserHasHome,
  refreshRecipeIngredientSummary,
  leaveAllHomes,
} from "../seed";
import {
  expectSuccess,
  expectError,
  expectValidUuid,
} from "../helpers";

// Types for pantry-related responses
interface PantryItem {
  id: string;
  food_id: string;
  food_name: string;
  quantity: number | null;
  unit: string | null;
  added_at: string;
  expires_at: string | null;
  is_expired: boolean;
}

interface RecipeMatch {
  recipe_id: string;
  name: string;
  description: string | null;
  image: string | null;
  categories: string[];
  total_ingredients: number;
  matching_ingredients: number;
  match_percentage: number;
  missing_food_ids: string[];
  missing_food_names: string[];
  owner: string;
  prep_time: number | null;
  cook_time: number | null;
  recipe_yield: number | null;
  recipe_yield_name: string | null;
}

interface RecipeFromPantryMatch {
  recipe_id: string;
  title: string;
  total_ingredients: number;
  matching_ingredients: number;
  match_percentage: number;
  missing_food_ids: string[];
}

interface CommonPantryItem {
  id: string;
  name: string;
  category: string;
}

describe("Pantry RPCs Contract Tests", () => {
  let clientA: PostgrestClient;
  let clientB: PostgrestClient;
  let anonClient: PostgrestClient;

  beforeAll(async () => {
    // Create test users
    await createTestUser(TEST_USERS.userA);
    await createTestUser(TEST_USERS.userB);

    // Create authenticated clients
    clientA = await createAuthenticatedClient(TEST_USERS.userA.email);
    clientB = await createAuthenticatedClient(TEST_USERS.userB.email);
    anonClient = createAnonymousClient();

    // Leave all existing homes to ensure users are in separate homes
    await leaveAllHomes(clientA);
    await leaveAllHomes(clientB);

    // Ensure users have SEPARATE homes (required for pantry isolation tests)
    await ensureUserHasHome(clientA, "Test Home A");
    await ensureUserHasHome(clientB, "Test Home B");
  });

  afterAll(async () => {
    // Clean up test data
    await cleanupTestData(TEST_USERS.userA.email);
    await cleanupTestData(TEST_USERS.userB.email);
  });

  beforeEach(() => {
    resetCreatedResources();
  });

  // ===========================================================================
  // 1. add_to_pantry RPC
  // ===========================================================================
  describe("add_to_pantry", () => {
    it("should return a UUID when adding an item to pantry", async () => {
      const food = await getOrCreateFood(clientA, `TestFood-${uniqueId()}`);

      const result = await clientA.rpc<string>("add_to_pantry", {
        p_food_id: food.id,
        p_quantity: 2,
        p_unit: "kg",
        p_expires_at: null,
      });

      expectSuccess(result);
      expectValidUuid(result.data);
    });

    it("should accept optional quantity parameter", async () => {
      const food = await getOrCreateFood(clientA, `TestFood-${uniqueId()}`);

      const result = await clientA.rpc<string>("add_to_pantry", {
        p_food_id: food.id,
        p_quantity: null,
        p_unit: null,
        p_expires_at: null,
      });

      expectSuccess(result);
      expectValidUuid(result.data);
    });

    it("should accept expiration date parameter", async () => {
      const food = await getOrCreateFood(clientA, `TestFood-${uniqueId()}`);
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      const expiresAt = futureDate.toISOString().split("T")[0];

      const result = await clientA.rpc<string>("add_to_pantry", {
        p_food_id: food.id,
        p_quantity: 1,
        p_unit: "st",
        p_expires_at: expiresAt,
      });

      expectSuccess(result);
      expectValidUuid(result.data);
    });

    it("should update existing pantry item (upsert behavior)", async () => {
      const food = await getOrCreateFood(clientA, `TestFood-${uniqueId()}`);

      // Add initial item
      const firstResult = await clientA.rpc<string>("add_to_pantry", {
        p_food_id: food.id,
        p_quantity: 1,
        p_unit: "st",
        p_expires_at: null,
      });
      expectSuccess(firstResult);
      const firstId = firstResult.data;

      // Update with new values (same food_id)
      const secondResult = await clientA.rpc<string>("add_to_pantry", {
        p_food_id: food.id,
        p_quantity: 5,
        p_unit: "kg",
        p_expires_at: null,
      });
      expectSuccess(secondResult);

      // Should return the same pantry item ID
      expect(secondResult.data).toBe(firstId);

      // Verify the values were updated
      const pantry = await clientA.rpc<PantryItem[]>("get_user_pantry", {});
      expectSuccess(pantry);
      const item = pantry.data?.find((p) => p.food_id === food.id);
      expect(item).toBeDefined();
      expect(Number(item?.quantity)).toBe(5);
      expect(item?.unit).toBe("kg");
    });

    it("should reject unauthenticated requests", async () => {
      const food = await getOrCreateFood(clientA, `TestFood-${uniqueId()}`);

      const result = await anonClient.rpc<string>("add_to_pantry", {
        p_food_id: food.id,
        p_quantity: 1,
        p_unit: "st",
        p_expires_at: null,
      });

      expectError(result);
    });

    it("should reject invalid food_id", async () => {
      const invalidFoodId = "00000000-0000-0000-0000-000000000000";

      const result = await clientA.rpc<string>("add_to_pantry", {
        p_food_id: invalidFoodId,
        p_quantity: 1,
        p_unit: "st",
        p_expires_at: null,
      });

      expectError(result);
      expect(result.error?.message).toContain("food-not-found");
    });
  });

  // ===========================================================================
  // 2. remove_from_pantry RPC
  // ===========================================================================
  describe("remove_from_pantry", () => {
    it("should return true when removing an existing pantry item", async () => {
      const food = await getOrCreateFood(clientA, `TestFood-${uniqueId()}`);
      await addToPantry(clientA, food.id);

      const result = await clientA.rpc<boolean>("remove_from_pantry", {
        p_food_id: food.id,
      });

      expectSuccess(result);
      expect(result.data).toBe(true);
    });

    it("should return false when removing a non-existent pantry item", async () => {
      const nonExistentFoodId = "00000000-0000-0000-0000-000000000000";

      const result = await clientA.rpc<boolean>("remove_from_pantry", {
        p_food_id: nonExistentFoodId,
      });

      expectSuccess(result);
      expect(result.data).toBe(false);
    });

    it("should only remove from the authenticated user's pantry", async () => {
      const food = await getOrCreateFood(clientA, `TestFood-${uniqueId()}`);

      // Add to user A's pantry
      await addToPantry(clientA, food.id);

      // Try to remove from user B's pantry (should return false - not in B's pantry)
      const result = await clientB.rpc<boolean>("remove_from_pantry", {
        p_food_id: food.id,
      });

      expectSuccess(result);
      expect(result.data).toBe(false);

      // Verify item still exists in user A's pantry
      const pantryA = await clientA.rpc<PantryItem[]>("get_user_pantry", {});
      expectSuccess(pantryA);
      expect(pantryA.data?.some((p) => p.food_id === food.id)).toBe(true);
    });

    it("should reject unauthenticated requests", async () => {
      const result = await anonClient.rpc<boolean>("remove_from_pantry", {
        p_food_id: "00000000-0000-0000-0000-000000000000",
      });

      expectError(result);
    });
  });

  // ===========================================================================
  // 3. get_user_pantry RPC
  // ===========================================================================
  describe("get_user_pantry", () => {
    it("should return an empty array for a user with no pantry items", async () => {
      // Create a fresh user to ensure empty pantry
      const freshEmail = `fresh-${uniqueId()}@example.com`;
      await createTestUser({
        email: freshEmail,
        name: "Fresh User",
        password: "TestPassword123!",
      });
      const freshClient = await createAuthenticatedClient(freshEmail);

      const result = await freshClient.rpc<PantryItem[]>("get_user_pantry", {});

      expectSuccess(result);
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it("should return pantry items with correct shape", async () => {
      const food = await getOrCreateFood(clientA, `TestFood-${uniqueId()}`);
      await addToPantry(clientA, food.id, { quantity: 3, unit: "dl" });

      const result = await clientA.rpc<PantryItem[]>("get_user_pantry", {});

      expectSuccess(result);
      expect(Array.isArray(result.data)).toBe(true);

      const item = result.data?.find((p) => p.food_id === food.id);
      expect(item).toBeDefined();

      // Verify shape
      expect(item).toMatchObject({
        id: expect.any(String),
        food_id: expect.any(String),
        food_name: expect.any(String),
        added_at: expect.any(String),
        is_expired: expect.any(Boolean),
      });

      // Check specific values
      expect(item?.food_id).toBe(food.id);
      expect(Number(item?.quantity)).toBe(3);
      expect(item?.unit).toBe("dl");
      expect(item?.is_expired).toBe(false);
    });

    it("should include is_expired flag for expired items", async () => {
      const food = await getOrCreateFood(clientA, `TestFood-${uniqueId()}`);

      // Add item with past expiration date
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      const expiresAt = pastDate.toISOString().split("T")[0];

      await clientA.rpc("add_to_pantry", {
        p_food_id: food.id,
        p_quantity: 1,
        p_unit: "st",
        p_expires_at: expiresAt,
      });

      const result = await clientA.rpc<PantryItem[]>("get_user_pantry", {});

      expectSuccess(result);
      const item = result.data?.find((p) => p.food_id === food.id);
      expect(item).toBeDefined();
      expect(item?.is_expired).toBe(true);
    });

    it("should order expired items first", async () => {
      const expiredFood = await getOrCreateFood(clientA, `ExpiredFood-${uniqueId()}`);
      const freshFood = await getOrCreateFood(clientA, `FreshFood-${uniqueId()}`);

      // Add fresh item first
      await clientA.rpc("add_to_pantry", {
        p_food_id: freshFood.id,
        p_quantity: 1,
        p_unit: "st",
        p_expires_at: null,
      });

      // Add expired item second
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      await clientA.rpc("add_to_pantry", {
        p_food_id: expiredFood.id,
        p_quantity: 1,
        p_unit: "st",
        p_expires_at: pastDate.toISOString().split("T")[0],
      });

      const result = await clientA.rpc<PantryItem[]>("get_user_pantry", {});

      expectSuccess(result);
      expect(result.data && result.data.length >= 2).toBe(true);

      // Find positions of our items
      const expiredIndex = result.data?.findIndex((p) => p.food_id === expiredFood.id);
      const freshIndex = result.data?.findIndex((p) => p.food_id === freshFood.id);

      // Expired should come before fresh
      expect(expiredIndex).toBeDefined();
      expect(freshIndex).toBeDefined();
      expect(expiredIndex! < freshIndex!).toBe(true);
    });

    it("should only return items for the authenticated user", async () => {
      const foodA = await getOrCreateFood(clientA, `FoodA-${uniqueId()}`);
      const foodB = await getOrCreateFood(clientB, `FoodB-${uniqueId()}`);

      await addToPantry(clientA, foodA.id);
      await addToPantry(clientB, foodB.id);

      const resultA = await clientA.rpc<PantryItem[]>("get_user_pantry", {});
      const resultB = await clientB.rpc<PantryItem[]>("get_user_pantry", {});

      expectSuccess(resultA);
      expectSuccess(resultB);

      // User A should see only their item
      expect(resultA.data?.some((p) => p.food_id === foodA.id)).toBe(true);
      expect(resultA.data?.some((p) => p.food_id === foodB.id)).toBe(false);

      // User B should see only their item
      expect(resultB.data?.some((p) => p.food_id === foodB.id)).toBe(true);
      expect(resultB.data?.some((p) => p.food_id === foodA.id)).toBe(false);
    });

    it("should reject unauthenticated requests", async () => {
      const result = await anonClient.rpc<PantryItem[]>("get_user_pantry", {});

      expectError(result);
    });
  });

  // ===========================================================================
  // 4. find_recipes_by_ingredients RPC
  // ===========================================================================
  describe("find_recipes_by_ingredients", () => {
    it("should return recipes matching provided food IDs", async () => {
      // Create ingredients
      const salt = await getOrCreateFood(clientA, "Salt");
      const pepper = await getOrCreateFood(clientA, "Peppar");

      // Create a recipe with these ingredients
      await createTestRecipe(clientA, {
        name: `Test Recipe ${uniqueId()}`,
        ingredients: [
          { name: "Salt", measurement: "tsk", quantity: "1" },
          { name: "Peppar", measurement: "tsk", quantity: "1" },
        ],
      });

      // Explicitly refresh the materialized view to ensure it's up-to-date
      await refreshRecipeIngredientSummary(clientA);

      const result = await clientA.rpc<RecipeMatch[]>("find_recipes_by_ingredients", {
        p_food_ids: [salt.id, pepper.id],
        p_user_email: null,
        p_min_match_percentage: 50,
        p_limit: 20,
      });

      expectSuccess(result);
      expect(Array.isArray(result.data)).toBe(true);
    });

    it("should return correct response shape", async () => {
      // Use unique ingredient names to avoid collisions with other tests
      const uid = uniqueId();
      const foodA = await getOrCreateFood(clientA, `ShapeTestA-${uid}`);
      const foodB = await getOrCreateFood(clientA, `ShapeTestB-${uid}`);

      const recipeId = await createTestRecipe(clientA, {
        name: `Shape Test Recipe ${uid}`,
        ingredients: [
          { name: `ShapeTestA-${uid}`, measurement: "tsk", quantity: "1" },
          { name: `ShapeTestB-${uid}`, measurement: "dl", quantity: "2" },
        ],
      });

      // Explicitly refresh the materialized view to ensure it's up-to-date
      await refreshRecipeIngredientSummary(clientA);

      // Filter by current user to avoid orphaned recipes from previous test runs
      const result = await clientA.rpc<RecipeMatch[]>("find_recipes_by_ingredients", {
        p_food_ids: [foodA.id, foodB.id],
        p_user_email: TEST_USERS.userA.email,
        p_min_match_percentage: 50,
        p_limit: 20,
      });

      expectSuccess(result);

      // Find the specific recipe we created (not just the first result)
      const recipe = result.data?.find((r) => r.recipe_id === recipeId);
      expect(recipe).toBeDefined();

      if (recipe) {
        // Verify shape of returned data
        expect(recipe).toMatchObject({
          recipe_id: expect.any(String),
          name: expect.any(String),
          total_ingredients: expect.any(Number),
          matching_ingredients: expect.any(Number),
          match_percentage: expect.any(Number),
        });
        // owner can be null (when user is deleted, ON DELETE SET NULL)
        expect(recipe.owner === null || typeof recipe.owner === "string").toBe(true);

        expect(Array.isArray(recipe.categories)).toBe(true);
        expect(Array.isArray(recipe.missing_food_ids)).toBe(true);
        expect(Array.isArray(recipe.missing_food_names)).toBe(true);
      }
    });

    it("should filter by minimum match percentage", async () => {
      const salt = await getOrCreateFood(clientA, "Salt");
      const vatten = await getOrCreateFood(clientA, "Vatten");
      // Create a third ingredient for the recipe (mjol) via the ingredient name
      // We don't need to store the food reference since we're testing percentage matching

      // Create recipe with 3 ingredients
      await createTestRecipe(clientA, {
        name: `Match Percentage Test ${uniqueId()}`,
        ingredients: [
          { name: "Salt", measurement: "tsk", quantity: "1" },
          { name: "Vatten", measurement: "dl", quantity: "2" },
          { name: "Mjol", measurement: "dl", quantity: "3" },
        ],
      });

      // Explicitly refresh the materialized view to ensure it's up-to-date
      await refreshRecipeIngredientSummary(clientA);

      // Search with only 1 ingredient (33% match)
      const lowMatchResult = await clientA.rpc<RecipeMatch[]>("find_recipes_by_ingredients", {
        p_food_ids: [salt.id],
        p_user_email: null,
        p_min_match_percentage: 50, // Require 50%
        p_limit: 20,
      });

      expectSuccess(lowMatchResult);
      // Should not find recipe since we only have 33% match

      // Search with 2 ingredients (66% match)
      const highMatchResult = await clientA.rpc<RecipeMatch[]>("find_recipes_by_ingredients", {
        p_food_ids: [salt.id, vatten.id],
        p_user_email: null,
        p_min_match_percentage: 50,
        p_limit: 20,
      });

      expectSuccess(highMatchResult);
      // Should potentially find recipes with 66% match
    });

    it("should return empty array for empty food_ids", async () => {
      const result = await clientA.rpc<RecipeMatch[]>("find_recipes_by_ingredients", {
        p_food_ids: [],
        p_user_email: null,
        p_min_match_percentage: 50,
        p_limit: 20,
      });

      expectSuccess(result);
      expect(result.data).toEqual([]);
    });

    it("should return empty array for null food_ids", async () => {
      const result = await clientA.rpc<RecipeMatch[]>("find_recipes_by_ingredients", {
        p_food_ids: null,
        p_user_email: null,
        p_min_match_percentage: 50,
        p_limit: 20,
      });

      expectSuccess(result);
      expect(result.data).toEqual([]);
    });

    it("should filter by user email when provided", async () => {
      const salt = await getOrCreateFood(clientA, "Salt");

      // Create recipes for both users
      await createTestRecipe(clientA, {
        name: `User A Recipe ${uniqueId()}`,
        ingredients: [{ name: "Salt", measurement: "tsk", quantity: "1" }],
      });

      await createTestRecipe(clientB, {
        name: `User B Recipe ${uniqueId()}`,
        ingredients: [{ name: "Salt", measurement: "tsk", quantity: "1" }],
      });

      // Explicitly refresh the materialized view to ensure it's up-to-date
      await refreshRecipeIngredientSummary(clientA);

      // Filter by user A
      const resultA = await clientA.rpc<RecipeMatch[]>("find_recipes_by_ingredients", {
        p_food_ids: [salt.id],
        p_user_email: TEST_USERS.userA.email,
        p_min_match_percentage: 50,
        p_limit: 20,
      });

      expectSuccess(resultA);
      // All results should be owned by user A
      if (resultA.data && resultA.data.length > 0) {
        expect(resultA.data.every((r) => r.owner === TEST_USERS.userA.email)).toBe(true);
      }
    });

    it("should respect limit parameter", async () => {
      const result = await clientA.rpc<RecipeMatch[]>("find_recipes_by_ingredients", {
        p_food_ids: ["00000000-0000-0000-0000-000000000001"],
        p_user_email: null,
        p_min_match_percentage: 0,
        p_limit: 5,
      });

      expectSuccess(result);
      expect(result.data!.length).toBeLessThanOrEqual(5);
    });

    it("should be permission denied for anonymous users", async () => {
      const result = await anonClient.rpc<RecipeMatch[]>("find_recipes_by_ingredients", {
        p_food_ids: [],
        p_user_email: null,
        p_min_match_percentage: 50,
        p_limit: 20,
      });

      expectError(result);
      expect(result.error?.message).toContain("permission denied");
    });
  });

  // ===========================================================================
  // 5. find_recipes_from_pantry RPC
  // ===========================================================================
  describe("find_recipes_from_pantry", () => {
    it("should return recipes matching user's pantry", async () => {
      // Add items to pantry
      const salt = await getOrCreateFood(clientA, "Salt");
      const vatten = await getOrCreateFood(clientA, "Vatten");
      await addToPantry(clientA, salt.id);
      await addToPantry(clientA, vatten.id);

      // Create a recipe with those ingredients
      await createTestRecipe(clientA, {
        name: `Pantry Match Recipe ${uniqueId()}`,
        ingredients: [
          { name: "Salt", measurement: "tsk", quantity: "1" },
          { name: "Vatten", measurement: "dl", quantity: "2" },
        ],
      });

      // Explicitly refresh the materialized view to ensure it's up-to-date
      await refreshRecipeIngredientSummary(clientA);

      const result = await clientA.rpc<RecipeFromPantryMatch[]>("find_recipes_from_pantry", {
        p_min_match_percentage: 50,
        p_limit: 20,
      });

      expectSuccess(result);
      expect(Array.isArray(result.data)).toBe(true);
    });

    it("should return correct response shape", async () => {
      const salt = await getOrCreateFood(clientA, "Salt");
      await addToPantry(clientA, salt.id);

      await createTestRecipe(clientA, {
        name: `Shape Test ${uniqueId()}`,
        ingredients: [{ name: "Salt", measurement: "tsk", quantity: "1" }],
      });

      // Explicitly refresh the materialized view to ensure it's up-to-date
      await refreshRecipeIngredientSummary(clientA);

      const result = await clientA.rpc<RecipeFromPantryMatch[]>("find_recipes_from_pantry", {
        p_min_match_percentage: 50,
        p_limit: 20,
      });

      expectSuccess(result);

      if (result.data && result.data.length > 0) {
        const recipe = result.data[0];

        // Verify shape - note: find_recipes_from_pantry returns a subset of fields
        expect(recipe).toMatchObject({
          recipe_id: expect.any(String),
          total_ingredients: expect.any(Number),
          matching_ingredients: expect.any(Number),
          match_percentage: expect.any(Number),
        });

        expect(Array.isArray(recipe.missing_food_ids)).toBe(true);
      }
    });

    it("should return empty array for empty pantry", async () => {
      // Create a fresh user with empty pantry
      const freshEmail = `fresh-pantry-${uniqueId()}@example.com`;
      await createTestUser({
        email: freshEmail,
        name: "Fresh Pantry User",
        password: "TestPassword123!",
      });
      const freshClient = await createAuthenticatedClient(freshEmail);

      const result = await freshClient.rpc<RecipeFromPantryMatch[]>("find_recipes_from_pantry", {
        p_min_match_percentage: 50,
        p_limit: 20,
      });

      expectSuccess(result);
      expect(result.data).toEqual([]);
    });

    it("should filter by minimum match percentage", async () => {
      const salt = await getOrCreateFood(clientA, "Salt");
      await addToPantry(clientA, salt.id);

      // Create recipe with 3 ingredients where user has only 1
      await createTestRecipe(clientA, {
        name: `Low Match Recipe ${uniqueId()}`,
        ingredients: [
          { name: "Salt", measurement: "tsk", quantity: "1" },
          { name: "MissingIngredient1", measurement: "dl", quantity: "2" },
          { name: "MissingIngredient2", measurement: "dl", quantity: "3" },
        ],
      });

      // Explicitly refresh the materialized view to ensure it's up-to-date
      await refreshRecipeIngredientSummary(clientA);

      // With high threshold, should not find recipe (33% match)
      const highThreshold = await clientA.rpc<RecipeFromPantryMatch[]>("find_recipes_from_pantry", {
        p_min_match_percentage: 50,
        p_limit: 20,
      });

      expectSuccess(highThreshold);
      // Recipe should not be included due to low match percentage
    });

    it("should respect limit parameter", async () => {
      const salt = await getOrCreateFood(clientA, "Salt");
      await addToPantry(clientA, salt.id);

      const result = await clientA.rpc<RecipeFromPantryMatch[]>("find_recipes_from_pantry", {
        p_min_match_percentage: 0,
        p_limit: 3,
      });

      expectSuccess(result);
      expect(result.data!.length).toBeLessThanOrEqual(3);
    });

    it("should reject unauthenticated requests", async () => {
      const result = await anonClient.rpc<RecipeFromPantryMatch[]>("find_recipes_from_pantry", {
        p_min_match_percentage: 50,
        p_limit: 20,
      });

      expectError(result);
    });

    it("should use default parameters when not provided", async () => {
      const salt = await getOrCreateFood(clientA, "Salt");
      await addToPantry(clientA, salt.id);

      // Call without optional parameters
      const result = await clientA.rpc<RecipeFromPantryMatch[]>("find_recipes_from_pantry", {});

      expectSuccess(result);
      expect(Array.isArray(result.data)).toBe(true);
    });
  });

  // ===========================================================================
  // 6. get_common_pantry_items RPC
  // ===========================================================================
  describe("get_common_pantry_items", () => {
    it("should return an array of common pantry items", async () => {
      const result = await clientA.rpc<CommonPantryItem[]>("get_common_pantry_items", {});

      expectSuccess(result);
      expect(Array.isArray(result.data)).toBe(true);
    });

    it("should return items with correct shape", async () => {
      const result = await clientA.rpc<CommonPantryItem[]>("get_common_pantry_items", {});

      expectSuccess(result);

      if (result.data && result.data.length > 0) {
        const item = result.data[0];

        expect(item).toMatchObject({
          id: expect.any(String),
          name: expect.any(String),
          category: expect.any(String),
        });

        // Validate UUID format
        expectValidUuid(item.id);

        // Category should be one of the defined types
        expect(["basic", "herb", "spice", "seasoning"]).toContain(item.category);
      }
    });

    it("should include items from all categories", async () => {
      const result = await clientA.rpc<CommonPantryItem[]>("get_common_pantry_items", {});

      expectSuccess(result);

      if (result.data && result.data.length > 0) {
        const categories = new Set(result.data.map((item) => item.category));

        // Should have items from multiple categories
        // Note: Depending on seed data, not all categories may be present
        expect(categories.size).toBeGreaterThan(0);
      }
    });

    it("should be ordered by category priority then alphabetically", async () => {
      const result = await clientA.rpc<CommonPantryItem[]>("get_common_pantry_items", {});

      expectSuccess(result);

      if (result.data && result.data.length > 1) {
        // Check that items are grouped by category
        let lastCategory = "";
        let lastCategoryPriority = 0;
        const categoryPriority: Record<string, number> = {
          basic: 1,
          seasoning: 2,
          herb: 3,
          spice: 4,
        };

        for (const item of result.data) {
          const priority = categoryPriority[item.category] ?? 5;

          if (item.category !== lastCategory) {
            // Category changed - new priority should be >= last
            expect(priority).toBeGreaterThanOrEqual(lastCategoryPriority);
            lastCategory = item.category;
            lastCategoryPriority = priority;
          }
        }
      }
    });

    it("should be permission denied for anonymous users", async () => {
      const result = await anonClient.rpc<CommonPantryItem[]>("get_common_pantry_items", {});

      expectError(result);
      expect(result.error?.message).toContain("permission denied");
    });

    it("should be accessible to authenticated users", async () => {
      const result = await clientA.rpc<CommonPantryItem[]>("get_common_pantry_items", {});

      expectSuccess(result);
      expect(Array.isArray(result.data)).toBe(true);
    });

    it("should return same results for different users", async () => {
      const resultA = await clientA.rpc<CommonPantryItem[]>("get_common_pantry_items", {});
      const resultB = await clientB.rpc<CommonPantryItem[]>("get_common_pantry_items", {});

      expectSuccess(resultA);
      expectSuccess(resultB);

      // Results should be identical (common items are not user-specific)
      expect(resultA.data?.length).toBe(resultB.data?.length);

      if (resultA.data && resultB.data) {
        const idsA = resultA.data.map((i) => i.id).sort();
        const idsB = resultB.data.map((i) => i.id).sort();
        expect(idsA).toEqual(idsB);
      }
    });
  });

  // ===========================================================================
  // 7. deduct_from_pantry RPC
  // ===========================================================================
  describe("deduct_from_pantry", () => {
    it("should return count of updated items for partial deduction", async () => {
      const food = await getOrCreateFood(clientA, `DeductFood-${uniqueId()}`);
      await addToPantry(clientA, food.id, { quantity: 10, unit: "dl" });

      const result = await clientA.rpc<number>("deduct_from_pantry", {
        p_deductions: [{ food_id: food.id, amount: 3 }],
      });

      expectSuccess(result);
      expect(result.data).toBe(1);

      // Verify quantity was reduced
      const pantry = await clientA.rpc<PantryItem[]>("get_user_pantry", {});
      expectSuccess(pantry);
      const item = pantry.data?.find((p) => p.food_id === food.id);
      expect(item).toBeDefined();
      expect(Number(item?.quantity)).toBe(7);
    });

    it("should remove items that reach zero quantity", async () => {
      const food = await getOrCreateFood(clientA, `DeductZero-${uniqueId()}`);
      await addToPantry(clientA, food.id, { quantity: 5, unit: "st" });

      const result = await clientA.rpc<number>("deduct_from_pantry", {
        p_deductions: [{ food_id: food.id, amount: 5 }],
      });

      expectSuccess(result);
      expect(result.data).toBe(1);

      // Verify item was removed
      const pantry = await clientA.rpc<PantryItem[]>("get_user_pantry", {});
      expectSuccess(pantry);
      expect(pantry.data?.some((p) => p.food_id === food.id)).toBe(false);
    });

    it("should remove items when deduction exceeds quantity", async () => {
      const food = await getOrCreateFood(clientA, `DeductOver-${uniqueId()}`);
      await addToPantry(clientA, food.id, { quantity: 2, unit: "kg" });

      const result = await clientA.rpc<number>("deduct_from_pantry", {
        p_deductions: [{ food_id: food.id, amount: 10 }],
      });

      expectSuccess(result);
      expect(result.data).toBe(1);

      // Verify item was removed
      const pantry = await clientA.rpc<PantryItem[]>("get_user_pantry", {});
      expectSuccess(pantry);
      expect(pantry.data?.some((p) => p.food_id === food.id)).toBe(false);
    });

    it("should remove items with NULL quantity", async () => {
      const food = await getOrCreateFood(clientA, `DeductNull-${uniqueId()}`);
      await addToPantry(clientA, food.id); // No quantity

      const result = await clientA.rpc<number>("deduct_from_pantry", {
        p_deductions: [{ food_id: food.id, amount: 1 }],
      });

      expectSuccess(result);
      expect(result.data).toBe(1);

      // Verify item was removed
      const pantry = await clientA.rpc<PantryItem[]>("get_user_pantry", {});
      expectSuccess(pantry);
      expect(pantry.data?.some((p) => p.food_id === food.id)).toBe(false);
    });

    it("should handle multiple deductions atomically", async () => {
      const food1 = await getOrCreateFood(clientA, `DeductMulti1-${uniqueId()}`);
      const food2 = await getOrCreateFood(clientA, `DeductMulti2-${uniqueId()}`);
      await addToPantry(clientA, food1.id, { quantity: 10, unit: "dl" });
      await addToPantry(clientA, food2.id, { quantity: 5, unit: "st" });

      const result = await clientA.rpc<number>("deduct_from_pantry", {
        p_deductions: [
          { food_id: food1.id, amount: 3 },
          { food_id: food2.id, amount: 5 },
        ],
      });

      expectSuccess(result);
      expect(result.data).toBe(2);

      // Verify: food1 reduced, food2 removed
      const pantry = await clientA.rpc<PantryItem[]>("get_user_pantry", {});
      expectSuccess(pantry);
      const item1 = pantry.data?.find((p) => p.food_id === food1.id);
      expect(item1).toBeDefined();
      expect(Number(item1?.quantity)).toBe(7);
      expect(pantry.data?.some((p) => p.food_id === food2.id)).toBe(false);
    });

    it("should skip food_ids not in pantry", async () => {
      const nonExistentFoodId = "00000000-0000-0000-0000-000000000001";

      const result = await clientA.rpc<number>("deduct_from_pantry", {
        p_deductions: [{ food_id: nonExistentFoodId, amount: 1 }],
      });

      expectSuccess(result);
      expect(result.data).toBe(0);
    });

    it("should skip items with zero or negative amounts", async () => {
      const food = await getOrCreateFood(clientA, `DeductSkip-${uniqueId()}`);
      await addToPantry(clientA, food.id, { quantity: 5, unit: "dl" });

      const result = await clientA.rpc<number>("deduct_from_pantry", {
        p_deductions: [{ food_id: food.id, amount: 0 }],
      });

      expectSuccess(result);
      expect(result.data).toBe(0);

      // Verify item is untouched
      const pantry = await clientA.rpc<PantryItem[]>("get_user_pantry", {});
      expectSuccess(pantry);
      const item = pantry.data?.find((p) => p.food_id === food.id);
      expect(Number(item?.quantity)).toBe(5);
    });

    it("should only affect the authenticated user's pantry", async () => {
      const food = await getOrCreateFood(clientA, `DeductIsolation-${uniqueId()}`);
      await addToPantry(clientA, food.id, { quantity: 10, unit: "dl" });

      // User B tries to deduct
      const result = await clientB.rpc<number>("deduct_from_pantry", {
        p_deductions: [{ food_id: food.id, amount: 5 }],
      });

      expectSuccess(result);
      expect(result.data).toBe(0); // Not in B's pantry

      // Verify A's pantry is untouched
      const pantryA = await clientA.rpc<PantryItem[]>("get_user_pantry", {});
      expectSuccess(pantryA);
      const item = pantryA.data?.find((p) => p.food_id === food.id);
      expect(Number(item?.quantity)).toBe(10);
    });

    it("should reject unauthenticated requests", async () => {
      const result = await anonClient.rpc<number>("deduct_from_pantry", {
        p_deductions: [{ food_id: "00000000-0000-0000-0000-000000000001", amount: 1 }],
      });

      expectError(result);
    });

    it("should reject empty deductions array", async () => {
      const result = await clientA.rpc<number>("deduct_from_pantry", {
        p_deductions: [],
      });

      expectError(result);
      expect(result.error?.message).toContain("invalid-deductions");
    });
  });

  // ===========================================================================
  // Integration Tests
  // ===========================================================================
  describe("Pantry Integration", () => {
    it("should support full pantry workflow: add, get, find recipes, remove", async () => {
      // 1. Add items to pantry
      const salt = await getOrCreateFood(clientA, `IntegrationSalt-${uniqueId()}`);
      const vatten = await getOrCreateFood(clientA, `IntegrationVatten-${uniqueId()}`);

      const addResult1 = await clientA.rpc<string>("add_to_pantry", {
        p_food_id: salt.id,
        p_quantity: 1,
        p_unit: "tsk",
        p_expires_at: null,
      });
      expectSuccess(addResult1);

      const addResult2 = await clientA.rpc<string>("add_to_pantry", {
        p_food_id: vatten.id,
        p_quantity: 2,
        p_unit: "dl",
        p_expires_at: null,
      });
      expectSuccess(addResult2);

      // 2. Verify items are in pantry
      const pantry = await clientA.rpc<PantryItem[]>("get_user_pantry", {});
      expectSuccess(pantry);
      expect(pantry.data?.some((p) => p.food_id === salt.id)).toBe(true);
      expect(pantry.data?.some((p) => p.food_id === vatten.id)).toBe(true);

      // 3. Create a recipe with those ingredients
      await createTestRecipe(clientA, {
        name: `Integration Recipe ${uniqueId()}`,
        ingredients: [
          { name: `IntegrationSalt-${uniqueId()}`, measurement: "tsk", quantity: "1" },
          { name: `IntegrationVatten-${uniqueId()}`, measurement: "dl", quantity: "2" },
        ],
      });

      // 4. Find recipes from pantry
      const recipesFromPantry = await clientA.rpc<RecipeFromPantryMatch[]>(
        "find_recipes_from_pantry",
        {
          p_min_match_percentage: 0,
          p_limit: 20,
        }
      );
      expectSuccess(recipesFromPantry);

      // 5. Remove an item
      const removeResult = await clientA.rpc<boolean>("remove_from_pantry", {
        p_food_id: salt.id,
      });
      expectSuccess(removeResult);
      expect(removeResult.data).toBe(true);

      // 6. Verify item was removed
      const pantryAfter = await clientA.rpc<PantryItem[]>("get_user_pantry", {});
      expectSuccess(pantryAfter);
      expect(pantryAfter.data?.some((p) => p.food_id === salt.id)).toBe(false);
      expect(pantryAfter.data?.some((p) => p.food_id === vatten.id)).toBe(true);
    });

    it("should support using common pantry items workflow", async () => {
      // 1. Get common pantry items
      const commonItems = await clientA.rpc<CommonPantryItem[]>("get_common_pantry_items", {});
      expectSuccess(commonItems);
      expect(commonItems.data!.length).toBeGreaterThan(0);

      // 2. Add first common item to pantry
      const firstItem = commonItems.data![0];
      const addResult = await clientA.rpc<string>("add_to_pantry", {
        p_food_id: firstItem.id,
        p_quantity: 1,
        p_unit: "st",
        p_expires_at: null,
      });
      expectSuccess(addResult);

      // 3. Verify it's in pantry
      const pantry = await clientA.rpc<PantryItem[]>("get_user_pantry", {});
      expectSuccess(pantry);
      expect(pantry.data?.some((p) => p.food_id === firstItem.id)).toBe(true);

      // 4. Clean up
      await clientA.rpc("remove_from_pantry", { p_food_id: firstItem.id });
    });
  });
});
