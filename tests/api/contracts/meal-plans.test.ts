/**
 * Contract tests for Meal Plan RPCs
 *
 * Tests the API contract for all meal plan related RPC functions:
 * - save_meal_plan
 * - get_meal_plan
 * - swap_meal_plan_entry
 * - add_meal_plan_to_shopping_list
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
  createTestRecipe,
  createTestShoppingList,
  cleanupTestData,
  resetCreatedResources,
  uniqueId,
  ensureUserHasHome,
  leaveAllHomes,
} from "../seed";
import {
  expectSuccess,
  expectError,
  expectValidUuid,
  expectNoError,
} from "../helpers";

/**
 * Create a client with custom headers (e.g., X-Active-Home-Id)
 */
async function createClientWithHeaders(
  email: string,
  headers: Record<string, string>
): Promise<PostgrestClient> {
  const baseClient = await createAuthenticatedClient(email);
  const token = baseClient.getToken();

  // Create a new client that merges custom headers
  const getHeaders = (): Record<string, string> => {
    const defaultHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    if (token) {
      defaultHeaders["Authorization"] = `Bearer ${token}`;
    }

    return { ...defaultHeaders, ...headers };
  };

  // Override rpc to use custom headers
  const rpc = async <T = unknown>(
    functionName: string,
    params?: Record<string, unknown>
  ) => {
    const response = await fetch(
      `${process.env.TEST_POSTGREST_URL || "http://localhost:4445"}/rpc/${functionName}`,
      {
        method: "POST",
        headers: getHeaders(),
        body: params ? JSON.stringify(params) : undefined,
      }
    );

    const status = response.status;

    if (!response.ok) {
      const errorText = await response.text();
      let error;
      try {
        error = JSON.parse(errorText);
      } catch {
        error = { message: errorText };
      }
      return { data: null, error, status };
    }

    const text = await response.text();
    if (!text) {
      return { data: null, error: null, status };
    }

    try {
      const data = JSON.parse(text) as T;
      return { data, error: null, status };
    } catch {
      return { data: text as unknown as T, error: null, status };
    }
  };

  return {
    ...baseClient,
    rpc,
  };
}

describe("Meal Plan RPCs", () => {
  let clientA: PostgrestClient;
  let clientB: PostgrestClient;
  let anonClient: PostgrestClient;

  // Home IDs for testing
  let homeIdA: string;
  let homeIdB: string;

  // Clients with home context
  let clientAWithHome: PostgrestClient;
  let clientBWithHome: PostgrestClient;

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

    // Ensure users have SEPARATE homes
    homeIdA = await ensureUserHasHome(clientA, "Test Home A");
    homeIdB = await ensureUserHasHome(clientB, "Test Home B");

    // Create clients with home context headers
    clientAWithHome = await createClientWithHeaders(TEST_USERS.userA.email, {
      "X-Active-Home-Id": homeIdA,
    });
    clientBWithHome = await createClientWithHeaders(TEST_USERS.userB.email, {
      "X-Active-Home-Id": homeIdB,
    });
  });

  afterAll(async () => {
    await cleanupTestData(TEST_USERS.userA.email);
    await cleanupTestData(TEST_USERS.userB.email);
  });

  beforeEach(() => {
    resetCreatedResources();
  });

  // =========================================================================
  // save_meal_plan
  // =========================================================================
  describe("save_meal_plan", () => {
    it("should return a UUID for the new plan", async () => {
      const result = await clientAWithHome.rpc<string>("save_meal_plan", {
        p_week_start: "2026-02-17",
        p_preferences: { dietary: [], meal_types: ["middag"], servings: 4 },
        p_entries: [
          {
            day_of_week: 1,
            meal_type: "middag",
            suggested_name: "Pasta Carbonara",
            suggested_description: "Klassisk italiensk pasta",
            servings: 4,
          },
        ],
      });

      expectSuccess(result);
      expectValidUuid(result.data);
    });

    it("should create a plan with suggested entries", async () => {
      const result = await clientAWithHome.rpc<string>("save_meal_plan", {
        p_week_start: "2026-02-17",
        p_preferences: { dietary: [], meal_types: ["middag"], servings: 4 },
        p_entries: [
          {
            day_of_week: 1,
            meal_type: "middag",
            suggested_name: "Pasta Carbonara",
            suggested_description: "Klassisk italiensk pasta",
            servings: 4,
            sort_order: 0,
          },
          {
            day_of_week: 2,
            meal_type: "middag",
            suggested_name: "Kycklinggryta",
            suggested_description: "Med ris och grönsaker",
            servings: 4,
            sort_order: 0,
          },
        ],
      });

      expectSuccess(result);

      // Verify the plan was created
      const plan = await clientAWithHome.rpc<{
        id: string;
        entries: Array<{ suggested_name: string }>;
      }>("get_meal_plan", { p_plan_id: result.data });

      expectSuccess(plan);
      expect(plan.data?.entries).toHaveLength(2);
      expect(plan.data?.entries[0].suggested_name).toBe("Pasta Carbonara");
      expect(plan.data?.entries[1].suggested_name).toBe("Kycklinggryta");
    });

    it("should create a plan with recipe_id entries", async () => {
      // Create a test recipe first
      const recipeId = await createTestRecipe(clientA, {
        name: uniqueId("Meal Plan Recipe"),
        ingredients: [{ name: "Pasta", measurement: "g", quantity: "500" }],
      });

      const result = await clientAWithHome.rpc<string>("save_meal_plan", {
        p_week_start: "2026-02-17",
        p_preferences: { dietary: [], meal_types: ["middag"], servings: 4 },
        p_entries: [
          {
            day_of_week: 1,
            meal_type: "middag",
            recipe_id: recipeId,
            servings: 4,
            sort_order: 0,
          },
        ],
      });

      expectSuccess(result);

      // Verify the plan includes the recipe
      const plan = await clientAWithHome.rpc<{
        id: string;
        entries: Array<{ recipe_id: string; recipe: { name: string } | null }>;
      }>("get_meal_plan", { p_plan_id: result.data });

      expectSuccess(plan);
      expect(plan.data?.entries[0].recipe_id).toBe(recipeId);
      expect(plan.data?.entries[0].recipe).toBeDefined();
    });

    it("should archive previous active plan when creating new one", async () => {
      // Create first plan
      const firstPlan = await clientAWithHome.rpc<string>("save_meal_plan", {
        p_week_start: "2026-02-17",
        p_preferences: { dietary: [], meal_types: ["middag"], servings: 4 },
        p_entries: [
          {
            day_of_week: 1,
            meal_type: "middag",
            suggested_name: "First Plan",
            servings: 4,
          },
        ],
      });
      expectSuccess(firstPlan);

      // Create second plan
      const secondPlan = await clientAWithHome.rpc<string>("save_meal_plan", {
        p_week_start: "2026-02-24",
        p_preferences: { dietary: [], meal_types: ["middag"], servings: 4 },
        p_entries: [
          {
            day_of_week: 1,
            meal_type: "middag",
            suggested_name: "Second Plan",
            servings: 4,
          },
        ],
      });
      expectSuccess(secondPlan);

      // First plan should be archived
      const firstPlanData = await clientAWithHome.rpc<{ status: string }>(
        "get_meal_plan",
        { p_plan_id: firstPlan.data }
      );
      expectSuccess(firstPlanData);
      expect(firstPlanData.data?.status).toBe("archived");

      // Second plan should be active
      const secondPlanData = await clientAWithHome.rpc<{ status: string }>(
        "get_meal_plan",
        { p_plan_id: secondPlan.data }
      );
      expectSuccess(secondPlanData);
      expect(secondPlanData.data?.status).toBe("active");
    });

    it("should fail for unauthenticated users", async () => {
      const result = await anonClient.rpc("save_meal_plan", {
        p_week_start: "2026-02-17",
        p_preferences: {},
        p_entries: [],
      });

      expectError(result);
    });
  });

  // =========================================================================
  // get_meal_plan
  // =========================================================================
  describe("get_meal_plan", () => {
    it("should return null when no active plan exists", async () => {
      // Create a new user without any plans
      const uniqueEmail = `test-no-plan-${Date.now()}@example.com`;
      await createTestUser({
        email: uniqueEmail,
        name: "No Plan User",
        password: "NoP1an123!",
      });
      const noPlanClient = await createAuthenticatedClient(uniqueEmail);
      const homeId = await ensureUserHasHome(noPlanClient, "No Plan Home");
      const clientWithHome = await createClientWithHeaders(uniqueEmail, {
        "X-Active-Home-Id": homeId,
      });

      const result = await clientWithHome.rpc<null>("get_meal_plan");

      // Should succeed but return null (no error, but no data either)
      expectNoError(result);
      expect(result.data).toBeNull();
    });

    it("should return the active plan with entries", async () => {
      // Create a plan
      const planId = await clientAWithHome.rpc<string>("save_meal_plan", {
        p_week_start: "2026-02-17",
        p_preferences: { dietary: [], meal_types: ["middag"], servings: 4 },
        p_entries: [
          {
            day_of_week: 1,
            meal_type: "middag",
            suggested_name: "Test Meal",
            servings: 4,
          },
        ],
      });
      expectSuccess(planId);

      // Get the plan without specifying ID (should return active plan)
      const result = await clientAWithHome.rpc<{
        id: string;
        week_start: string;
        status: string;
        entries: Array<unknown>;
      }>("get_meal_plan");

      expectSuccess(result);
      expect(result.data).toBeDefined();
      expect(result.data?.id).toBe(planId.data);
      expect(result.data?.status).toBe("active");
      expect(result.data?.entries).toHaveLength(1);
    });

    it("should include recipe details for entries with recipe_id", async () => {
      // Create a test recipe
      const recipeId = await createTestRecipe(clientA, {
        name: uniqueId("Meal Plan Recipe With Details"),
        ingredients: [{ name: "Pasta", measurement: "g", quantity: "500" }],
      });

      // Create a plan with the recipe
      const planId = await clientAWithHome.rpc<string>("save_meal_plan", {
        p_week_start: "2026-02-17",
        p_preferences: {},
        p_entries: [
          {
            day_of_week: 1,
            meal_type: "middag",
            recipe_id: recipeId,
            servings: 4,
          },
        ],
      });
      expectSuccess(planId);

      // Get the plan
      const result = await clientAWithHome.rpc<{
        entries: Array<{
          recipe_id: string;
          recipe: {
            id: string;
            name: string;
            thumbnail: string | null;
          } | null;
        }>;
      }>("get_meal_plan", { p_plan_id: planId.data });

      expectSuccess(result);
      expect(result.data?.entries[0].recipe).toBeDefined();
      expect(result.data?.entries[0].recipe?.id).toBe(recipeId);
      expect(result.data?.entries[0].recipe?.name).toBeDefined();
    });

    it("should return specific plan by ID", async () => {
      // Create two plans (second will archive first)
      const firstPlanId = await clientAWithHome.rpc<string>("save_meal_plan", {
        p_week_start: "2026-02-17",
        p_preferences: {},
        p_entries: [
          { day_of_week: 1, meal_type: "middag", suggested_name: "Plan 1", servings: 4 },
        ],
      });
      expectSuccess(firstPlanId);

      const secondPlanId = await clientAWithHome.rpc<string>("save_meal_plan", {
        p_week_start: "2026-02-24",
        p_preferences: {},
        p_entries: [
          { day_of_week: 1, meal_type: "middag", suggested_name: "Plan 2", servings: 4 },
        ],
      });
      expectSuccess(secondPlanId);

      // Get the archived plan by ID
      const result = await clientAWithHome.rpc<{
        id: string;
        status: string;
        entries: Array<{ suggested_name: string }>;
      }>("get_meal_plan", { p_plan_id: firstPlanId.data });

      expectSuccess(result);
      expect(result.data?.id).toBe(firstPlanId.data);
      expect(result.data?.status).toBe("archived");
      expect(result.data?.entries[0].suggested_name).toBe("Plan 1");
    });

    it("should fail for unauthenticated users", async () => {
      const result = await anonClient.rpc("get_meal_plan");

      expectError(result);
    });
  });

  // =========================================================================
  // swap_meal_plan_entry
  // =========================================================================
  describe("swap_meal_plan_entry", () => {
    let testPlanId: string;
    let testEntryId: string;

    beforeEach(async () => {
      // Create a plan with one entry
      const planResult = await clientAWithHome.rpc<string>("save_meal_plan", {
        p_week_start: "2026-02-17",
        p_preferences: {},
        p_entries: [
          {
            day_of_week: 1,
            meal_type: "middag",
            suggested_name: "Original Meal",
            servings: 4,
          },
        ],
      });
      expectSuccess(planResult);
      testPlanId = planResult.data!;

      // Get the entry ID
      const plan = await clientAWithHome.rpc<{
        entries: Array<{ id: string }>;
      }>("get_meal_plan", { p_plan_id: testPlanId });
      expectSuccess(plan);
      testEntryId = plan.data!.entries[0].id;
    });

    it("should return void (null data) on success", async () => {
      const result = await clientAWithHome.rpc("swap_meal_plan_entry", {
        p_entry_id: testEntryId,
        p_suggested_name: "New Meal",
      });

      expectNoError(result);
      expect(result.data).toBeNull();
    });

    it("should successfully swap to a different recipe", async () => {
      // Create a recipe to swap to
      const recipeId = await createTestRecipe(clientA, {
        name: uniqueId("Swap Recipe"),
        ingredients: [{ name: "Ingredient", measurement: "st", quantity: "1" }],
      });

      await clientAWithHome.rpc("swap_meal_plan_entry", {
        p_entry_id: testEntryId,
        p_recipe_id: recipeId,
      });

      // Verify the swap
      const plan = await clientAWithHome.rpc<{
        entries: Array<{ recipe_id: string; suggested_name: string | null }>;
      }>("get_meal_plan", { p_plan_id: testPlanId });

      expectSuccess(plan);
      expect(plan.data?.entries[0].recipe_id).toBe(recipeId);
    });

    it("should successfully swap to a suggested name", async () => {
      await clientAWithHome.rpc("swap_meal_plan_entry", {
        p_entry_id: testEntryId,
        p_suggested_name: "Completely New Meal",
        p_suggested_description: "A brand new suggestion",
      });

      // Verify the swap
      const plan = await clientAWithHome.rpc<{
        entries: Array<{ suggested_name: string; suggested_description: string }>;
      }>("get_meal_plan", { p_plan_id: testPlanId });

      expectSuccess(plan);
      expect(plan.data?.entries[0].suggested_name).toBe("Completely New Meal");
      expect(plan.data?.entries[0].suggested_description).toBe("A brand new suggestion");
    });

    it("should fail when entry doesn't exist", async () => {
      const fakeEntryId = "00000000-0000-0000-0000-000000000000";

      const result = await clientAWithHome.rpc("swap_meal_plan_entry", {
        p_entry_id: fakeEntryId,
        p_suggested_name: "New Meal",
      });

      expectError(result);
    });

    it("should fail for unauthenticated users", async () => {
      const result = await anonClient.rpc("swap_meal_plan_entry", {
        p_entry_id: testEntryId,
        p_suggested_name: "Hacker Meal",
      });

      expectError(result);
    });
  });

  // =========================================================================
  // add_meal_plan_to_shopping_list
  // =========================================================================
  describe("add_meal_plan_to_shopping_list", () => {
    let testPlanId: string;
    let testRecipeId: string;
    let testShoppingListId: string;

    beforeAll(async () => {
      // Create a recipe
      testRecipeId = await createTestRecipe(clientA, {
        name: uniqueId("Shopping Plan Recipe"),
        ingredients: [
          { name: "Milk", measurement: "dl", quantity: "5" },
          { name: "Eggs", measurement: "st", quantity: "3" },
        ],
      });
    });

    beforeEach(async () => {
      // Create a shopping list for each test
      testShoppingListId = await createTestShoppingList(clientA, uniqueId("Plan Shopping List"));

      // Create a plan with recipe entries
      const planResult = await clientAWithHome.rpc<string>("save_meal_plan", {
        p_week_start: "2026-02-17",
        p_preferences: {},
        p_entries: [
          {
            day_of_week: 1,
            meal_type: "middag",
            recipe_id: testRecipeId,
            servings: 4,
          },
        ],
      });
      expectSuccess(planResult);
      testPlanId = planResult.data!;
    });

    it("should return correct shape with recipes_added count", async () => {
      const result = await clientA.rpc<{ recipes_added: number }>(
        "add_meal_plan_to_shopping_list",
        {
          p_plan_id: testPlanId,
          p_shopping_list_id: testShoppingListId,
        }
      );

      expectSuccess(result);
      expect(result.data).toMatchObject({
        recipes_added: expect.any(Number),
      });
    });

    it("should successfully add recipes to shopping list", async () => {
      const result = await clientA.rpc<{ recipes_added: number }>(
        "add_meal_plan_to_shopping_list",
        {
          p_plan_id: testPlanId,
          p_shopping_list_id: testShoppingListId,
        }
      );

      expectSuccess(result);
      expect(result.data?.recipes_added).toBe(1);
    });

    it("should return correct count of added recipes", async () => {
      // Create a plan with multiple recipes
      const recipe1 = await createTestRecipe(clientA, {
        name: uniqueId("Recipe 1"),
        ingredients: [{ name: "Sugar", measurement: "dl", quantity: "1" }],
      });
      const recipe2 = await createTestRecipe(clientA, {
        name: uniqueId("Recipe 2"),
        ingredients: [{ name: "Flour", measurement: "dl", quantity: "2" }],
      });

      const multiPlanId = await clientAWithHome.rpc<string>("save_meal_plan", {
        p_week_start: "2026-02-17",
        p_preferences: {},
        p_entries: [
          { day_of_week: 1, meal_type: "middag", recipe_id: recipe1, servings: 4 },
          { day_of_week: 2, meal_type: "middag", recipe_id: recipe2, servings: 4 },
        ],
      });
      expectSuccess(multiPlanId);

      const result = await clientA.rpc<{ recipes_added: number }>(
        "add_meal_plan_to_shopping_list",
        {
          p_plan_id: multiPlanId.data,
          p_shopping_list_id: testShoppingListId,
        }
      );

      expectSuccess(result);
      expect(result.data?.recipes_added).toBe(2);
    });

    it("should ignore entries without recipe_id (AI suggestions)", async () => {
      // Create a plan with both recipe and suggestion entries
      const mixedPlanId = await clientAWithHome.rpc<string>("save_meal_plan", {
        p_week_start: "2026-02-17",
        p_preferences: {},
        p_entries: [
          { day_of_week: 1, meal_type: "middag", recipe_id: testRecipeId, servings: 4 },
          {
            day_of_week: 2,
            meal_type: "middag",
            suggested_name: "AI Suggestion",
            servings: 4,
          },
        ],
      });
      expectSuccess(mixedPlanId);

      const result = await clientA.rpc<{ recipes_added: number }>(
        "add_meal_plan_to_shopping_list",
        {
          p_plan_id: mixedPlanId.data,
          p_shopping_list_id: testShoppingListId,
        }
      );

      expectSuccess(result);
      // Only the recipe entry should be added, not the suggestion
      expect(result.data?.recipes_added).toBe(1);
    });

    it("should fail for unauthenticated users", async () => {
      const result = await anonClient.rpc("add_meal_plan_to_shopping_list", {
        p_plan_id: testPlanId,
        p_shopping_list_id: testShoppingListId,
      });

      expectError(result);
    });

    it("should fail when plan doesn't exist", async () => {
      const fakePlanId = "00000000-0000-0000-0000-000000000000";

      const result = await clientA.rpc("add_meal_plan_to_shopping_list", {
        p_plan_id: fakePlanId,
        p_shopping_list_id: testShoppingListId,
      });

      expectError(result);
    });
  });
});
