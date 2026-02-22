/**
 * Shopping List Scaling Behavior Tests
 *
 * Tests the recipe scaling behavior when adding recipes to shopping lists.
 * The add_recipe_to_shopping_list function scales ingredient quantities
 * based on the requested servings compared to the recipe's original yield.
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
  ensureUserHasHome,
} from "../seed";
import { expectSuccess } from "../helpers";

describe("Shopping List Scaling Behavior", () => {
  setupTestHooks();

  let clientA: PostgrestClient;
  let saltFoodId: string;

  beforeAll(async () => {
    // Create test user and authenticate
    await createTestUser(TEST_USERS.userA);
    clientA = await createAuthenticatedClient(TEST_USERS.userA.email);

    // Multi-home: leave all existing homes first, then create a fresh one
    await leaveAllHomes(clientA);
    await createTestHome(clientA, "Test Home for Scaling");

    // Get or create food items for ingredients
    const salt = await getOrCreateFood(clientA, "Salt");
    saltFoodId = salt.id;
  });

  afterAll(async () => {
    await cleanupTestData(TEST_USERS.userA.email);
  });

  beforeEach(async () => {
    // Ensure user has a home (some tests might leave user without one)
    await ensureUserHasHome(clientA, "Test Home for Scaling");

    // Clear shopping lists before each test
    const listsResult = await clientA.rpc<
      Array<{ id: string; name: string }>
    >("get_user_shopping_lists");
    if (listsResult.data) {
      for (const list of listsResult.data) {
        await clientA.rpc("delete_shopping_list", { p_list_id: list.id });
      }
    }
  });

  /**
   * Generate a unique suffix for ingredient names to avoid interference between tests
   */
  let testCounter = 0;
  function uniqueSuffix(): string {
    return `_${Date.now()}_${++testCounter}`;
  }

  /**
   * Helper to create a recipe with specific ingredients and yield
   * Each ingredient name gets a unique suffix to avoid accumulation from previous tests
   */
  async function createRecipeWithIngredients(
    yield_: number,
    ingredients: Array<{ name: string; quantity: string; measurement: string; food_id?: string }>
  ): Promise<{ recipeId: string; ingredientNames: Record<string, string> }> {
    const suffix = uniqueSuffix();
    // Map original names to unique names
    const ingredientNames: Record<string, string> = {};
    const uniqueIngredients = ingredients.map((ing) => {
      const uniqueName = `${ing.name}${suffix}`;
      ingredientNames[ing.name] = uniqueName;
      return {
        name: uniqueName,
        quantity: ing.quantity,
        measurement: ing.measurement,
        food_id: ing.food_id,
      };
    });

    const result = await clientA.rpc<string>("insert_recipe", {
      p_name: `Test Recipe ${Date.now()}`,
      p_description: "A test recipe for scaling",
      p_author: "Test Chef",
      p_url: null,
      p_recipe_yield: yield_,
      p_recipe_yield_name: "portioner",
      p_prep_time: 10,
      p_cook_time: 20,
      p_cuisine: "Swedish",
      p_image: null,

      p_categories: ["Test"],
      p_ingredients: uniqueIngredients,
      p_instructions: [{ step: "Mix everything." }],
    });

    expectSuccess(result, "Failed to create recipe");
    return { recipeId: result.data, ingredientNames };
  }

  describe("Scaling down (fewer servings than original)", () => {
    it("should halve quantities when adding recipe for 2 servings (original is 4)", async () => {
      // Create a recipe that yields 4 servings with specific quantities
      const { recipeId, ingredientNames } = await createRecipeWithIngredients(4, [
        { name: "Salt", quantity: "4", measurement: "tsk" },
        { name: "Mjol", quantity: "8", measurement: "dl" },
        { name: "Socker", quantity: "2", measurement: "msk" },
      ]);

      // Add recipe for 2 servings (half the original)
      const addResult = await clientA.rpc<{ added_count: number; list_id: string }>(
        "add_recipe_to_shopping_list",
        {
          p_recipe_id: recipeId,
          p_servings: 2,
        }
      );

      expectSuccess(addResult, "Failed to add recipe to shopping list");
      expect(addResult.data.added_count).toBe(3);

      // Check the shopping list items
      const itemsResult = await clientA
        .from("shopping_list_view")
        .select("*")
        .eq("shopping_list_id", addResult.data.list_id);

      expectSuccess(itemsResult, "Failed to get shopping list items");

      const items = itemsResult.data as Array<{
        display_name: string;
        quantity: number;
        display_unit: string;
      }>;

      // Quantities should be halved (scale factor = 2/4 = 0.5)
      const saltItem = items.find((i) => i.display_name === ingredientNames["Salt"]);
      const flourItem = items.find((i) => i.display_name === ingredientNames["Mjol"]);
      const sugarItem = items.find((i) => i.display_name === ingredientNames["Socker"]);

      expect(saltItem).toBeDefined();
      expect(saltItem!.quantity).toBe(2); // 4 * 0.5 = 2
      expect(saltItem!.display_unit).toBe("tsk");

      expect(flourItem).toBeDefined();
      expect(flourItem!.quantity).toBe(4); // 8 * 0.5 = 4
      expect(flourItem!.display_unit).toBe("dl");

      expect(sugarItem).toBeDefined();
      expect(sugarItem!.quantity).toBe(1); // 2 * 0.5 = 1
      expect(sugarItem!.display_unit).toBe("msk");
    });

    it("should quarter quantities when adding recipe for 1 serving (original is 4)", async () => {
      const { recipeId, ingredientNames } = await createRecipeWithIngredients(4, [
        { name: "Salt", quantity: "4", measurement: "tsk" },
        { name: "Mjol", quantity: "8", measurement: "dl" },
      ]);

      const addResult = await clientA.rpc<{ added_count: number; list_id: string }>(
        "add_recipe_to_shopping_list",
        {
          p_recipe_id: recipeId,
          p_servings: 1,
        }
      );

      expectSuccess(addResult, "Failed to add recipe to shopping list");

      const itemsResult = await clientA
        .from("shopping_list_view")
        .select("*")
        .eq("shopping_list_id", addResult.data.list_id);

      expectSuccess(itemsResult, "Failed to get shopping list items");

      const items = itemsResult.data as Array<{
        display_name: string;
        quantity: number;
      }>;

      // Quantities should be quartered (scale factor = 1/4 = 0.25)
      const saltItem = items.find((i) => i.display_name === ingredientNames["Salt"]);
      const flourItem = items.find((i) => i.display_name === ingredientNames["Mjol"]);

      expect(saltItem!.quantity).toBe(1); // 4 * 0.25 = 1
      expect(flourItem!.quantity).toBe(2); // 8 * 0.25 = 2
    });
  });

  describe("Scaling up (more servings than original)", () => {
    it("should double quantities when adding recipe for 8 servings (original is 4)", async () => {
      const { recipeId, ingredientNames } = await createRecipeWithIngredients(4, [
        { name: "Salt", quantity: "2", measurement: "tsk" },
        { name: "Mjol", quantity: "4", measurement: "dl" },
        { name: "Socker", quantity: "1", measurement: "msk" },
      ]);

      const addResult = await clientA.rpc<{ added_count: number; list_id: string }>(
        "add_recipe_to_shopping_list",
        {
          p_recipe_id: recipeId,
          p_servings: 8,
        }
      );

      expectSuccess(addResult, "Failed to add recipe to shopping list");
      expect(addResult.data.added_count).toBe(3);

      const itemsResult = await clientA
        .from("shopping_list_view")
        .select("*")
        .eq("shopping_list_id", addResult.data.list_id);

      expectSuccess(itemsResult, "Failed to get shopping list items");

      const items = itemsResult.data as Array<{
        display_name: string;
        quantity: number;
      }>;

      // Quantities should be doubled (scale factor = 8/4 = 2)
      const saltItem = items.find((i) => i.display_name === ingredientNames["Salt"]);
      const flourItem = items.find((i) => i.display_name === ingredientNames["Mjol"]);
      const sugarItem = items.find((i) => i.display_name === ingredientNames["Socker"]);

      expect(saltItem!.quantity).toBe(4); // 2 * 2 = 4
      expect(flourItem!.quantity).toBe(8); // 4 * 2 = 8
      expect(sugarItem!.quantity).toBe(2); // 1 * 2 = 2
    });

    it("should triple quantities when adding recipe for 12 servings (original is 4)", async () => {
      const { recipeId, ingredientNames } = await createRecipeWithIngredients(4, [
        { name: "Salt", quantity: "3", measurement: "tsk" },
      ]);

      const addResult = await clientA.rpc<{ added_count: number; list_id: string }>(
        "add_recipe_to_shopping_list",
        {
          p_recipe_id: recipeId,
          p_servings: 12,
        }
      );

      expectSuccess(addResult, "Failed to add recipe to shopping list");

      const itemsResult = await clientA
        .from("shopping_list_view")
        .select("*")
        .eq("shopping_list_id", addResult.data.list_id);

      expectSuccess(itemsResult, "Failed to get shopping list items");

      const items = itemsResult.data as Array<{
        display_name: string;
        quantity: number;
      }>;

      // Scale factor = 12/4 = 3
      const saltItem = items.find((i) => i.display_name === ingredientNames["Salt"]);
      expect(saltItem!.quantity).toBe(9); // 3 * 3 = 9
    });
  });

  describe("Fractional servings and quantities", () => {
    it("should handle fractional scale factors correctly", async () => {
      const { recipeId, ingredientNames } = await createRecipeWithIngredients(4, [
        { name: "Salt", quantity: "3", measurement: "tsk" },
        { name: "Mjol", quantity: "5", measurement: "dl" },
      ]);

      // Add for 6 servings (scale factor = 6/4 = 1.5)
      const addResult = await clientA.rpc<{ added_count: number; list_id: string }>(
        "add_recipe_to_shopping_list",
        {
          p_recipe_id: recipeId,
          p_servings: 6,
        }
      );

      expectSuccess(addResult, "Failed to add recipe to shopping list");

      const itemsResult = await clientA
        .from("shopping_list_view")
        .select("*")
        .eq("shopping_list_id", addResult.data.list_id);

      expectSuccess(itemsResult, "Failed to get shopping list items");

      const items = itemsResult.data as Array<{
        display_name: string;
        quantity: number;
      }>;

      const saltItem = items.find((i) => i.display_name === ingredientNames["Salt"]);
      const flourItem = items.find((i) => i.display_name === ingredientNames["Mjol"]);

      expect(saltItem!.quantity).toBe(4.5); // 3 * 1.5 = 4.5
      expect(flourItem!.quantity).toBe(7.5); // 5 * 1.5 = 7.5
    });

    it("should handle very small fractional quantities correctly", async () => {
      const { recipeId, ingredientNames } = await createRecipeWithIngredients(8, [
        { name: "Salt", quantity: "1", measurement: "tsk" },
      ]);

      // Add for 1 serving (scale factor = 1/8 = 0.125)
      const addResult = await clientA.rpc<{ added_count: number; list_id: string }>(
        "add_recipe_to_shopping_list",
        {
          p_recipe_id: recipeId,
          p_servings: 1,
        }
      );

      expectSuccess(addResult, "Failed to add recipe to shopping list");

      const itemsResult = await clientA
        .from("shopping_list_view")
        .select("*")
        .eq("shopping_list_id", addResult.data.list_id);

      expectSuccess(itemsResult, "Failed to get shopping list items");

      const items = itemsResult.data as Array<{
        display_name: string;
        quantity: number;
      }>;

      const saltItem = items.find((i) => i.display_name === ingredientNames["Salt"]);
      expect(saltItem!.quantity).toBe(0.125); // 1 * 0.125 = 0.125
    });

    it("should handle odd servings like 3 (original is 4)", async () => {
      const { recipeId, ingredientNames } = await createRecipeWithIngredients(4, [
        { name: "Mjol", quantity: "4", measurement: "dl" },
      ]);

      // Add for 3 servings (scale factor = 3/4 = 0.75)
      const addResult = await clientA.rpc<{ added_count: number; list_id: string }>(
        "add_recipe_to_shopping_list",
        {
          p_recipe_id: recipeId,
          p_servings: 3,
        }
      );

      expectSuccess(addResult, "Failed to add recipe to shopping list");

      const itemsResult = await clientA
        .from("shopping_list_view")
        .select("*")
        .eq("shopping_list_id", addResult.data.list_id);

      expectSuccess(itemsResult, "Failed to get shopping list items");

      const items = itemsResult.data as Array<{
        display_name: string;
        quantity: number;
      }>;

      const flourItem = items.find((i) => i.display_name === ingredientNames["Mjol"]);
      expect(flourItem!.quantity).toBe(3); // 4 * 0.75 = 3
    });
  });

  describe("No scaling (null or same servings)", () => {
    it("should not scale when servings is null", async () => {
      const { recipeId, ingredientNames } = await createRecipeWithIngredients(4, [
        { name: "Salt", quantity: "4", measurement: "tsk" },
      ]);

      const addResult = await clientA.rpc<{ added_count: number; list_id: string }>(
        "add_recipe_to_shopping_list",
        {
          p_recipe_id: recipeId,
          p_servings: null,
        }
      );

      expectSuccess(addResult, "Failed to add recipe to shopping list");

      const itemsResult = await clientA
        .from("shopping_list_view")
        .select("*")
        .eq("shopping_list_id", addResult.data.list_id);

      expectSuccess(itemsResult, "Failed to get shopping list items");

      const items = itemsResult.data as Array<{
        display_name: string;
        quantity: number;
      }>;

      const saltItem = items.find((i) => i.display_name === ingredientNames["Salt"]);
      expect(saltItem!.quantity).toBe(4); // No scaling, original quantity
    });

    it("should not scale when servings equals original yield", async () => {
      const { recipeId, ingredientNames } = await createRecipeWithIngredients(4, [
        { name: "Salt", quantity: "4", measurement: "tsk" },
      ]);

      const addResult = await clientA.rpc<{ added_count: number; list_id: string }>(
        "add_recipe_to_shopping_list",
        {
          p_recipe_id: recipeId,
          p_servings: 4,
        }
      );

      expectSuccess(addResult, "Failed to add recipe to shopping list");

      const itemsResult = await clientA
        .from("shopping_list_view")
        .select("*")
        .eq("shopping_list_id", addResult.data.list_id);

      expectSuccess(itemsResult, "Failed to get shopping list items");

      const items = itemsResult.data as Array<{
        display_name: string;
        quantity: number;
      }>;

      const saltItem = items.find((i) => i.display_name === ingredientNames["Salt"]);
      expect(saltItem!.quantity).toBe(4); // Scale factor = 1
    });
  });

  describe("Edge cases", () => {
    it("should handle non-numeric quantities by defaulting to 1", async () => {
      const { recipeId, ingredientNames } = await createRecipeWithIngredients(4, [
        { name: "Salt", quantity: "en nypa", measurement: "" }, // Non-numeric
        { name: "Mjol", quantity: "1/2", measurement: "dl" }, // Fraction string (not parsed)
      ]);

      const addResult = await clientA.rpc<{ added_count: number; list_id: string }>(
        "add_recipe_to_shopping_list",
        {
          p_recipe_id: recipeId,
          p_servings: 8, // Double
        }
      );

      expectSuccess(addResult, "Failed to add recipe to shopping list");

      const itemsResult = await clientA
        .from("shopping_list_view")
        .select("*")
        .eq("shopping_list_id", addResult.data.list_id);

      expectSuccess(itemsResult, "Failed to get shopping list items");

      const items = itemsResult.data as Array<{
        display_name: string;
        quantity: number;
      }>;

      // Non-numeric quantities default to 1 before scaling
      const saltItem = items.find((i) => i.display_name === ingredientNames["Salt"]);
      const flourItem = items.find((i) => i.display_name === ingredientNames["Mjol"]);

      expect(saltItem!.quantity).toBe(2); // Default 1 * 2 = 2
      expect(flourItem!.quantity).toBe(2); // Default 1 * 2 = 2 (fraction string can't be parsed)
    });

    it("should accumulate quantities when adding same recipe multiple times", async () => {
      // For this test, we use an ingredient named "Salt" (without unique suffix)
      // because the insert_recipe function derives food_id from the ingredient name.
      // Ingredients with the same food_id accumulate when added to the same shopping list.
      const result = await clientA.rpc<string>("insert_recipe", {
        p_name: `Accumulation Test Recipe ${Date.now()}`,
        p_description: "A test recipe for accumulation",
        p_author: "Test Chef",
        p_url: null,
        p_recipe_yield: 4,
        p_recipe_yield_name: "portioner",
        p_prep_time: 10,
        p_cook_time: 20,
        p_cuisine: "Swedish",
        p_image: null,
  
        p_categories: ["Test"],
        // Use "Salt" which maps to saltFoodId (created in beforeAll)
        p_ingredients: [{ name: "Salt", quantity: "2", measurement: "tsk" }],
        p_instructions: [{ step: "Mix everything." }],
      });
      expectSuccess(result, "Failed to create recipe");
      const recipeId = result.data;

      // Add recipe for 4 servings (no scaling)
      const addResult1 = await clientA.rpc<{ added_count: number; list_id: string }>(
        "add_recipe_to_shopping_list",
        {
          p_recipe_id: recipeId,
          p_servings: 4,
        }
      );
      expectSuccess(addResult1, "Failed to add recipe first time");

      // Add same recipe again for 4 servings
      const addResult2 = await clientA.rpc<{ added_count: number; list_id: string }>(
        "add_recipe_to_shopping_list",
        {
          p_recipe_id: recipeId,
          p_servings: 4,
        }
      );
      expectSuccess(addResult2, "Failed to add recipe second time");

      // Check the shopping list - items with same food_id should be accumulated
      const itemsResult = await clientA
        .from("shopping_list_view")
        .select("*")
        .eq("shopping_list_id", addResult1.data.list_id);

      expectSuccess(itemsResult, "Failed to get shopping list items");

      const items = itemsResult.data as Array<{
        display_name: string;
        quantity: number;
        food_id: string;
      }>;

      // Items with food_id should accumulate
      const saltItems = items.filter((i) => i.food_id === saltFoodId);
      expect(saltItems.length).toBe(1);
      expect(saltItems[0].quantity).toBe(4); // 2 + 2 = 4
    });
  });
});
