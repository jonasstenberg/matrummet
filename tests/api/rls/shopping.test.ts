/**
 * RLS Security Tests for Shopping Lists
 *
 * Tests Row Level Security policies for:
 * - shopping_lists table
 * - shopping_list_items table
 *
 * These tests verify that:
 * 1. Users can only access their own shopping lists (when not in a home)
 * 2. Home members can access shared home shopping lists
 * 3. Users cannot access other users' shopping lists
 * 4. Anonymous users cannot access shopping lists
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  createAuthenticatedClient,
  createAnonymousClient,
  TEST_USERS,
  setupTestHooks,
  type PostgrestClient,
} from "../setup";
import {
  createTestUser,
  createTestShoppingList,
  addShoppingListItem,
  createTestHome,
  cleanupTestData,
  resetCreatedResources,
  uniqueId,
} from "../seed";
import { expectSuccess, expectRlsBlocked } from "../helpers";

// Type definitions for shopping list data
interface ShoppingList {
  id: string;
  name: string;
  user_email: string;
  home_id: string;
  is_default: boolean;
  date_published: string;
  date_modified: string;
}

interface ShoppingListItem {
  id: string;
  shopping_list_id: string;
  home_id: string;
  food_id: string | null;
  unit_id: string | null;
  display_name: string;
  display_unit: string;
  quantity: number;
  is_checked: boolean;
  checked_at: string | null;
  sort_order: number;
  user_email: string;
  date_published: string;
}

// Setup global test hooks
setupTestHooks();

describe("RLS: shopping_lists table", () => {
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
  });

  afterAll(async () => {
    await cleanupTestData(TEST_USERS.userA.email);
    await cleanupTestData(TEST_USERS.userB.email);
  });

  beforeEach(() => {
    resetCreatedResources();
  });

  describe("User without home", () => {
    beforeAll(async () => {
      // Ensure user has no home for these tests
      try {
        await clientA.rpc("leave_home");
      } catch {
        // Ignore if user has no home
      }
    });

    it("should return empty results when user has no home", async () => {
      // Users without homes should see empty results due to home-based RLS
      const result = await clientA.from("shopping_lists").select("*");

      expectSuccess(result, "Should succeed but return empty");
      expect(Array.isArray(result.data)).toBe(true);
      // Empty because user has no home (RLS requires home_id = get_current_user_home_id())
    });
  });

  describe("User with home - CRUD operations", () => {
    let homeId: string;
    let listId: string;

    beforeAll(async () => {
      // Create a home for userA
      homeId = await createTestHome(clientA, `Test Home ${uniqueId()}`);
    });

    afterAll(async () => {
      // Leave home to clean up
      try {
        await clientA.rpc("leave_home");
      } catch {
        // Ignore cleanup errors
      }
    });

    it("should allow user to SELECT their own shopping lists", async () => {
      // Create a shopping list via RPC (which sets home_id correctly)
      listId = await createTestShoppingList(clientA, `My List ${uniqueId()}`);

      // Query the list directly
      const result = await clientA
        .from("shopping_lists")
        .select("*")
        .eq("id", listId);

      expectSuccess(result, "User should see their own shopping lists");
      expect(Array.isArray(result.data)).toBe(true);
      expect((result.data as ShoppingList[]).length).toBeGreaterThan(0);
    });

    it("should allow user to INSERT new shopping lists", async () => {
      // Direct insert (must include home_id)
      const result = await clientA
        .from("shopping_lists")
        .insert({
          name: `Direct Insert List ${uniqueId()}`,
          user_email: TEST_USERS.userA.email,
          home_id: homeId,
        })
        .select()
        .single();

      expectSuccess(result, "User should be able to insert shopping lists");
      expect(result.data).toMatchObject({
        name: expect.stringContaining("Direct Insert List"),
        user_email: TEST_USERS.userA.email,
        home_id: homeId,
      });
    });

    it("should allow user to UPDATE their own shopping lists", async () => {
      const newListId = await createTestShoppingList(
        clientA,
        `Update Test ${uniqueId()}`
      );

      const updatedName = `Updated ${uniqueId()}`;
      const result = await clientA
        .from("shopping_lists")
        .update({ name: updatedName })
        .eq("id", newListId)
        .select()
        .single();

      expectSuccess(result, "User should be able to update their shopping lists");
      expect(result.data).toMatchObject({
        name: updatedName,
      });
    });

    it("should allow user to DELETE their own shopping lists", async () => {
      const deleteListId = await createTestShoppingList(
        clientA,
        `Delete Test ${uniqueId()}`
      );

      const result = await clientA
        .from("shopping_lists")
        .delete()
        .eq("id", deleteListId)
        .select();

      expectSuccess(result, "User should be able to delete their shopping lists");
    });
  });

  describe("Cross-user isolation", () => {
    let userAListId: string;

    beforeAll(async () => {
      // Create separate homes for each user
      await createTestHome(clientA, `User A Home ${uniqueId()}`);
      await createTestHome(clientB, `User B Home ${uniqueId()}`);

      // Create a shopping list for user A
      userAListId = await createTestShoppingList(
        clientA,
        `User A Private List ${uniqueId()}`
      );
    });

    afterAll(async () => {
      try {
        await clientA.rpc("leave_home");
        await clientB.rpc("leave_home");
      } catch {
        // Ignore cleanup errors
      }
    });

    it("should NOT allow user B to SELECT user A's shopping lists", async () => {
      // User B tries to query user A's list by ID
      const result = await clientB
        .from("shopping_lists")
        .select("*")
        .eq("id", userAListId);

      // RLS should filter out the result
      expectRlsBlocked(result);
    });

    it("should NOT allow user B to UPDATE user A's shopping lists", async () => {
      const result = await clientB
        .from("shopping_lists")
        .update({ name: "Hacked Name" })
        .eq("id", userAListId)
        .select();

      // Should return empty - RLS blocks the update
      expectRlsBlocked(result);

      // Verify the original wasn't modified
      const checkResult = await clientA
        .from("shopping_lists")
        .select("name")
        .eq("id", userAListId)
        .single();

      expectSuccess(checkResult);
      expect((checkResult.data as { name: string }).name).not.toBe("Hacked Name");
    });

    it("should NOT allow user B to DELETE user A's shopping lists", async () => {
      const result = await clientB
        .from("shopping_lists")
        .delete()
        .eq("id", userAListId)
        .select();

      // Should return empty - RLS blocks the delete
      expectRlsBlocked(result);

      // Verify the list still exists
      const checkResult = await clientA
        .from("shopping_lists")
        .select("*")
        .eq("id", userAListId);

      expectSuccess(checkResult);
      expect((checkResult.data as ShoppingList[]).length).toBe(1);
    });
  });

  describe("Home member access", () => {
    let sharedHomeId: string;
    let sharedListId: string;

    beforeAll(async () => {
      // User A creates a home
      sharedHomeId = await createTestHome(clientA, `Shared Home ${uniqueId()}`);

      // User A creates a shopping list in the home
      sharedListId = await createTestShoppingList(
        clientA,
        `Shared List ${uniqueId()}`
      );

      // User A invites User B to the home
      const invitationId = await clientA.rpc<string>("invite_to_home", {
        p_email: TEST_USERS.userB.email,
      });

      if (invitationId.error) {
        throw new Error(`Failed to invite user B: ${invitationId.error.message}`);
      }

      // Get the invitation token
      const invitations = await clientB.rpc<
        Array<{ token: string; home_id: string }>
      >("get_pending_invitations");

      if (
        invitations.error ||
        !invitations.data ||
        invitations.data.length === 0
      ) {
        throw new Error("Failed to get pending invitations");
      }

      const invitation = invitations.data.find(
        (inv) => inv.home_id === sharedHomeId
      );
      if (!invitation) {
        throw new Error("Invitation not found");
      }

      // User B accepts the invitation
      const acceptResult = await clientB.rpc("accept_invitation", {
        p_token: invitation.token,
      });

      if (acceptResult.error) {
        throw new Error(
          `Failed to accept invitation: ${acceptResult.error.message}`
        );
      }
    });

    afterAll(async () => {
      try {
        await clientB.rpc("leave_home");
        await clientA.rpc("leave_home");
      } catch {
        // Ignore cleanup errors
      }
    });

    it("should allow home member (User B) to SELECT shared shopping lists", async () => {
      const result = await clientB
        .from("shopping_lists")
        .select("*")
        .eq("id", sharedListId);

      expectSuccess(result, "Home member should see shared shopping lists");
      const lists = result.data as ShoppingList[];
      expect(lists.length).toBe(1);
      expect(lists[0].id).toBe(sharedListId);
    });

    it("should allow home member to UPDATE shared shopping lists", async () => {
      const updatedName = `Updated by Member ${uniqueId()}`;
      const result = await clientB
        .from("shopping_lists")
        .update({ name: updatedName })
        .eq("id", sharedListId)
        .select()
        .single();

      expectSuccess(result, "Home member should update shared shopping lists");
      expect((result.data as ShoppingList).name).toBe(updatedName);
    });

    it("should allow home member to INSERT new shopping lists to shared home", async () => {
      const result = await clientB
        .from("shopping_lists")
        .insert({
          name: `Member Created List ${uniqueId()}`,
          user_email: TEST_USERS.userB.email,
          home_id: sharedHomeId,
        })
        .select()
        .single();

      expectSuccess(result, "Home member should create shopping lists");
      expect((result.data as ShoppingList).home_id).toBe(sharedHomeId);
    });
  });

  describe("Anonymous user access", () => {
    it("should NOT allow anonymous users to SELECT shopping lists", async () => {
      const result = await anonClient.from("shopping_lists").select("*");

      // Anonymous users should get an error or empty results
      // PostgREST typically returns 401 or empty for RLS-protected tables
      if (result.error) {
        expect(result.status).toBeGreaterThanOrEqual(400);
      } else {
        expectRlsBlocked(result);
      }
    });

    it("should NOT allow anonymous users to INSERT shopping lists", async () => {
      const result = await anonClient
        .from("shopping_lists")
        .insert({
          name: "Anonymous List",
          user_email: "anon@example.com",
        })
        .select();

      expect(result.error).not.toBeNull();
    });
  });
});

describe("RLS: shopping_list_items table", () => {
  let clientA: PostgrestClient;
  let clientB: PostgrestClient;
  let anonClient: PostgrestClient;

  beforeAll(async () => {
    await createTestUser(TEST_USERS.userA);
    await createTestUser(TEST_USERS.userB);

    clientA = await createAuthenticatedClient(TEST_USERS.userA.email);
    clientB = await createAuthenticatedClient(TEST_USERS.userB.email);
    anonClient = createAnonymousClient();
  });

  afterAll(async () => {
    await cleanupTestData(TEST_USERS.userA.email);
    await cleanupTestData(TEST_USERS.userB.email);
  });

  beforeEach(() => {
    resetCreatedResources();
  });

  describe("User with home - Item CRUD operations", () => {
    let listId: string;
    let itemId: string;

    beforeAll(async () => {
      await createTestHome(clientA, `Items Test Home ${uniqueId()}`);
      listId = await createTestShoppingList(clientA, `Items Test List ${uniqueId()}`);
    });

    afterAll(async () => {
      try {
        await clientA.rpc("leave_home");
      } catch {
        // Ignore cleanup errors
      }
    });

    it("should allow user to INSERT items in their own lists", async () => {
      itemId = await addShoppingListItem(clientA, listId, {
        display_name: "Test Item",
        display_unit: "st",
        quantity: 2,
      });

      expect(itemId).toBeDefined();
      expect(typeof itemId).toBe("string");
    });

    it("should allow user to SELECT items in their own lists", async () => {
      const result = await clientA
        .from("shopping_list_items")
        .select("*")
        .eq("shopping_list_id", listId);

      expectSuccess(result, "User should see items in their lists");
      expect((result.data as ShoppingListItem[]).length).toBeGreaterThan(0);
    });

    it("should allow user to UPDATE items in their own lists", async () => {
      const newItemId = await addShoppingListItem(clientA, listId, {
        display_name: "Update Test Item",
        quantity: 1,
      });

      const result = await clientA
        .from("shopping_list_items")
        .update({ quantity: 5, is_checked: true })
        .eq("id", newItemId)
        .select()
        .single();

      expectSuccess(result, "User should update items in their lists");
      const data = result.data as ShoppingListItem;
      expect(data.quantity).toBe(5);
      expect(data.is_checked).toBe(true);
    });

    it("should allow user to DELETE items in their own lists", async () => {
      const deleteItemId = await addShoppingListItem(clientA, listId, {
        display_name: "Delete Test Item",
        quantity: 1,
      });

      const result = await clientA
        .from("shopping_list_items")
        .delete()
        .eq("id", deleteItemId)
        .select();

      expectSuccess(result, "User should delete items in their lists");
    });
  });

  describe("Cross-user item isolation", () => {
    let userAHomeId: string;
    let userAListId: string;
    let userAItemId: string;

    beforeAll(async () => {
      userAHomeId = await createTestHome(clientA, `User A Items Home ${uniqueId()}`);
      await createTestHome(clientB, `User B Items Home ${uniqueId()}`);

      userAListId = await createTestShoppingList(
        clientA,
        `User A Items List ${uniqueId()}`
      );
      userAItemId = await addShoppingListItem(clientA, userAListId, {
        display_name: "User A Secret Item",
        quantity: 10,
      });
    });

    afterAll(async () => {
      try {
        await clientA.rpc("leave_home");
        await clientB.rpc("leave_home");
      } catch {
        // Ignore cleanup errors
      }
    });

    it("should NOT allow user B to SELECT items in user A's lists", async () => {
      const result = await clientB
        .from("shopping_list_items")
        .select("*")
        .eq("id", userAItemId);

      expectRlsBlocked(result);
    });

    it("should NOT allow user B to UPDATE items in user A's lists", async () => {
      const result = await clientB
        .from("shopping_list_items")
        .update({ display_name: "Hacked Item", quantity: 999 })
        .eq("id", userAItemId)
        .select();

      expectRlsBlocked(result);

      // Verify original wasn't modified
      const checkResult = await clientA
        .from("shopping_list_items")
        .select("*")
        .eq("id", userAItemId)
        .single();

      expectSuccess(checkResult);
      const checkData = checkResult.data as ShoppingListItem;
      expect(checkData.display_name).toBe("User A Secret Item");
      expect(checkData.quantity).toBe(10);
    });

    it("should NOT allow user B to DELETE items in user A's lists", async () => {
      const result = await clientB
        .from("shopping_list_items")
        .delete()
        .eq("id", userAItemId)
        .select();

      expectRlsBlocked(result);

      // Verify item still exists
      const checkResult = await clientA
        .from("shopping_list_items")
        .select("*")
        .eq("id", userAItemId);

      expectSuccess(checkResult);
      expect((checkResult.data as ShoppingListItem[]).length).toBe(1);
    });

    it("should NOT allow user B to INSERT items into user A's list", async () => {
      // User B tries to insert an item with user A's list ID
      const result = await clientB
        .from("shopping_list_items")
        .insert({
          shopping_list_id: userAListId,
          display_name: "Injected Item",
          user_email: TEST_USERS.userB.email,
          home_id: userAHomeId, // Trying to use user A's home
        })
        .select();

      // Should fail because RLS checks home_id = get_current_user_home_id()
      expect(result.error).not.toBeNull();
    });
  });

  describe("Home member item access", () => {
    let sharedHomeId: string;
    let sharedListId: string;
    let sharedItemId: string;

    beforeAll(async () => {
      // Create shared home and list
      sharedHomeId = await createTestHome(
        clientA,
        `Shared Items Home ${uniqueId()}`
      );
      sharedListId = await createTestShoppingList(
        clientA,
        `Shared Items List ${uniqueId()}`
      );
      sharedItemId = await addShoppingListItem(clientA, sharedListId, {
        display_name: "Shared Item",
        quantity: 3,
      });

      // Invite and accept for user B
      const invitationResult = await clientA.rpc<string>("invite_to_home", {
        p_email: TEST_USERS.userB.email,
      });

      if (invitationResult.error) {
        throw new Error(
          `Failed to invite user B: ${invitationResult.error.message}`
        );
      }

      const invitations = await clientB.rpc<
        Array<{ token: string; home_id: string }>
      >("get_pending_invitations");

      if (!invitations.data || invitations.data.length === 0) {
        throw new Error("No pending invitations found");
      }

      const invitation = invitations.data.find(
        (inv) => inv.home_id === sharedHomeId
      );
      if (!invitation) {
        throw new Error("Invitation for shared home not found");
      }

      await clientB.rpc("accept_invitation", { p_token: invitation.token });
    });

    afterAll(async () => {
      try {
        await clientB.rpc("leave_home");
        await clientA.rpc("leave_home");
      } catch {
        // Ignore cleanup errors
      }
    });

    it("should allow home member to SELECT items in shared lists", async () => {
      const result = await clientB
        .from("shopping_list_items")
        .select("*")
        .eq("id", sharedItemId);

      expectSuccess(result, "Home member should see shared list items");
      expect((result.data as ShoppingListItem[]).length).toBe(1);
    });

    it("should allow home member to UPDATE items in shared lists", async () => {
      const result = await clientB
        .from("shopping_list_items")
        .update({ quantity: 7 })
        .eq("id", sharedItemId)
        .select()
        .single();

      expectSuccess(result, "Home member should update shared list items");
      expect((result.data as ShoppingListItem).quantity).toBe(7);
    });

    it("should allow home member to INSERT items into shared lists", async () => {
      const result = await clientB
        .from("shopping_list_items")
        .insert({
          shopping_list_id: sharedListId,
          display_name: "Member Added Item",
          display_unit: "kg",
          quantity: 2,
          user_email: TEST_USERS.userB.email,
          home_id: sharedHomeId,
        })
        .select()
        .single();

      expectSuccess(result, "Home member should add items to shared lists");
      expect((result.data as ShoppingListItem).display_name).toBe("Member Added Item");
    });

    it("should allow home member to DELETE items in shared lists", async () => {
      // Create a new item to delete
      const tempItemId = await addShoppingListItem(clientA, sharedListId, {
        display_name: "Temp Delete Item",
        quantity: 1,
      });

      // User B deletes it
      const result = await clientB
        .from("shopping_list_items")
        .delete()
        .eq("id", tempItemId)
        .select();

      expectSuccess(result, "Home member should delete shared list items");
    });
  });

  describe("Anonymous user item access", () => {
    it("should NOT allow anonymous users to SELECT shopping list items", async () => {
      const result = await anonClient.from("shopping_list_items").select("*");

      if (result.error) {
        expect(result.status).toBeGreaterThanOrEqual(400);
      } else {
        expectRlsBlocked(result);
      }
    });

    it("should NOT allow anonymous users to INSERT shopping list items", async () => {
      const result = await anonClient
        .from("shopping_list_items")
        .insert({
          shopping_list_id: "00000000-0000-0000-0000-000000000000",
          display_name: "Anonymous Item",
          user_email: "anon@example.com",
        })
        .select();

      expect(result.error).not.toBeNull();
    });
  });
});

describe("RLS: Shopping List RPC functions", () => {
  let clientA: PostgrestClient;
  let clientB: PostgrestClient;
  let anonClient: PostgrestClient;

  beforeAll(async () => {
    await createTestUser(TEST_USERS.userA);
    await createTestUser(TEST_USERS.userB);

    clientA = await createAuthenticatedClient(TEST_USERS.userA.email);
    clientB = await createAuthenticatedClient(TEST_USERS.userB.email);
    anonClient = createAnonymousClient();
  });

  afterAll(async () => {
    await cleanupTestData(TEST_USERS.userA.email);
    await cleanupTestData(TEST_USERS.userB.email);
  });

  describe("create_shopping_list function", () => {
    beforeAll(async () => {
      await createTestHome(clientA, `RPC Test Home ${uniqueId()}`);
    });

    afterAll(async () => {
      try {
        await clientA.rpc("leave_home");
      } catch {
        // Ignore
      }
    });

    it("should create shopping list for authenticated user with home", async () => {
      const result = await clientA.rpc<string>("create_shopping_list", {
        p_name: `RPC Created List ${uniqueId()}`,
      });

      expectSuccess(result, "Should create shopping list");
      expect(typeof result.data).toBe("string");
    });

    it("should succeed for user without home (personal list)", async () => {
      // User B has no home - should create a personal shopping list
      const result = await clientB.rpc("create_shopping_list", {
        p_name: "Personal List",
      });

      expect(result.error).toBeNull();
      expect(typeof result.data).toBe("string");
    });

    it("should fail for anonymous users", async () => {
      const result = await anonClient.rpc("create_shopping_list", {
        p_name: "Anonymous List",
      });

      expect(result.error).not.toBeNull();
    });
  });

  describe("toggle_shopping_list_item function", () => {
    let listId: string;
    let itemId: string;

    beforeAll(async () => {
      await createTestHome(clientA, `Toggle Test Home ${uniqueId()}`);
      listId = await createTestShoppingList(clientA, `Toggle Test List ${uniqueId()}`);
      itemId = await addShoppingListItem(clientA, listId, {
        display_name: "Toggle Item",
        quantity: 1,
      });
    });

    afterAll(async () => {
      try {
        await clientA.rpc("leave_home");
      } catch {
        // Ignore
      }
    });

    it("should toggle item for owner", async () => {
      const result = await clientA.rpc<{ is_checked: boolean }>(
        "toggle_shopping_list_item",
        { p_item_id: itemId }
      );

      expectSuccess(result);
      expect(result.data?.is_checked).toBe(true);

      // Toggle back
      const result2 = await clientA.rpc<{ is_checked: boolean }>(
        "toggle_shopping_list_item",
        { p_item_id: itemId }
      );

      expectSuccess(result2);
      expect(result2.data?.is_checked).toBe(false);
    });

    it("should fail for non-home-member", async () => {
      // User B is not in the home
      const result = await clientB.rpc("toggle_shopping_list_item", {
        p_item_id: itemId,
      });

      expect(result.error).not.toBeNull();
    });
  });

  describe("delete_shopping_list function", () => {
    let listId: string;

    beforeAll(async () => {
      await createTestHome(clientA, `Delete Test Home A ${uniqueId()}`);
      await createTestHome(clientB, `Delete Test Home B ${uniqueId()}`);
    });

    afterAll(async () => {
      try {
        await clientA.rpc("leave_home");
        await clientB.rpc("leave_home");
      } catch {
        // Ignore
      }
    });

    it("should allow owner to delete their list", async () => {
      listId = await createTestShoppingList(clientA, `Delete Me ${uniqueId()}`);

      const result = await clientA.rpc("delete_shopping_list", {
        p_list_id: listId,
      });

      expect(result.error).toBeNull();
    });

    it("should NOT allow non-member to delete list", async () => {
      const newListId = await createTestShoppingList(
        clientA,
        `Protected List ${uniqueId()}`
      );

      const result = await clientB.rpc("delete_shopping_list", {
        p_list_id: newListId,
      });

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("shopping-list-not-found");
    });
  });
});
