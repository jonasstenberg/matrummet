/**
 * Food Alias Behavior Tests
 *
 * Tests canonical food alias functionality:
 * - Canonical resolution functions (resolve_canonical, resolve_food_ids_to_canonical)
 * - Recipe with alias ingredient matches pantry with canonical food
 * - Recipe with canonical ingredient matches pantry with alias food
 * - Shopping list merges alias + canonical items
 * - approve_food_as_alias RPC works correctly
 * - Chain prevention (alias of alias rejected)
 * - Materialized view refreshes on alias change
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  createAuthenticatedClient,
  createAdminClient,
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
  resetCreatedResources,
  createTestShoppingList,
  refreshRecipeIngredientSummary,
} from "../seed";
import { expectSuccess, expectNoError } from "../helpers";

describe("Food Alias Behavior", () => {
  setupTestHooks();

  let clientA: PostgrestClient;
  let adminClient: PostgrestClient;

  interface FoodItem {
    id: string;
    name: string;
  }

  // Canonical foods
  let canonicalFood: FoodItem; // "TestCanonical" (e.g., kål)
  let aliasFood: FoodItem;     // "TestAlias" (e.g., vitkål) - will be alias of canonicalFood
  let otherFood: FoodItem;     // "TestOther" - unrelated food

  function uniqueSuffix(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  beforeAll(async () => {
    // Create test users
    await createTestUser(TEST_USERS.userA);
    clientA = await createAuthenticatedClient(TEST_USERS.userA.email);
    adminClient = await createAdminClient(TEST_USERS.admin.email);

    // Multi-home: leave all existing homes first, then create a fresh one
    await leaveAllHomes(clientA);
    await createTestHome(clientA, "Test Home for Aliases");

    // Create food items via regular user (pending status)
    const suffix = uniqueSuffix();
    canonicalFood = await getOrCreateFood(clientA, `TestCanonical ${suffix}`);
    aliasFood = await getOrCreateFood(clientA, `TestAlias ${suffix}`);
    otherFood = await getOrCreateFood(clientA, `TestOther ${suffix}`);

    // Approve canonical and other foods via admin
    await adminClient.rpc("approve_food", { p_food_id: canonicalFood.id });
    await adminClient.rpc("approve_food", { p_food_id: otherFood.id });

    // Approve alias food AND set canonical in one step
    await adminClient.rpc("approve_food_as_alias", {
      p_food_id: aliasFood.id,
      p_canonical_food_id: canonicalFood.id,
    });
  });

  afterAll(async () => {
    await cleanupTestData(TEST_USERS.userA.email);
  });

  beforeEach(async () => {
    resetCreatedResources();

    // Clear pantry before each test
    const pantryResult = await clientA.rpc<Array<{ food_id: string }>>(
      "get_user_pantry"
    );
    if (pantryResult.data) {
      for (const item of pantryResult.data) {
        await clientA.rpc("remove_from_pantry", { p_food_id: item.food_id });
      }
    }

    // Clean up recipes via direct table delete (delete_all_user_recipes is admin-only since V13)
    await clientA.from("recipes").delete().gte("id", "00000000-0000-0000-0000-000000000000");
    // Refresh materialized view (admin-only since V13, seed helper uses admin client)
    await refreshRecipeIngredientSummary(clientA);
  });

  /**
   * Helper to create a recipe with specific foods
   */
  async function createRecipeWithFoods(
    name: string,
    foods: FoodItem[]
  ): Promise<string> {
    const uniqueName = `${name} ${uniqueSuffix()}`;
    const recipeResult = await clientA.rpc<string>("insert_recipe", {
      p_name: uniqueName,
      p_description: "Test recipe for alias matching",
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

    // Refresh materialized view (admin-only since V13)
    await refreshRecipeIngredientSummary(clientA);

    return recipeResult.data;
  }

  describe("Pantry matching across aliases", () => {
    it("recipe with alias ingredient matches pantry with canonical food", async () => {
      // Recipe uses aliasFood (e.g., "vitkål"), pantry has canonicalFood (e.g., "kål")
      await createRecipeWithFoods("Alias Recipe", [aliasFood, otherFood]);

      // Add canonical food to pantry
      await addToPantry(clientA, canonicalFood.id);

      // Find recipes by ingredients - should match because alias resolves to canonical
      const result = await clientA.rpc<
        Array<{
          recipe_id: string;
          matching_ingredients: number;
          total_ingredients: number;
          match_percentage: number;
        }>
      >("find_recipes_by_ingredients", {
        p_food_ids: [canonicalFood.id],
        p_min_match_percentage: 1,
      });

      expectSuccess(result, "find_recipes_by_ingredients failed");
      expect(result.data.length).toBeGreaterThanOrEqual(1);

      // Should match 1 ingredient (canonical resolves from alias)
      const match = result.data[0];
      expect(match.matching_ingredients).toBe(1);
    });

    it("recipe with canonical ingredient matches pantry with alias food", async () => {
      // Recipe uses canonicalFood (e.g., "kål"), pantry has aliasFood (e.g., "vitkål")
      await createRecipeWithFoods("Canonical Recipe", [
        canonicalFood,
        otherFood,
      ]);

      // Add alias food to pantry (resolves to canonical)
      await addToPantry(clientA, aliasFood.id);

      // Find recipes by ingredients using alias food_id
      const result = await clientA.rpc<
        Array<{
          recipe_id: string;
          matching_ingredients: number;
          total_ingredients: number;
        }>
      >("find_recipes_by_ingredients", {
        p_food_ids: [aliasFood.id],
        p_min_match_percentage: 1,
      });

      expectSuccess(result, "find_recipes_by_ingredients failed");
      expect(result.data.length).toBeGreaterThanOrEqual(1);

      const match = result.data[0];
      expect(match.matching_ingredients).toBe(1);
    });

    it("both alias and canonical count as one ingredient in match stats", async () => {
      // Recipe uses both aliasFood and canonicalFood (they should count as one unique ingredient)
      await createRecipeWithFoods("Both Foods Recipe", [
        aliasFood,
        canonicalFood,
        otherFood,
      ]);

      // Add canonical food to pantry
      await addToPantry(clientA, canonicalFood.id);

      const result = await clientA.rpc<
        Array<{
          recipe_id: string;
          total_ingredients: number;
          matching_ingredients: number;
        }>
      >("find_recipes_by_ingredients", {
        p_food_ids: [canonicalFood.id],
        p_min_match_percentage: 1,
      });

      expectSuccess(result, "find_recipes_by_ingredients failed");
      expect(result.data.length).toBeGreaterThanOrEqual(1);

      const match = result.data[0];
      // aliasFood and canonicalFood should both resolve to canonical,
      // so total_ingredients should be 2 (1 canonical + 1 other), not 3
      expect(match.total_ingredients).toBe(2);
      expect(match.matching_ingredients).toBe(1);
    });
  });

  describe("in_pantry field in user_recipes", () => {
    it("marks alias ingredient as in_pantry when canonical is in pantry", async () => {
      // Create recipe with alias ingredient
      await createRecipeWithFoods("Pantry Check Recipe", [aliasFood]);

      // Add canonical food to pantry
      await addToPantry(clientA, canonicalFood.id);

      // Fetch recipe from the view
      const result = await clientA
        .from("user_recipes")
        .select("ingredients,pantry_matching_count,pantry_total_count")
        .limit(1)
        .order("date_published", { ascending: false });

      expectSuccess(result, "Failed to fetch user_recipes");
      const data = result.data as Array<{
        ingredients: Array<{ in_pantry: boolean; food_id: string }>;
        pantry_matching_count: number;
        pantry_total_count: number;
      }>;

      expect(data.length).toBeGreaterThanOrEqual(1);

      const recipe = data[0];
      // The alias ingredient should be marked as in_pantry
      const aliasIngredient = recipe.ingredients?.find(
        (ing) => ing.food_id === aliasFood.id
      );
      expect(aliasIngredient?.in_pantry).toBe(true);
      expect(recipe.pantry_matching_count).toBe(1);
    });
  });

  describe("Shopping list merging", () => {
    it("merges alias and canonical items in shopping list", async () => {
      // Create two recipes: one with aliasFood, one with canonicalFood
      const recipe1Id = await createRecipeWithFoods("ShopList Recipe 1", [
        aliasFood,
      ]);
      const recipe2Id = await createRecipeWithFoods("ShopList Recipe 2", [
        canonicalFood,
      ]);

      // Create shopping list
      const listId = await createTestShoppingList(clientA, "Alias Merge Test");

      // Add both recipes to the shopping list
      const add1 = await clientA.rpc("add_recipe_to_shopping_list", {
        p_recipe_id: recipe1Id,
        p_shopping_list_id: listId,
      });
      expectNoError(add1);

      const add2 = await clientA.rpc("add_recipe_to_shopping_list", {
        p_recipe_id: recipe2Id,
        p_shopping_list_id: listId,
      });
      expectNoError(add2);

      // Fetch shopping list items
      const itemsResult = await clientA
        .from("shopping_list_items")
        .select("*")
        .eq("shopping_list_id", listId);

      expectSuccess(itemsResult, "Failed to fetch shopping list items");
      const items = itemsResult.data as Array<{
        food_id: string;
        quantity: number;
      }>;

      // Because alias and canonical resolve to the same canonical_food_id,
      // the second add should merge with the first instead of creating a new item
      // So we should have 1 item with quantity 2, not 2 items with quantity 1
      const aliasOrCanonicalItems = items.filter(
        (item) =>
          item.food_id === aliasFood.id || item.food_id === canonicalFood.id
      );

      // Should have merged into one item
      expect(aliasOrCanonicalItems.length).toBe(1);
      expect(aliasOrCanonicalItems[0].quantity).toBe(2);
    });
  });

  describe("Admin alias functions", () => {
    it("approve_food_as_alias sets canonical and approves", async () => {
      // Create a new pending food
      const newFood = await getOrCreateFood(
        clientA,
        `TestNewAlias ${uniqueSuffix()}`
      );

      // Approve as alias of canonical
      const result = await adminClient.rpc("approve_food_as_alias", {
        p_food_id: newFood.id,
        p_canonical_food_id: canonicalFood.id,
      });
      expectNoError(result);

      // Verify via admin_list_foods
      const listResult = await adminClient.rpc<
        Array<{
          id: string;
          status: string;
          canonical_food_id: string;
          canonical_food_name: string;
        }>
      >("admin_list_foods", {
        p_search: newFood.name,
      });

      expectSuccess(listResult, "admin_list_foods failed");
      const found = listResult.data.find((f) => f.id === newFood.id);
      expect(found).toBeDefined();
      expect(found!.status).toBe("approved");
      expect(found!.canonical_food_id).toBe(canonicalFood.id);
      expect(found!.canonical_food_name).toBe(canonicalFood.name);
    });

    it("set_food_canonical sets and clears canonical", async () => {
      // Create and approve a food
      const food = await getOrCreateFood(
        clientA,
        `TestSetCanonical ${uniqueSuffix()}`
      );
      await adminClient.rpc("approve_food", { p_food_id: food.id });

      // Set canonical
      const setResult = await adminClient.rpc("set_food_canonical", {
        p_food_id: food.id,
        p_canonical_food_id: canonicalFood.id,
      });
      expectNoError(setResult);

      // Clear canonical
      const clearResult = await adminClient.rpc("set_food_canonical", {
        p_food_id: food.id,
        p_canonical_food_id: null,
      });
      expectNoError(clearResult);
    });
  });

  describe("Chain prevention", () => {
    it("rejects alias of alias (chain)", async () => {
      // aliasFood already has canonical_food_id set to canonicalFood
      // Try to set another food as alias of aliasFood (which would create a chain)
      const chainFood = await getOrCreateFood(
        clientA,
        `TestChain ${uniqueSuffix()}`
      );
      await adminClient.rpc("approve_food", { p_food_id: chainFood.id });

      const result = await adminClient.rpc("set_food_canonical", {
        p_food_id: chainFood.id,
        p_canonical_food_id: aliasFood.id, // aliasFood is itself an alias!
      });

      // Should fail with chain prevention error
      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("alias chain");
    });

    it("rejects self-alias", async () => {
      const result = await adminClient.rpc("set_food_canonical", {
        p_food_id: canonicalFood.id,
        p_canonical_food_id: canonicalFood.id,
      });

      expect(result.error).not.toBeNull();
    });
  });

  describe("Canonical resolution functions", () => {
    it("resolve_canonical returns own id for canonical food", async () => {
      const result = await clientA.rpc<string>("resolve_canonical", {
        p_food_id: canonicalFood.id,
      });

      expectNoError(result);
      expect(result.data).toBe(canonicalFood.id);
    });

    it("resolve_canonical returns canonical_food_id for alias food", async () => {
      const result = await clientA.rpc<string>("resolve_canonical", {
        p_food_id: aliasFood.id,
      });

      expectNoError(result);
      expect(result.data).toBe(canonicalFood.id);
    });

    it("resolve_food_ids_to_canonical deduplicates alias and canonical", async () => {
      // Passing both aliasFood.id and canonicalFood.id should return a single-element array
      const result = await clientA.rpc<string[]>(
        "resolve_food_ids_to_canonical",
        {
          p_food_ids: [aliasFood.id, canonicalFood.id, otherFood.id],
        }
      );

      expectNoError(result);
      const resolved = result.data as unknown as string[];
      // aliasFood and canonicalFood both resolve to canonicalFood.id -> deduped to 1
      // otherFood resolves to itself -> 1
      // Total: 2
      expect(resolved).toHaveLength(2);
      expect(resolved).toContain(canonicalFood.id);
      expect(resolved).toContain(otherFood.id);
    });

    it("resolve_food_ids_to_canonical returns empty array for empty input", async () => {
      const result = await clientA.rpc<string[]>(
        "resolve_food_ids_to_canonical",
        {
          p_food_ids: [],
        }
      );

      expectNoError(result);
      const resolved = result.data as unknown as string[];
      expect(resolved).toHaveLength(0);
    });
  });

  describe("search_foods returns canonical info", () => {
    it("includes canonical_food_id and canonical_food_name for alias foods", async () => {
      const result = await clientA.rpc<
        Array<{
          id: string;
          name: string;
          canonical_food_id: string | null;
          canonical_food_name: string | null;
        }>
      >("search_foods", {
        p_query: aliasFood.name,
      });

      expectSuccess(result, "search_foods failed");
      const found = result.data.find((f) => f.id === aliasFood.id);
      expect(found).toBeDefined();
      expect(found!.canonical_food_id).toBe(canonicalFood.id);
      expect(found!.canonical_food_name).toBe(canonicalFood.name);
    });

    it("returns null canonical for non-alias foods", async () => {
      const result = await clientA.rpc<
        Array<{
          id: string;
          canonical_food_id: string | null;
          canonical_food_name: string | null;
        }>
      >("search_foods", {
        p_query: canonicalFood.name,
      });

      expectSuccess(result, "search_foods failed");
      const found = result.data.find((f) => f.id === canonicalFood.id);
      expect(found).toBeDefined();
      expect(found!.canonical_food_id).toBeNull();
      expect(found!.canonical_food_name).toBeNull();
    });
  });
});
