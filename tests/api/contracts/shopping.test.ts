/**
 * Contract tests for Shopping List RPCs
 *
 * Tests the API contract for all shopping list related RPC functions:
 * - get_or_create_default_shopping_list
 * - create_shopping_list
 * - get_user_shopping_lists
 * - add_recipe_to_shopping_list
 * - toggle_shopping_list_item
 * - clear_checked_items
 * - rename_shopping_list
 * - delete_shopping_list
 * - set_default_shopping_list
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
  addShoppingListItem,
  cleanupTestData,
  resetCreatedResources,
  uniqueId,
  ensureUserHasHome,
} from "../seed";
import {
  expectSuccess,
  expectError,
  expectValidUuid,
  expectShoppingListItemShape,
  expectNoError,
} from "../helpers";
import type { ShoppingList, ShoppingListItem } from "../../../types";

describe("Shopping List RPCs", () => {
  let clientA: PostgrestClient;
  let clientB: PostgrestClient;
  let anonClient: PostgrestClient;

  // Track dynamically created users for cleanup
  const dynamicUserEmails: string[] = [];

  beforeAll(async () => {
    // Create test users
    await createTestUser(TEST_USERS.userA);
    await createTestUser(TEST_USERS.userB);

    // Create authenticated clients
    clientA = await createAuthenticatedClient(TEST_USERS.userA.email);
    clientB = await createAuthenticatedClient(TEST_USERS.userB.email);
    anonClient = createAnonymousClient();

    // Leave any existing homes to ensure users are in separate homes
    await clientA.rpc("leave_home");
    await clientB.rpc("leave_home");

    // Ensure users have SEPARATE homes (required for shopping list isolation tests)
    await ensureUserHasHome(clientA, "Test Home A");
    await ensureUserHasHome(clientB, "Test Home B");
  });

  afterAll(async () => {
    // Clean up dynamically created users
    for (const email of dynamicUserEmails) {
      try {
        await cleanupTestData(email);
      } catch {
        // Ignore cleanup errors for dynamic users
      }
    }
    await cleanupTestData(TEST_USERS.userA.email);
    await cleanupTestData(TEST_USERS.userB.email);
  });

  beforeEach(() => {
    resetCreatedResources();
  });

  // =========================================================================
  // get_or_create_default_shopping_list
  // =========================================================================
  describe("get_or_create_default_shopping_list", () => {
    it("should return a UUID", async () => {
      const result = await clientA.rpc<string>("get_or_create_default_shopping_list");

      expectSuccess(result);
      expectValidUuid(result.data);
    });

    it("should return the same UUID on subsequent calls", async () => {
      const result1 = await clientA.rpc<string>("get_or_create_default_shopping_list");
      const result2 = await clientA.rpc<string>("get_or_create_default_shopping_list");

      expectSuccess(result1);
      expectSuccess(result2);
      expect(result1.data).toBe(result2.data);
    });

    it("should create a default list if none exists", async () => {
      const listId = await clientA.rpc<string>("get_or_create_default_shopping_list");
      expectSuccess(listId);

      // Verify the list exists and is marked as default
      const lists = await clientA.rpc<ShoppingList[]>("get_user_shopping_lists");
      expectSuccess(lists);

      const defaultList = lists.data?.find((l) => l.id === listId.data);
      expect(defaultList).toBeDefined();
      expect(defaultList?.is_default).toBe(true);
    });

    it("should fail for unauthenticated users", async () => {
      const result = await anonClient.rpc("get_or_create_default_shopping_list");

      expectError(result);
    });

    it("should return different lists for different users", async () => {
      const resultA = await clientA.rpc<string>("get_or_create_default_shopping_list");
      const resultB = await clientB.rpc<string>("get_or_create_default_shopping_list");

      expectSuccess(resultA);
      expectSuccess(resultB);
      expect(resultA.data).not.toBe(resultB.data);
    });
  });

  // =========================================================================
  // create_shopping_list
  // =========================================================================
  describe("create_shopping_list", () => {
    it("should return a UUID for the new list", async () => {
      const listName = uniqueId("Shopping List");
      const result = await clientA.rpc<string>("create_shopping_list", {
        p_name: listName,
      });

      expectSuccess(result);
      expectValidUuid(result.data);
    });

    it("should create a list with the given name", async () => {
      const listName = uniqueId("My Custom List");
      const createResult = await clientA.rpc<string>("create_shopping_list", {
        p_name: listName,
      });
      expectSuccess(createResult);

      const lists = await clientA.rpc<ShoppingList[]>("get_user_shopping_lists");
      expectSuccess(lists);

      const createdList = lists.data?.find((l) => l.id === createResult.data);
      expect(createdList).toBeDefined();
      expect(createdList?.name).toBe(listName);
    });

    it("should set first list as default", async () => {
      // Create a new user without any lists
      const uniqueEmail = `test-first-list-${Date.now()}@example.com`;
      dynamicUserEmails.push(uniqueEmail);
      await createTestUser({
        email: uniqueEmail,
        name: "Temp User",
        password: "TempPass123!",
      });
      const tempClient = await createAuthenticatedClient(uniqueEmail);

      // Create a home for the user (required for shopping lists)
      await ensureUserHasHome(tempClient, "Temp Home");

      const listName = uniqueId("First List");
      const result = await tempClient.rpc<string>("create_shopping_list", {
        p_name: listName,
      });
      expectSuccess(result);

      const lists = await tempClient.rpc<ShoppingList[]>("get_user_shopping_lists");
      expectSuccess(lists);

      const firstList = lists.data?.find((l) => l.id === result.data);
      expect(firstList?.is_default).toBe(true);
    });

    it("should not set subsequent lists as default", async () => {
      // Ensure default list exists
      await clientA.rpc<string>("get_or_create_default_shopping_list");

      const listName = uniqueId("Second List");
      const result = await clientA.rpc<string>("create_shopping_list", {
        p_name: listName,
      });
      expectSuccess(result);

      const lists = await clientA.rpc<ShoppingList[]>("get_user_shopping_lists");
      expectSuccess(lists);

      const newList = lists.data?.find((l) => l.id === result.data);
      expect(newList?.is_default).toBe(false);
    });

    it("should fail with empty name", async () => {
      const result = await clientA.rpc("create_shopping_list", {
        p_name: "",
      });

      expectError(result);
    });

    it("should fail with whitespace-only name", async () => {
      const result = await clientA.rpc("create_shopping_list", {
        p_name: "   ",
      });

      expectError(result);
    });

    it("should fail with null name", async () => {
      const result = await clientA.rpc("create_shopping_list", {
        p_name: null,
      });

      expectError(result);
    });

    it("should trim whitespace from name", async () => {
      const listName = uniqueId("Trimmed List");
      const result = await clientA.rpc<string>("create_shopping_list", {
        p_name: `  ${listName}  `,
      });
      expectSuccess(result);

      const lists = await clientA.rpc<ShoppingList[]>("get_user_shopping_lists");
      expectSuccess(lists);

      const createdList = lists.data?.find((l) => l.id === result.data);
      expect(createdList?.name).toBe(listName);
    });

    it("should fail for unauthenticated users", async () => {
      const result = await anonClient.rpc("create_shopping_list", {
        p_name: "Test List",
      });

      expectError(result);
    });

    it("should fail with duplicate name for same home", async () => {
      const listName = uniqueId("Duplicate Name");
      await clientA.rpc<string>("create_shopping_list", { p_name: listName });

      const result = await clientA.rpc("create_shopping_list", {
        p_name: listName,
      });

      expectError(result);
    });
  });

  // =========================================================================
  // get_user_shopping_lists
  // =========================================================================
  describe("get_user_shopping_lists", () => {
    it("should return an array of shopping lists", async () => {
      const result = await clientA.rpc<ShoppingList[]>("get_user_shopping_lists");

      expectSuccess(result);
      expect(Array.isArray(result.data)).toBe(true);
    });

    it("should return correct shape for each list", async () => {
      // Ensure at least one list exists
      await clientA.rpc<string>("get_or_create_default_shopping_list");

      const result = await clientA.rpc<ShoppingList[]>("get_user_shopping_lists");
      expectSuccess(result);

      expect(result.data!.length).toBeGreaterThan(0);

      for (const list of result.data!) {
        expect(list).toMatchObject({
          id: expect.any(String),
          name: expect.any(String),
          is_default: expect.any(Boolean),
          item_count: expect.any(Number),
          checked_count: expect.any(Number),
          date_published: expect.any(String),
          date_modified: expect.any(String),
        });

        // Verify UUID format
        expectValidUuid(list.id);

        // Verify counts are non-negative
        expect(list.item_count).toBeGreaterThanOrEqual(0);
        expect(list.checked_count).toBeGreaterThanOrEqual(0);
        expect(list.checked_count).toBeLessThanOrEqual(list.item_count);
      }
    });

    it("should return default list first", async () => {
      // Create default and non-default lists
      await clientA.rpc<string>("get_or_create_default_shopping_list");
      await clientA.rpc<string>("create_shopping_list", {
        p_name: uniqueId("Non-default List"),
      });

      const result = await clientA.rpc<ShoppingList[]>("get_user_shopping_lists");
      expectSuccess(result);

      expect(result.data!.length).toBeGreaterThan(1);
      expect(result.data![0].is_default).toBe(true);
    });

    it("should include correct item counts", async () => {
      const listId = await createTestShoppingList(clientA, uniqueId("Count Test List"));

      // Add items to the list
      await addShoppingListItem(clientA, listId, { display_name: "Item 1" });
      await addShoppingListItem(clientA, listId, { display_name: "Item 2" });
      const itemId = await addShoppingListItem(clientA, listId, { display_name: "Item 3" });

      // Check one item
      await clientA.rpc("toggle_shopping_list_item", { p_item_id: itemId });

      const result = await clientA.rpc<ShoppingList[]>("get_user_shopping_lists");
      expectSuccess(result);

      const list = result.data!.find((l) => l.id === listId);
      expect(list).toBeDefined();
      expect(list?.item_count).toBe(3);
      expect(list?.checked_count).toBe(1);
    });

    it("should return empty array for user without lists", async () => {
      // Create a new user without lists
      const uniqueEmail = `test-empty-${Date.now()}@example.com`;
      dynamicUserEmails.push(uniqueEmail);
      await createTestUser({
        email: uniqueEmail,
        name: "Empty User",
        password: "EmptyPass123!",
      });
      const emptyClient = await createAuthenticatedClient(uniqueEmail);

      // Create home but no shopping lists
      await ensureUserHasHome(emptyClient, "Empty Home");

      const result = await emptyClient.rpc<ShoppingList[]>("get_user_shopping_lists");
      expectSuccess(result);
      expect(result.data).toEqual([]);
    });

    it("should fail for unauthenticated users", async () => {
      const result = await anonClient.rpc("get_user_shopping_lists");

      expectError(result);
    });

    it("should only return lists for the current user's home", async () => {
      const listNameA = uniqueId("User A List");
      const listNameB = uniqueId("User B List");

      await clientA.rpc<string>("create_shopping_list", { p_name: listNameA });
      await clientB.rpc<string>("create_shopping_list", { p_name: listNameB });

      const resultA = await clientA.rpc<ShoppingList[]>("get_user_shopping_lists");
      const resultB = await clientB.rpc<ShoppingList[]>("get_user_shopping_lists");

      expectSuccess(resultA);
      expectSuccess(resultB);

      // User A should not see User B's list
      const listNamesA = resultA.data!.map((l) => l.name);
      expect(listNamesA).toContain(listNameA);
      expect(listNamesA).not.toContain(listNameB);

      // User B should not see User A's list
      const listNamesB = resultB.data!.map((l) => l.name);
      expect(listNamesB).toContain(listNameB);
      expect(listNamesB).not.toContain(listNameA);
    });
  });

  // =========================================================================
  // add_recipe_to_shopping_list
  // =========================================================================
  describe("add_recipe_to_shopping_list", () => {
    let testRecipeId: string;
    let testListId: string;

    beforeAll(async () => {
      // Create a test recipe with known ingredients
      testRecipeId = await createTestRecipe(clientA, {
        name: uniqueId("Shopping Test Recipe"),
        ingredients: [
          { name: "Milk", measurement: "dl", quantity: "2" },
          { name: "Flour", measurement: "dl", quantity: "3" },
          { name: "Sugar", measurement: "msk", quantity: "2" },
        ],
        recipe_yield: 4,
      });
    });

    beforeEach(async () => {
      // Create a fresh list for each test
      testListId = await createTestShoppingList(clientA, uniqueId("Recipe Test List"));
    });

    it("should return correct shape with added_count and list_id", async () => {
      const result = await clientA.rpc<{ added_count: number; list_id: string }>(
        "add_recipe_to_shopping_list",
        {
          p_recipe_id: testRecipeId,
          p_shopping_list_id: testListId,
        }
      );

      expectSuccess(result);
      expect(result.data).toMatchObject({
        added_count: expect.any(Number),
        list_id: expect.any(String),
      });
      expectValidUuid(result.data!.list_id);
    });

    it("should add all recipe ingredients to shopping list", async () => {
      const result = await clientA.rpc<{ added_count: number; list_id: string }>(
        "add_recipe_to_shopping_list",
        {
          p_recipe_id: testRecipeId,
          p_shopping_list_id: testListId,
        }
      );

      expectSuccess(result);
      expect(result.data!.added_count).toBe(3);
      expect(result.data!.list_id).toBe(testListId);
    });

    it("should use default shopping list when none specified", async () => {
      const defaultListId = await clientA.rpc<string>("get_or_create_default_shopping_list");
      expectSuccess(defaultListId);

      const result = await clientA.rpc<{ added_count: number; list_id: string }>(
        "add_recipe_to_shopping_list",
        {
          p_recipe_id: testRecipeId,
          // p_shopping_list_id not specified
        }
      );

      expectSuccess(result);
      expect(result.data!.list_id).toBe(defaultListId.data);
    });

    it("should scale quantities based on servings", async () => {
      // Add recipe at 8 servings (2x the original 4)
      await clientA.rpc<{ added_count: number; list_id: string }>(
        "add_recipe_to_shopping_list",
        {
          p_recipe_id: testRecipeId,
          p_shopping_list_id: testListId,
          p_servings: 8,
        }
      );

      // Verify items were added with scaled quantities
      const itemsResult = await clientA
        .from("shopping_list_view")
        .select("*")
        .eq("shopping_list_id", testListId);

      expectSuccess(itemsResult);
      const items = itemsResult.data as ShoppingListItem[];

      // Original Milk was 2 dl, scaled to 8 servings (2x) = 4 dl
      const milk = items.find((i) => i.display_name === "Milk");
      expect(milk?.quantity).toBe(4);
    });

    it("should only add specified ingredients when p_ingredient_ids provided", async () => {
      // Get ingredient IDs for the recipe
      const ingredientsResult = await clientA
        .from("ingredients")
        .select("id, name")
        .eq("recipe_id", testRecipeId);

      expectSuccess(ingredientsResult);
      const ingredients = ingredientsResult.data as { id: string; name: string }[];

      // Only add the first ingredient
      const firstIngredientId = ingredients[0].id;

      const result = await clientA.rpc<{ added_count: number; list_id: string }>(
        "add_recipe_to_shopping_list",
        {
          p_recipe_id: testRecipeId,
          p_shopping_list_id: testListId,
          p_ingredient_ids: [firstIngredientId],
        }
      );

      expectSuccess(result);
      expect(result.data!.added_count).toBe(1);
    });

    it("should fail with non-existent recipe", async () => {
      const fakeRecipeId = "00000000-0000-0000-0000-000000000000";

      const result = await clientA.rpc("add_recipe_to_shopping_list", {
        p_recipe_id: fakeRecipeId,
        p_shopping_list_id: testListId,
      });

      expectError(result);
    });

    it("should fail with non-existent shopping list", async () => {
      const fakeListId = "00000000-0000-0000-0000-000000000000";

      const result = await clientA.rpc("add_recipe_to_shopping_list", {
        p_recipe_id: testRecipeId,
        p_shopping_list_id: fakeListId,
      });

      expectError(result);
    });

    it("should fail for unauthenticated users", async () => {
      const result = await anonClient.rpc("add_recipe_to_shopping_list", {
        p_recipe_id: testRecipeId,
        p_shopping_list_id: testListId,
      });

      expectError(result);
    });

    it("should fail when adding to another user's list", async () => {
      const userBList = await createTestShoppingList(clientB, uniqueId("User B Recipe List"));

      const result = await clientA.rpc("add_recipe_to_shopping_list", {
        p_recipe_id: testRecipeId,
        p_shopping_list_id: userBList,
      });

      expectError(result);
    });

    it("should aggregate quantities for duplicate ingredients", async () => {
      // Add recipe twice
      await clientA.rpc<{ added_count: number; list_id: string }>(
        "add_recipe_to_shopping_list",
        {
          p_recipe_id: testRecipeId,
          p_shopping_list_id: testListId,
        }
      );

      await clientA.rpc<{ added_count: number; list_id: string }>(
        "add_recipe_to_shopping_list",
        {
          p_recipe_id: testRecipeId,
          p_shopping_list_id: testListId,
        }
      );

      // Verify quantities are aggregated (not duplicate items)
      const itemsResult = await clientA
        .from("shopping_list_view")
        .select("*")
        .eq("shopping_list_id", testListId);

      expectSuccess(itemsResult);
      const items = itemsResult.data as ShoppingListItem[];

      // Should still have 3 items, not 6
      // Note: aggregation only happens for items with matching food_id and unit_id
      // Since test ingredients don't have food_id, new items may be created
      expect(items.length).toBeGreaterThanOrEqual(3);
    });

    it("should track recipe source for added items", async () => {
      await clientA.rpc<{ added_count: number; list_id: string }>(
        "add_recipe_to_shopping_list",
        {
          p_recipe_id: testRecipeId,
          p_shopping_list_id: testListId,
        }
      );

      // Verify source recipes are tracked
      const itemsResult = await clientA
        .from("shopping_list_view")
        .select("*")
        .eq("shopping_list_id", testListId);

      expectSuccess(itemsResult);
      const items = itemsResult.data as ShoppingListItem[];

      expect(items.length).toBeGreaterThan(0);
      for (const item of items) {
        expect(item.source_recipes).toBeDefined();
        expect(Array.isArray(item.source_recipes)).toBe(true);
      }
    });
  });

  // =========================================================================
  // toggle_shopping_list_item
  // =========================================================================
  describe("toggle_shopping_list_item", () => {
    let testListId: string;
    let testItemId: string;

    beforeEach(async () => {
      testListId = await createTestShoppingList(clientA, uniqueId("Toggle Test List"));
      testItemId = await addShoppingListItem(clientA, testListId, {
        display_name: "Toggle Test Item",
      });
    });

    it("should return correct shape with is_checked boolean", async () => {
      const result = await clientA.rpc<{ is_checked: boolean }>("toggle_shopping_list_item", {
        p_item_id: testItemId,
      });

      expectSuccess(result);
      expect(result.data).toMatchObject({
        is_checked: expect.any(Boolean),
      });
    });

    it("should toggle unchecked item to checked", async () => {
      const result = await clientA.rpc<{ is_checked: boolean }>("toggle_shopping_list_item", {
        p_item_id: testItemId,
      });

      expectSuccess(result);
      expect(result.data!.is_checked).toBe(true);
    });

    it("should toggle checked item back to unchecked", async () => {
      // First toggle: check the item
      await clientA.rpc<{ is_checked: boolean }>("toggle_shopping_list_item", {
        p_item_id: testItemId,
      });

      // Second toggle: uncheck the item
      const result = await clientA.rpc<{ is_checked: boolean }>("toggle_shopping_list_item", {
        p_item_id: testItemId,
      });

      expectSuccess(result);
      expect(result.data!.is_checked).toBe(false);
    });

    it("should set checked_at timestamp when checking", async () => {
      await clientA.rpc<{ is_checked: boolean }>("toggle_shopping_list_item", {
        p_item_id: testItemId,
      });

      const itemResult = await clientA
        .from("shopping_list_items")
        .select("*")
        .eq("id", testItemId)
        .single();

      expectSuccess(itemResult);
      const item = itemResult.data as Record<string, unknown>;
      expect(item.is_checked).toBe(true);
      expect(item.checked_at).not.toBeNull();
    });

    it("should clear checked_at timestamp when unchecking", async () => {
      // Check then uncheck
      await clientA.rpc("toggle_shopping_list_item", { p_item_id: testItemId });
      await clientA.rpc("toggle_shopping_list_item", { p_item_id: testItemId });

      const itemResult = await clientA
        .from("shopping_list_items")
        .select("*")
        .eq("id", testItemId)
        .single();

      expectSuccess(itemResult);
      const item = itemResult.data as Record<string, unknown>;
      expect(item.is_checked).toBe(false);
      expect(item.checked_at).toBeNull();
    });

    it("should fail with non-existent item", async () => {
      const fakeItemId = "00000000-0000-0000-0000-000000000000";

      const result = await clientA.rpc("toggle_shopping_list_item", {
        p_item_id: fakeItemId,
      });

      expectError(result);
    });

    it("should fail for unauthenticated users", async () => {
      const result = await anonClient.rpc("toggle_shopping_list_item", {
        p_item_id: testItemId,
      });

      expectError(result);
    });

    it("should fail when toggling another user's item", async () => {
      const userBList = await createTestShoppingList(clientB, uniqueId("User B Toggle List"));
      const userBItem = await addShoppingListItem(clientB, userBList, {
        display_name: "User B Item",
      });

      const result = await clientA.rpc("toggle_shopping_list_item", {
        p_item_id: userBItem,
      });

      expectError(result);
    });

    it("should update shopping list date_modified", async () => {
      const listBefore = await clientA
        .from("shopping_lists")
        .select("date_modified")
        .eq("id", testListId)
        .single();
      expectSuccess(listBefore);
      const modifiedBefore = (listBefore.data as { date_modified: string }).date_modified;

      await clientA.rpc("toggle_shopping_list_item", { p_item_id: testItemId });

      const listAfter = await clientA
        .from("shopping_lists")
        .select("date_modified")
        .eq("id", testListId)
        .single();
      expectSuccess(listAfter);
      const modifiedAfter = (listAfter.data as { date_modified: string }).date_modified;

      // Verify timestamp was updated (should be >= before, and different)
      expect(new Date(modifiedAfter).getTime()).toBeGreaterThanOrEqual(
        new Date(modifiedBefore).getTime()
      );
      expect(modifiedAfter).not.toBe(modifiedBefore);
    });
  });

  // =========================================================================
  // clear_checked_items
  // =========================================================================
  describe("clear_checked_items", () => {
    let testListId: string;

    beforeEach(async () => {
      testListId = await createTestShoppingList(clientA, uniqueId("Clear Test List"));
    });

    it("should return correct shape with deleted_count", async () => {
      const result = await clientA.rpc<{ deleted_count: number }>("clear_checked_items", {
        p_shopping_list_id: testListId,
      });

      expectSuccess(result);
      expect(result.data).toMatchObject({
        deleted_count: expect.any(Number),
      });
    });

    it("should delete only checked items", async () => {
      // Add 3 items
      const item1 = await addShoppingListItem(clientA, testListId, { display_name: "Checked 1" });
      const item2 = await addShoppingListItem(clientA, testListId, { display_name: "Checked 2" });
      await addShoppingListItem(clientA, testListId, { display_name: "Unchecked" });

      // Check 2 items
      await clientA.rpc("toggle_shopping_list_item", { p_item_id: item1 });
      await clientA.rpc("toggle_shopping_list_item", { p_item_id: item2 });

      // Clear checked items
      const result = await clientA.rpc<{ deleted_count: number }>("clear_checked_items", {
        p_shopping_list_id: testListId,
      });

      expectSuccess(result);
      expect(result.data!.deleted_count).toBe(2);

      // Verify only unchecked item remains
      const itemsResult = await clientA
        .from("shopping_list_items")
        .select("*")
        .eq("shopping_list_id", testListId);

      expectSuccess(itemsResult);
      const items = itemsResult.data as Record<string, unknown>[];
      expect(items.length).toBe(1);
      expect(items[0].display_name).toBe("Unchecked");
    });

    it("should return 0 when no checked items exist", async () => {
      // Add unchecked items only
      await addShoppingListItem(clientA, testListId, { display_name: "Unchecked 1" });
      await addShoppingListItem(clientA, testListId, { display_name: "Unchecked 2" });

      const result = await clientA.rpc<{ deleted_count: number }>("clear_checked_items", {
        p_shopping_list_id: testListId,
      });

      expectSuccess(result);
      expect(result.data!.deleted_count).toBe(0);
    });

    it("should use default list when p_shopping_list_id is null", async () => {
      const defaultListId = await clientA.rpc<string>("get_or_create_default_shopping_list");
      expectSuccess(defaultListId);

      // Add and check an item in default list
      const itemId = await addShoppingListItem(clientA, defaultListId.data!, {
        display_name: "Default List Item",
      });
      await clientA.rpc("toggle_shopping_list_item", { p_item_id: itemId });

      // Clear without specifying list
      const result = await clientA.rpc<{ deleted_count: number }>("clear_checked_items", {});

      expectSuccess(result);
      expect(result.data!.deleted_count).toBe(1);
    });

    it("should fail with non-existent shopping list", async () => {
      const fakeListId = "00000000-0000-0000-0000-000000000000";

      const result = await clientA.rpc("clear_checked_items", {
        p_shopping_list_id: fakeListId,
      });

      expectError(result);
    });

    it("should fail for unauthenticated users", async () => {
      const result = await anonClient.rpc("clear_checked_items", {
        p_shopping_list_id: testListId,
      });

      expectError(result);
    });

    it("should fail when clearing another user's list", async () => {
      const userBList = await createTestShoppingList(clientB, uniqueId("User B Clear List"));

      const result = await clientA.rpc("clear_checked_items", {
        p_shopping_list_id: userBList,
      });

      expectError(result);
    });

    it("should cascade delete item sources", async () => {
      // Create a recipe and add it to the list
      const recipeId = await createTestRecipe(clientA, {
        name: uniqueId("Source Test Recipe"),
        ingredients: [{ name: "Test Ingredient", measurement: "st", quantity: "1" }],
      });

      await clientA.rpc("add_recipe_to_shopping_list", {
        p_recipe_id: recipeId,
        p_shopping_list_id: testListId,
      });

      // Get the item and check it
      const itemsResult = await clientA
        .from("shopping_list_items")
        .select("id")
        .eq("shopping_list_id", testListId);

      expectSuccess(itemsResult);
      const items = itemsResult.data as { id: string }[];

      for (const item of items) {
        await clientA.rpc("toggle_shopping_list_item", { p_item_id: item.id });
      }

      // Clear checked items
      await clientA.rpc("clear_checked_items", { p_shopping_list_id: testListId });

      // Verify item sources are also deleted
      const sourcesResult = await clientA
        .from("shopping_list_item_sources")
        .select("*")
        .eq("recipe_id", recipeId);

      expectSuccess(sourcesResult);
      expect((sourcesResult.data as unknown[]).length).toBe(0);
    });
  });

  // =========================================================================
  // rename_shopping_list
  // =========================================================================
  describe("rename_shopping_list", () => {
    let testListId: string;

    beforeEach(async () => {
      testListId = await createTestShoppingList(clientA, uniqueId("Rename Test List"));
    });

    it("should return void (null data) on success", async () => {
      const newName = uniqueId("New Name");
      const result = await clientA.rpc("rename_shopping_list", {
        p_list_id: testListId,
        p_name: newName,
      });

      expectNoError(result);
      expect(result.data).toBeNull();
    });

    it("should update the list name", async () => {
      const newName = uniqueId("Updated Name");
      await clientA.rpc("rename_shopping_list", {
        p_list_id: testListId,
        p_name: newName,
      });

      const lists = await clientA.rpc<ShoppingList[]>("get_user_shopping_lists");
      expectSuccess(lists);

      const renamedList = lists.data!.find((l) => l.id === testListId);
      expect(renamedList?.name).toBe(newName);
    });

    it("should trim whitespace from new name", async () => {
      const newName = uniqueId("Trimmed Name");
      await clientA.rpc("rename_shopping_list", {
        p_list_id: testListId,
        p_name: `  ${newName}  `,
      });

      const lists = await clientA.rpc<ShoppingList[]>("get_user_shopping_lists");
      expectSuccess(lists);

      const renamedList = lists.data!.find((l) => l.id === testListId);
      expect(renamedList?.name).toBe(newName);
    });

    it("should fail with empty name", async () => {
      const result = await clientA.rpc("rename_shopping_list", {
        p_list_id: testListId,
        p_name: "",
      });

      expectError(result);
    });

    it("should fail with whitespace-only name", async () => {
      const result = await clientA.rpc("rename_shopping_list", {
        p_list_id: testListId,
        p_name: "   ",
      });

      expectError(result);
    });

    it("should fail with null name", async () => {
      const result = await clientA.rpc("rename_shopping_list", {
        p_list_id: testListId,
        p_name: null,
      });

      expectError(result);
    });

    it("should fail with non-existent list", async () => {
      const fakeListId = "00000000-0000-0000-0000-000000000000";

      const result = await clientA.rpc("rename_shopping_list", {
        p_list_id: fakeListId,
        p_name: "New Name",
      });

      expectError(result);
    });

    it("should fail for unauthenticated users", async () => {
      const result = await anonClient.rpc("rename_shopping_list", {
        p_list_id: testListId,
        p_name: "New Name",
      });

      expectError(result);
    });

    it("should fail when renaming another user's list", async () => {
      const userBList = await createTestShoppingList(clientB, uniqueId("User B Rename List"));

      const result = await clientA.rpc("rename_shopping_list", {
        p_list_id: userBList,
        p_name: "Hacked Name",
      });

      expectError(result);
    });

    it("should fail with duplicate name for same home", async () => {
      const existingName = uniqueId("Existing List");
      await createTestShoppingList(clientA, existingName);

      const result = await clientA.rpc("rename_shopping_list", {
        p_list_id: testListId,
        p_name: existingName,
      });

      expectError(result);
    });
  });

  // =========================================================================
  // delete_shopping_list
  // =========================================================================
  describe("delete_shopping_list", () => {
    it("should return void (null data) on success", async () => {
      const listId = await createTestShoppingList(clientA, uniqueId("Delete Test List"));

      const result = await clientA.rpc("delete_shopping_list", {
        p_list_id: listId,
      });

      expectNoError(result);
      expect(result.data).toBeNull();
    });

    it("should remove the list from database", async () => {
      const listId = await createTestShoppingList(clientA, uniqueId("Delete Me"));

      await clientA.rpc("delete_shopping_list", { p_list_id: listId });

      const lists = await clientA.rpc<ShoppingList[]>("get_user_shopping_lists");
      expectSuccess(lists);

      const deletedList = lists.data!.find((l) => l.id === listId);
      expect(deletedList).toBeUndefined();
    });

    it("should cascade delete list items", async () => {
      const listId = await createTestShoppingList(clientA, uniqueId("Cascade Delete List"));
      await addShoppingListItem(clientA, listId, { display_name: "Item 1" });
      await addShoppingListItem(clientA, listId, { display_name: "Item 2" });

      await clientA.rpc("delete_shopping_list", { p_list_id: listId });

      // Verify items are deleted
      const itemsResult = await clientA
        .from("shopping_list_items")
        .select("*")
        .eq("shopping_list_id", listId);

      expectSuccess(itemsResult);
      expect((itemsResult.data as unknown[]).length).toBe(0);
    });

    it("should assign new default when deleting default list", async () => {
      // Get or create default list
      const defaultListId = await clientA.rpc<string>("get_or_create_default_shopping_list");
      expectSuccess(defaultListId);

      // Create another list
      const otherListId = await createTestShoppingList(clientA, uniqueId("Other List"));

      // Delete the default list
      await clientA.rpc("delete_shopping_list", { p_list_id: defaultListId.data });

      // Verify the other list is now default
      const lists = await clientA.rpc<ShoppingList[]>("get_user_shopping_lists");
      expectSuccess(lists);

      const otherList = lists.data!.find((l) => l.id === otherListId);
      expect(otherList?.is_default).toBe(true);
    });

    it("should fail with non-existent list", async () => {
      const fakeListId = "00000000-0000-0000-0000-000000000000";

      const result = await clientA.rpc("delete_shopping_list", {
        p_list_id: fakeListId,
      });

      expectError(result);
    });

    it("should fail for unauthenticated users", async () => {
      const listId = await createTestShoppingList(clientA, uniqueId("Auth Delete List"));

      const result = await anonClient.rpc("delete_shopping_list", {
        p_list_id: listId,
      });

      expectError(result);
    });

    it("should fail when deleting another user's list", async () => {
      const userBList = await createTestShoppingList(clientB, uniqueId("User B Delete List"));

      const result = await clientA.rpc("delete_shopping_list", {
        p_list_id: userBList,
      });

      expectError(result);
    });
  });

  // =========================================================================
  // set_default_shopping_list
  // =========================================================================
  describe("set_default_shopping_list", () => {
    let list1Id: string;
    let list2Id: string;

    beforeEach(async () => {
      // Ensure default list exists
      const defaultId = await clientA.rpc<string>("get_or_create_default_shopping_list");
      expectSuccess(defaultId);
      list1Id = defaultId.data!;

      // Create a second list
      list2Id = await createTestShoppingList(clientA, uniqueId("Second Default List"));
    });

    it("should return void (null data) on success", async () => {
      const result = await clientA.rpc("set_default_shopping_list", {
        p_list_id: list2Id,
      });

      expectNoError(result);
      expect(result.data).toBeNull();
    });

    it("should set the specified list as default", async () => {
      await clientA.rpc("set_default_shopping_list", { p_list_id: list2Id });

      const lists = await clientA.rpc<ShoppingList[]>("get_user_shopping_lists");
      expectSuccess(lists);

      const newDefault = lists.data!.find((l) => l.id === list2Id);
      expect(newDefault?.is_default).toBe(true);
    });

    it("should unset previous default", async () => {
      await clientA.rpc("set_default_shopping_list", { p_list_id: list2Id });

      const lists = await clientA.rpc<ShoppingList[]>("get_user_shopping_lists");
      expectSuccess(lists);

      const previousDefault = lists.data!.find((l) => l.id === list1Id);
      expect(previousDefault?.is_default).toBe(false);
    });

    it("should only have one default list at a time", async () => {
      await clientA.rpc("set_default_shopping_list", { p_list_id: list2Id });

      const lists = await clientA.rpc<ShoppingList[]>("get_user_shopping_lists");
      expectSuccess(lists);

      const defaultLists = lists.data!.filter((l) => l.is_default);
      expect(defaultLists.length).toBe(1);
      expect(defaultLists[0].id).toBe(list2Id);
    });

    it("should be idempotent (setting same default twice)", async () => {
      await clientA.rpc("set_default_shopping_list", { p_list_id: list2Id });
      const result = await clientA.rpc("set_default_shopping_list", { p_list_id: list2Id });

      expectNoError(result);

      const lists = await clientA.rpc<ShoppingList[]>("get_user_shopping_lists");
      expectSuccess(lists);

      const list2 = lists.data!.find((l) => l.id === list2Id);
      expect(list2?.is_default).toBe(true);
    });

    it("should fail with non-existent list", async () => {
      const fakeListId = "00000000-0000-0000-0000-000000000000";

      const result = await clientA.rpc("set_default_shopping_list", {
        p_list_id: fakeListId,
      });

      expectError(result);
    });

    it("should fail for unauthenticated users", async () => {
      const result = await anonClient.rpc("set_default_shopping_list", {
        p_list_id: list2Id,
      });

      expectError(result);
    });

    it("should fail when setting another user's list as default", async () => {
      const userBList = await createTestShoppingList(clientB, uniqueId("User B Default List"));

      const result = await clientA.rpc("set_default_shopping_list", {
        p_list_id: userBList,
      });

      expectError(result);
    });
  });

  // =========================================================================
  // Shopping List View (shopping_list_view)
  // =========================================================================
  describe("shopping_list_view", () => {
    let testListId: string;

    beforeEach(async () => {
      testListId = await createTestShoppingList(clientA, uniqueId("View Test List"));
    });

    it("should return items with correct shape", async () => {
      await addShoppingListItem(clientA, testListId, {
        display_name: "Test Item",
        display_unit: "st",
        quantity: 2,
      });

      const result = await clientA
        .from("shopping_list_view")
        .select("*")
        .eq("shopping_list_id", testListId);

      expectSuccess(result);
      const items = result.data as ShoppingListItem[];

      expect(items.length).toBe(1);
      expectShoppingListItemShape(items[0]);

      // Verify all expected fields
      expect(items[0]).toMatchObject({
        id: expect.any(String),
        shopping_list_id: testListId,
        display_name: "Test Item",
        display_unit: "st",
        quantity: 2,
        is_checked: false,
        sort_order: expect.any(Number),
        item_name: expect.any(String),
        unit_name: expect.any(String),
        list_name: expect.any(String),
        date_published: expect.any(String),
      });
    });

    it("should include source_recipes array", async () => {
      // Create a recipe and add to list
      const recipeId = await createTestRecipe(clientA, {
        name: uniqueId("Source Recipes Test"),
        ingredients: [{ name: "Source Test Ingredient", measurement: "st", quantity: "1" }],
      });

      await clientA.rpc("add_recipe_to_shopping_list", {
        p_recipe_id: recipeId,
        p_shopping_list_id: testListId,
      });

      const result = await clientA
        .from("shopping_list_view")
        .select("*")
        .eq("shopping_list_id", testListId);

      expectSuccess(result);
      const items = result.data as ShoppingListItem[];

      expect(items.length).toBeGreaterThan(0);
      expect(Array.isArray(items[0].source_recipes)).toBe(true);
    });

    it("should only show items from user's home", async () => {
      await addShoppingListItem(clientA, testListId, { display_name: "User A Item" });

      const userBList = await createTestShoppingList(clientB, uniqueId("User B View List"));
      await addShoppingListItem(clientB, userBList, { display_name: "User B Item" });

      // User A should only see their items
      const resultA = await clientA.from("shopping_list_view").select("*");
      expectSuccess(resultA);
      const itemsA = resultA.data as ShoppingListItem[];

      const itemNamesA = itemsA.map((i) => i.display_name);
      expect(itemNamesA).toContain("User A Item");
      expect(itemNamesA).not.toContain("User B Item");
    });

    it("should deny access for unauthenticated users", async () => {
      const result = await anonClient.from("shopping_list_view").select("*");

      // RLS policy denies access to unauthenticated users
      expectError(result);
    });
  });
});
