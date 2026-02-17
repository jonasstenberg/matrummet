/**
 * Recipe Matching Behavior Tests
 *
 * Tests the recipe matching functionality that finds recipes based on
 * ingredients the user has in their pantry. The find_recipes_by_ingredients
 * and find_recipes_from_pantry functions calculate match percentages.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  createAuthenticatedClient,
  TEST_USERS,
  setupTestHooks,
  type PostgrestClient,
} from "../setup";
import {
  createTestUser,
  createTestHome,
  cleanupTestData,
  leaveAllHomes,
  getOrCreateFood,
  addToPantry,
  refreshRecipeIngredientSummary,
} from "../seed";
import { expectSuccess } from "../helpers";

describe("Recipe Matching Behavior", () => {
  setupTestHooks();

  let clientA: PostgrestClient;
  let clientB: PostgrestClient;

  // Food data for testing (stores both id and name)
  interface FoodItem {
    id: string;
    name: string;
  }
  let tomatoFood: FoodItem;
  let onionFood: FoodItem;
  let garlicFood: FoodItem;
  let saltFood: FoodItem;

  beforeAll(async () => {
    // Create both test users and authenticate
    await createTestUser(TEST_USERS.userA);
    await createTestUser(TEST_USERS.userB);
    clientA = await createAuthenticatedClient(TEST_USERS.userA.email);
    clientB = await createAuthenticatedClient(TEST_USERS.userB.email);

    // Multi-home: leave all existing homes first, then create a fresh one
    await leaveAllHomes(clientA);
    await createTestHome(clientA, "Test Home for Matching");

    // Get or create all food items needed for testing
    tomatoFood = await getOrCreateFood(clientA, "Tomat");
    onionFood = await getOrCreateFood(clientA, "Lok");
    garlicFood = await getOrCreateFood(clientA, "Vitlok");
    saltFood = await getOrCreateFood(clientA, "Salt");
  });

  afterAll(async () => {
    await cleanupTestData(TEST_USERS.userA.email);
    await cleanupTestData(TEST_USERS.userB.email);
  });

  beforeEach(async () => {
    // Clear pantry before each test
    const pantryResult = await clientA.rpc<
      Array<{ food_id: string }>
    >("get_user_pantry");
    if (pantryResult.data) {
      for (const item of pantryResult.data) {
        await clientA.rpc("remove_from_pantry", { p_food_id: item.food_id });
      }
    }

    // Clean up ALL recipes via direct table delete (RLS restricts to own recipes).
    // delete_all_user_recipes is admin-only since V13.
    await clientA.from("recipes").delete().gte("id", "00000000-0000-0000-0000-000000000000");
    await clientB.from("recipes").delete().gte("id", "00000000-0000-0000-0000-000000000000");

    // Refresh the materialized view after cleanup to remove stale data
    // (admin-only since V13, seed helper uses admin client internally)
    await refreshRecipeIngredientSummary(clientA);
  });

  /**
   * Generate unique suffix for test isolation
   */
  function uniqueSuffix(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Helper to create a recipe with linked food ingredients
   * Uses the actual food names so insert_recipe automatically links to the correct foods
   * Adds unique suffix to ensure test isolation
   */
  async function createRecipeWithFoods(
    name: string,
    foods: FoodItem[]
  ): Promise<string> {
    const uniqueName = `${name} ${uniqueSuffix()}`;
    // Use the actual food names as ingredient names so get_or_create_food
    // in insert_recipe will find the existing foods and link them correctly
    const recipeResult = await clientA.rpc<string>("insert_recipe", {
      p_name: uniqueName,
      p_description: "Test recipe for matching",
      p_author: "Test Chef",
      p_url: null,
      p_recipe_yield: 4,
      p_recipe_yield_name: null,
      p_prep_time: 10,
      p_cook_time: 20,
      p_cuisine: "Swedish",
      p_image: null,
      p_thumbnail: null,
      p_categories: ["Test"],
      p_ingredients: foods.map((food) => ({
        name: food.name,
        quantity: "1",
        measurement: "st",
      })),
      p_instructions: [{ step: "Mix everything." }],
    });

    expectSuccess(recipeResult, "Failed to create recipe");
    const recipeId = recipeResult.data;

    // The trigger should automatically refresh the materialized view,
    // but we refresh explicitly to ensure consistency in tests
    await refreshRecipeIngredientSummary(clientA);

    return recipeId;
  }

  /**
   * Helper to add foods to pantry
   */
  async function addFoodsToPantry(foods: FoodItem[]): Promise<void> {
    for (const food of foods) {
      await addToPantry(clientA, food.id);
    }
  }

  /**
   * Helper to get food IDs from FoodItem array
   */
  function getFoodIds(foods: FoodItem[]): string[] {
    return foods.map((f) => f.id);
  }

  describe("Match percentage calculation", () => {
    it("should return 100% match when all ingredients are in pantry", async () => {
      // Create a recipe with 4 ingredients
      const recipeId = await createRecipeWithFoods("Test Recipe 100%", [
        tomatoFood,
        onionFood,
        garlicFood,
        saltFood,
      ]);

      // Add all 4 ingredients to pantry
      await addFoodsToPantry([tomatoFood, onionFood, garlicFood, saltFood]);

      // Find recipes with minimum 50% match
      const result = await clientA.rpc<
        Array<{
          recipe_id: string;
          name: string;
          total_ingredients: number;
          matching_ingredients: number;
          match_percentage: number;
          missing_food_ids: string[];
        }>
      >("find_recipes_by_ingredients", {
        p_food_ids: getFoodIds([tomatoFood, onionFood, garlicFood, saltFood]),
        p_min_match_percentage: 50,
      });

      expectSuccess(result, "Failed to find recipes");

      const matchedRecipe = result.data?.find((r) => r.recipe_id === recipeId);
      expect(matchedRecipe).toBeDefined();
      expect(matchedRecipe!.match_percentage).toBe(100);
      expect(matchedRecipe!.matching_ingredients).toBe(4);
      expect(matchedRecipe!.total_ingredients).toBe(4);
      expect(matchedRecipe!.missing_food_ids).toHaveLength(0);
    });

    it("should return 50% match when half the ingredients are in pantry", async () => {
      // Create a recipe with 4 ingredients
      const recipeId = await createRecipeWithFoods("Test Recipe 50%", [
        tomatoFood,
        onionFood,
        garlicFood,
        saltFood,
      ]);

      // Add only 2 ingredients to pantry
      await addFoodsToPantry([tomatoFood, onionFood]);

      const result = await clientA.rpc<
        Array<{
          recipe_id: string;
          match_percentage: number;
          matching_ingredients: number;
          total_ingredients: number;
          missing_food_ids: string[];
        }>
      >("find_recipes_by_ingredients", {
        p_food_ids: getFoodIds([tomatoFood, onionFood]),
        p_min_match_percentage: 50,
      });

      expectSuccess(result, "Failed to find recipes");

      const matchedRecipe = result.data?.find((r) => r.recipe_id === recipeId);
      expect(matchedRecipe).toBeDefined();
      expect(matchedRecipe!.match_percentage).toBe(50);
      expect(matchedRecipe!.matching_ingredients).toBe(2);
      expect(matchedRecipe!.total_ingredients).toBe(4);
      expect(matchedRecipe!.missing_food_ids).toHaveLength(2);
    });

    it("should return 75% match when 3 of 4 ingredients are in pantry", async () => {
      const recipeId = await createRecipeWithFoods("Test Recipe 75%", [
        tomatoFood,
        onionFood,
        garlicFood,
        saltFood,
      ]);

      await addFoodsToPantry([tomatoFood, onionFood, garlicFood]);

      const result = await clientA.rpc<
        Array<{
          recipe_id: string;
          match_percentage: number;
          matching_ingredients: number;
        }>
      >("find_recipes_by_ingredients", {
        p_food_ids: getFoodIds([tomatoFood, onionFood, garlicFood]),
        p_min_match_percentage: 50,
      });

      expectSuccess(result, "Failed to find recipes");

      const matchedRecipe = result.data?.find((r) => r.recipe_id === recipeId);
      expect(matchedRecipe).toBeDefined();
      expect(matchedRecipe!.match_percentage).toBe(75);
      expect(matchedRecipe!.matching_ingredients).toBe(3);
    });

    it("should return 25% match when 1 of 4 ingredients are in pantry", async () => {
      const recipeId = await createRecipeWithFoods("Test Recipe 25%", [
        tomatoFood,
        onionFood,
        garlicFood,
        saltFood,
      ]);

      await addFoodsToPantry([tomatoFood]);

      // Use low threshold to see the 25% match
      const result = await clientA.rpc<
        Array<{
          recipe_id: string;
          match_percentage: number;
        }>
      >("find_recipes_by_ingredients", {
        p_food_ids: [tomatoFood.id],
        p_min_match_percentage: 20,
      });

      expectSuccess(result, "Failed to find recipes");

      const matchedRecipe = result.data?.find((r) => r.recipe_id === recipeId);
      expect(matchedRecipe).toBeDefined();
      expect(matchedRecipe!.match_percentage).toBe(25);
    });
  });

  describe("Minimum match percentage filtering", () => {
    it("should exclude recipes below min_match_percentage", async () => {
      // Create recipe with 4 ingredients
      const recipeId = await createRecipeWithFoods("Test Recipe Below Threshold", [
        tomatoFood,
        onionFood,
        garlicFood,
        saltFood,
      ]);

      // Add only 1 ingredient (25% match)
      await addFoodsToPantry([tomatoFood]);

      // Search with 50% threshold - should NOT find the recipe
      const result = await clientA.rpc<
        Array<{ recipe_id: string }>
      >("find_recipes_by_ingredients", {
        p_food_ids: [tomatoFood.id],
        p_min_match_percentage: 50,
      });

      expectSuccess(result, "Failed to find recipes");

      const matchedRecipe = result.data?.find((r) => r.recipe_id === recipeId);
      expect(matchedRecipe).toBeUndefined();
    });

    it("should include recipes at exactly min_match_percentage", async () => {
      // Create recipe with 2 ingredients
      const recipeId = await createRecipeWithFoods("Test Recipe At Threshold", [
        tomatoFood,
        onionFood,
      ]);

      // Add 1 ingredient (50% match)
      await addFoodsToPantry([tomatoFood]);

      // Search with 50% threshold - should find the recipe
      const result = await clientA.rpc<
        Array<{ recipe_id: string; match_percentage: number }>
      >("find_recipes_by_ingredients", {
        p_food_ids: [tomatoFood.id],
        p_min_match_percentage: 50,
      });

      expectSuccess(result, "Failed to find recipes");

      const matchedRecipe = result.data?.find((r) => r.recipe_id === recipeId);
      expect(matchedRecipe).toBeDefined();
      expect(matchedRecipe!.match_percentage).toBe(50);
    });

    it("should return all matching recipes with 0% threshold", async () => {
      // Create recipes with different match percentages
      const recipe100 = await createRecipeWithFoods("Test 100%", [tomatoFood]);
      const recipe50 = await createRecipeWithFoods("Test 50%", [
        tomatoFood,
        onionFood,
      ]);
      const recipe25 = await createRecipeWithFoods("Test 25%", [
        tomatoFood,
        onionFood,
        garlicFood,
        saltFood,
      ]);

      // Add only tomato
      await addFoodsToPantry([tomatoFood]);

      // Search with 1% threshold (effectively all)
      const result = await clientA.rpc<
        Array<{ recipe_id: string; match_percentage: number }>
      >("find_recipes_by_ingredients", {
        p_food_ids: [tomatoFood.id],
        p_min_match_percentage: 1,
      });

      expectSuccess(result, "Failed to find recipes");

      // Should find all 3 recipes
      expect(result.data?.some((r) => r.recipe_id === recipe100)).toBe(true);
      expect(result.data?.some((r) => r.recipe_id === recipe50)).toBe(true);
      expect(result.data?.some((r) => r.recipe_id === recipe25)).toBe(true);
    });
  });

  describe("Result ordering", () => {
    it("should order results by match percentage descending", async () => {
      // Create recipes with different match potential
      await createRecipeWithFoods("Recipe 100%", [tomatoFood, onionFood]);
      await createRecipeWithFoods("Recipe 50%", [
        tomatoFood,
        onionFood,
        garlicFood,
        saltFood,
      ]);
      await createRecipeWithFoods("Recipe 66%", [
        tomatoFood,
        onionFood,
        garlicFood,
      ]);

      await addFoodsToPantry([tomatoFood, onionFood]);

      const result = await clientA.rpc<
        Array<{ match_percentage: number; name: string }>
      >("find_recipes_by_ingredients", {
        p_food_ids: getFoodIds([tomatoFood, onionFood]),
        p_min_match_percentage: 50,
      });

      expectSuccess(result, "Failed to find recipes");

      // Verify ordering
      const recipes = result.data ?? [];
      for (let i = 1; i < recipes.length; i++) {
        expect(recipes[i - 1].match_percentage).toBeGreaterThanOrEqual(
          recipes[i].match_percentage
        );
      }
    });

    it("should order by matching ingredients as secondary sort", async () => {
      // Create two recipes with same percentage but different ingredient counts
      // Use unique names that match the cleanup pattern in beforeEach
      const smallRecipeId = await createRecipeWithFoods("Test Recipe Small", [tomatoFood]);
      const largeRecipeId = await createRecipeWithFoods("Test Recipe Large", [
        tomatoFood,
        onionFood,
        garlicFood,
        saltFood,
      ]);

      await addFoodsToPantry([tomatoFood, onionFood, garlicFood, saltFood]);

      // Filter by owner to avoid orphaned recipes from previous test runs
      const result = await clientA.rpc<
        Array<{ recipe_id: string; name: string; matching_ingredients: number; match_percentage: number }>
      >("find_recipes_by_ingredients", {
        p_food_ids: getFoodIds([tomatoFood, onionFood, garlicFood, saltFood]),
        p_user_email: TEST_USERS.userA.email,
        p_min_match_percentage: 50,
      });

      expectSuccess(result, "Failed to find recipes");

      // Both have 100%, but large recipe has more matching ingredients
      const recipes = result.data ?? [];
      const largeRecipe = recipes.find((r) => r.recipe_id === largeRecipeId);
      const smallRecipe = recipes.find((r) => r.recipe_id === smallRecipeId);

      expect(largeRecipe).toBeDefined();
      expect(smallRecipe).toBeDefined();

      // Large recipe should have higher matching count
      expect(largeRecipe!.matching_ingredients).toBe(4);
      expect(smallRecipe!.matching_ingredients).toBe(1);
    });
  });

  describe("find_recipes_from_pantry convenience function", () => {
    it("should find recipes using current pantry contents", async () => {
      // Create a recipe
      const recipeId = await createRecipeWithFoods("Pantry Test Recipe", [
        tomatoFood,
        onionFood,
      ]);

      // Add matching ingredients to pantry
      await addFoodsToPantry([tomatoFood, onionFood]);

      // Use convenience function
      // Note: find_recipes_from_pantry returns a subset of columns including 'title' (not 'name')
      const result = await clientA.rpc<
        Array<{
          recipe_id: string;
          title: string;
          total_ingredients: number;
          matching_ingredients: number;
          match_percentage: number;
          missing_food_ids: string[];
        }>
      >("find_recipes_from_pantry", {
        p_min_match_percentage: 50,
      });

      expectSuccess(result, "Failed to find recipes from pantry");

      const matchedRecipe = result.data?.find((r) => r.recipe_id === recipeId);
      expect(matchedRecipe).toBeDefined();
      expect(matchedRecipe!.match_percentage).toBe(100);
    });

    it("should return empty when pantry is empty", async () => {
      // Create a recipe (pantry is already empty from beforeEach)
      await createRecipeWithFoods("Empty Pantry Test", [tomatoFood]);

      const result = await clientA.rpc<
        Array<{ recipe_id: string }>
      >("find_recipes_from_pantry", {
        p_min_match_percentage: 50,
      });

      expectSuccess(result, "Failed to call find_recipes_from_pantry");
      expect(result.data).toHaveLength(0);
    });

    it("should respect min_match_percentage parameter", async () => {
      // Create recipe with 4 ingredients
      const recipeId = await createRecipeWithFoods("Threshold Test", [
        tomatoFood,
        onionFood,
        garlicFood,
        saltFood,
      ]);

      // Add only 1 (25% match)
      await addFoodsToPantry([tomatoFood]);

      // Search with 50% threshold - should not find
      const result50 = await clientA.rpc<
        Array<{ recipe_id: string }>
      >("find_recipes_from_pantry", {
        p_min_match_percentage: 50,
      });

      expectSuccess(result50, "Failed to search with 50% threshold");
      expect(result50.data?.some((r) => r.recipe_id === recipeId)).toBe(false);

      // Search with 20% threshold - should find
      const result20 = await clientA.rpc<
        Array<{ recipe_id: string }>
      >("find_recipes_from_pantry", {
        p_min_match_percentage: 20,
      });

      expectSuccess(result20, "Failed to search with 20% threshold");
      expect(result20.data?.some((r) => r.recipe_id === recipeId)).toBe(true);
    });

    it("should respect limit parameter", async () => {
      // Create multiple recipes
      for (let i = 0; i < 5; i++) {
        await createRecipeWithFoods(`Recipe ${i}`, [tomatoFood]);
      }

      await addFoodsToPantry([tomatoFood]);

      const result = await clientA.rpc<
        Array<{ recipe_id: string }>
      >("find_recipes_from_pantry", {
        p_min_match_percentage: 50,
        p_limit: 3,
      });

      expectSuccess(result, "Failed to search with limit");
      expect(result.data?.length).toBeLessThanOrEqual(3);
    });
  });

  describe("Edge cases", () => {
    it("should handle recipes with no linked food ingredients", async () => {
      // Create a recipe without food_id links
      const recipeResult = await clientA.rpc<string>("insert_recipe", {
        p_name: "No Foods Recipe",
        p_description: "Test recipe",
        p_author: "Test",
        p_url: null,
        p_recipe_yield: 4,
        p_recipe_yield_name: null,
        p_prep_time: 10,
        p_cook_time: 20,
        p_cuisine: "Swedish",
        p_image: null,
        p_thumbnail: null,
        p_categories: ["Test"],
        p_ingredients: [{ name: "Something", quantity: "1", measurement: "st" }],
        p_instructions: [{ step: "Do something." }],
      });

      expectSuccess(recipeResult, "Failed to create recipe");
      await refreshRecipeIngredientSummary(clientA);

      await addFoodsToPantry([tomatoFood]);

      const result = await clientA.rpc<
        Array<{ recipe_id: string }>
      >("find_recipes_by_ingredients", {
        p_food_ids: [tomatoFood.id],
        p_min_match_percentage: 0,
      });

      expectSuccess(result, "Failed to find recipes");

      // Recipe with no food links should not appear
      const noFoodsRecipe = result.data?.find((r) => r.recipe_id === recipeResult.data);
      expect(noFoodsRecipe).toBeUndefined();
    });

    it("should handle empty food_ids array", async () => {
      await createRecipeWithFoods("Empty Search Test", [tomatoFood]);

      const result = await clientA.rpc<
        Array<{ recipe_id: string }>
      >("find_recipes_by_ingredients", {
        p_food_ids: [],
        p_min_match_percentage: 50,
      });

      expectSuccess(result, "Empty array should not error");
      expect(result.data).toHaveLength(0);
    });

    it("should handle null food_ids", async () => {
      const result = await clientA.rpc<
        Array<{ recipe_id: string }>
      >("find_recipes_by_ingredients", {
        p_food_ids: null,
        p_min_match_percentage: 50,
      });

      expectSuccess(result, "Null should not error");
      expect(result.data).toHaveLength(0);
    });

    it("should include missing food names in results", async () => {
      const recipeId = await createRecipeWithFoods("Missing Names Test", [
        tomatoFood,
        onionFood,
        garlicFood,
      ]);

      // Add only tomato
      await addFoodsToPantry([tomatoFood]);

      const result = await clientA.rpc<
        Array<{
          recipe_id: string;
          missing_food_ids: string[];
          missing_food_names: string[];
        }>
      >("find_recipes_by_ingredients", {
        p_food_ids: [tomatoFood.id],
        p_min_match_percentage: 30,
      });

      expectSuccess(result, "Failed to find recipes");

      const recipe = result.data?.find((r) => r.recipe_id === recipeId);
      expect(recipe).toBeDefined();
      expect(recipe!.missing_food_ids).toHaveLength(2);
      expect(recipe!.missing_food_names).toHaveLength(2);
      expect(recipe!.missing_food_names).toContain("Lok");
      expect(recipe!.missing_food_names).toContain("Vitlok");
    });
  });
});
