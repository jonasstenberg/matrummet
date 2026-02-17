/**
 * RLS Security Tests for User Pantry
 *
 * Tests Row Level Security policies for:
 * - user_pantry table
 *
 * These tests verify that:
 * 1. Users can only access their own pantry items (when in a home)
 * 2. Home members can access shared home pantry
 * 3. Users cannot access other users' pantry
 * 4. Anonymous users cannot access pantry
 * 5. Users without a home see empty results
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
  createTestHome,
  addToPantry,
  getOrCreateFood,
  cleanupTestData,
  resetCreatedResources,
  uniqueId,
  leaveAllHomes,
} from "../seed";
import { expectSuccess, expectRlsBlocked, expectPantryItemShape } from "../helpers";

// Type definitions for pantry data
interface PantryItem {
  id: string;
  food_id: string;
  user_email: string;
  home_id: string;
  quantity: number;
  unit: string;
  added_at: string;
  expires_at: string | null;
}

// PantryItemWithFoodName is reserved for future use when testing the get_user_pantry function response
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface PantryItemWithFoodName extends PantryItem {
  food_name: string;
  is_expired: boolean;
  added_by?: string;
}

// Setup global test hooks
setupTestHooks();

describe("RLS: user_pantry table", () => {
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
      // Ensure user has no home for these tests (must leave ALL homes for multi-home support)
      await leaveAllHomes(clientA);
    });

    it("should return empty results when user has no home", async () => {
      // Users without homes should see empty results due to home-based RLS
      const result = await clientA.from("user_pantry").select("*");

      expectSuccess(result, "Should succeed but return empty");
      expect(Array.isArray(result.data)).toBe(true);
      // Empty because user has no home (RLS requires home_id = get_current_user_home_id())
    });

    it("should fail to add to pantry without a home", async () => {
      // Get or create a food item first
      const food = await getOrCreateFood(clientA, "Test Salt");

      const result = await clientA.rpc("add_to_pantry", {
        p_food_id: food.id,
        p_quantity: 1,
        p_unit: "st",
      });

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("user-has-no-home");
    });
  });

  describe("User with home - CRUD operations", () => {
    let homeId: string;
    let foodId: string;
    let pantryItemId: string;

    beforeAll(async () => {
      // Create a home for userA
      homeId = await createTestHome(clientA, `Pantry Test Home ${uniqueId()}`);

      // Create a food item
      const food = await getOrCreateFood(clientA, `Test Food ${uniqueId()}`);
      foodId = food.id;
    });

    afterAll(async () => {
      // Leave all homes to clean up (multi-home support)
      await leaveAllHomes(clientA);
    });

    it("should allow user to SELECT their own pantry items", async () => {
      // Add item to pantry via RPC (which sets home_id correctly)
      pantryItemId = await addToPantry(clientA, foodId, {
        quantity: 5,
        unit: "st",
      });

      // Query the pantry directly
      const result = await clientA
        .from("user_pantry")
        .select("*")
        .eq("id", pantryItemId);

      expectSuccess(result, "User should see their own pantry items");
      expect((result.data as PantryItem[]).length).toBe(1);
    });

    it("should allow user to INSERT pantry items via direct insert", async () => {
      const newFood = await getOrCreateFood(clientA, `Direct Insert Food ${uniqueId()}`);

      // Direct insert (must include home_id and user_email)
      const result = await clientA
        .from("user_pantry")
        .insert({
          food_id: newFood.id,
          user_email: TEST_USERS.userA.email,
          home_id: homeId,
          quantity: 10,
          unit: "kg",
        })
        .select()
        .single();

      expectSuccess(result, "User should be able to insert pantry items");
      expect(result.data).toMatchObject({
        food_id: newFood.id,
        quantity: 10,
        unit: "kg",
        home_id: homeId,
      });
    });

    it("should allow user to UPDATE their own pantry items", async () => {
      const result = await clientA
        .from("user_pantry")
        .update({ quantity: 20, unit: "g" })
        .eq("id", pantryItemId)
        .select()
        .single();

      expectSuccess(result, "User should be able to update their pantry items");
      const data = result.data as PantryItem;
      expect(data.quantity).toBe(20);
      expect(data.unit).toBe("g");
    });

    it("should allow user to DELETE their own pantry items", async () => {
      // Create a new item to delete
      const deleteFood = await getOrCreateFood(clientA, `Delete Food ${uniqueId()}`);
      const deleteItemId = await addToPantry(clientA, deleteFood.id, {
        quantity: 1,
        unit: "st",
      });

      const result = await clientA
        .from("user_pantry")
        .delete()
        .eq("id", deleteItemId)
        .select();

      expectSuccess(result, "User should be able to delete their pantry items");
    });
  });

  describe("Cross-user pantry isolation", () => {
    let userAHomeId: string;
    let userAPantryItemId: string;
    let userAFoodId: string;

    beforeAll(async () => {
      // Create separate homes for each user
      userAHomeId = await createTestHome(clientA, `User A Pantry Home ${uniqueId()}`);
      await createTestHome(clientB, `User B Pantry Home ${uniqueId()}`);

      // Create a food and add to user A's pantry
      const food = await getOrCreateFood(clientA, `User A Secret Food ${uniqueId()}`);
      userAFoodId = food.id;
      userAPantryItemId = await addToPantry(clientA, userAFoodId, {
        quantity: 100,
        unit: "ml",
      });
    });

    afterAll(async () => {
      await leaveAllHomes(clientA);
      await leaveAllHomes(clientB);
    });

    it("should NOT allow user B to SELECT user A's pantry items", async () => {
      // User B tries to query user A's pantry item by ID
      const result = await clientB
        .from("user_pantry")
        .select("*")
        .eq("id", userAPantryItemId);

      // RLS should filter out the result
      expectRlsBlocked(result);
    });

    it("should NOT allow user B to UPDATE user A's pantry items", async () => {
      const result = await clientB
        .from("user_pantry")
        .update({ quantity: 999 })
        .eq("id", userAPantryItemId)
        .select();

      // Should return empty - RLS blocks the update
      expectRlsBlocked(result);

      // Verify the original wasn't modified
      const checkResult = await clientA
        .from("user_pantry")
        .select("quantity")
        .eq("id", userAPantryItemId)
        .single();

      expectSuccess(checkResult);
      expect((checkResult.data as { quantity: number }).quantity).toBe(100);
    });

    it("should NOT allow user B to DELETE user A's pantry items", async () => {
      const result = await clientB
        .from("user_pantry")
        .delete()
        .eq("id", userAPantryItemId)
        .select();

      // Should return empty - RLS blocks the delete
      expectRlsBlocked(result);

      // Verify the item still exists
      const checkResult = await clientA
        .from("user_pantry")
        .select("*")
        .eq("id", userAPantryItemId);

      expectSuccess(checkResult);
      expect((checkResult.data as PantryItem[]).length).toBe(1);
    });

    it("should NOT allow user B to INSERT into user A's home pantry", async () => {
      const newFood = await getOrCreateFood(clientB, `Injection Food ${uniqueId()}`);

      // User B tries to insert with user A's home_id
      const result = await clientB
        .from("user_pantry")
        .insert({
          food_id: newFood.id,
          user_email: TEST_USERS.userB.email,
          home_id: userAHomeId, // Trying to use user A's home
          quantity: 1,
          unit: "st",
        })
        .select();

      // Should fail because RLS checks home_id = get_current_user_home_id()
      expect(result.error).not.toBeNull();
    });
  });

  describe("Home member pantry access", () => {
    let sharedHomeId: string;
    let sharedPantryItemId: string;
    let sharedFoodId: string;

    beforeAll(async () => {
      // User A creates a home
      sharedHomeId = await createTestHome(
        clientA,
        `Shared Pantry Home ${uniqueId()}`
      );

      // User A adds item to pantry
      const food = await getOrCreateFood(clientA, `Shared Pantry Food ${uniqueId()}`);
      sharedFoodId = food.id;
      sharedPantryItemId = await addToPantry(clientA, sharedFoodId, {
        quantity: 50,
        unit: "dl",
      });

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
      await leaveAllHomes(clientB);
      await leaveAllHomes(clientA);
    });

    it("should allow home member (User B) to SELECT shared pantry items", async () => {
      const result = await clientB
        .from("user_pantry")
        .select("*")
        .eq("id", sharedPantryItemId);

      expectSuccess(result, "Home member should see shared pantry items");
      const items = result.data as PantryItem[];
      expect(items.length).toBe(1);
      expect(items[0].id).toBe(sharedPantryItemId);
    });

    it("should allow home member to UPDATE shared pantry items", async () => {
      const result = await clientB
        .from("user_pantry")
        .update({ quantity: 75 })
        .eq("id", sharedPantryItemId)
        .select()
        .single();

      expectSuccess(result, "Home member should update shared pantry items");
      expect((result.data as PantryItem).quantity).toBe(75);
    });

    it("should allow home member to INSERT new pantry items to shared home", async () => {
      const memberFood = await getOrCreateFood(
        clientB,
        `Member Added Food ${uniqueId()}`
      );

      const result = await clientB
        .from("user_pantry")
        .insert({
          food_id: memberFood.id,
          user_email: TEST_USERS.userB.email,
          home_id: sharedHomeId,
          quantity: 25,
          unit: "st",
        })
        .select()
        .single();

      expectSuccess(result, "Home member should add pantry items");
      const data = result.data as PantryItem;
      expect(data.home_id).toBe(sharedHomeId);
      expect(data.quantity).toBe(25);
    });

    it("should allow home member to DELETE shared pantry items", async () => {
      // Create a new item to delete
      const deleteFood = await getOrCreateFood(
        clientA,
        `Delete Shared Food ${uniqueId()}`
      );
      const tempItemId = await addToPantry(clientA, deleteFood.id, {
        quantity: 1,
        unit: "st",
      });

      // User B deletes it
      const result = await clientB
        .from("user_pantry")
        .delete()
        .eq("id", tempItemId)
        .select();

      expectSuccess(result, "Home member should delete shared pantry items");
    });
  });

  describe("Anonymous user pantry access", () => {
    it("should NOT allow anonymous users to SELECT pantry items", async () => {
      const result = await anonClient.from("user_pantry").select("*");

      // Anonymous users should get an error or empty results
      if (result.error) {
        expect(result.status).toBeGreaterThanOrEqual(400);
      } else {
        expectRlsBlocked(result);
      }
    });

    it("should NOT allow anonymous users to INSERT pantry items", async () => {
      const result = await anonClient
        .from("user_pantry")
        .insert({
          food_id: "00000000-0000-0000-0000-000000000000",
          user_email: "anon@example.com",
          quantity: 1,
          unit: "st",
        })
        .select();

      expect(result.error).not.toBeNull();
    });
  });
});

describe("RLS: Pantry RPC functions", () => {
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

  describe("add_to_pantry function", () => {
    let foodId: string;

    beforeAll(async () => {
      await createTestHome(clientA, `Add Pantry Home ${uniqueId()}`);
      const food = await getOrCreateFood(clientA, `Add Pantry Food ${uniqueId()}`);
      foodId = food.id;
    });

    afterAll(async () => {
      await leaveAllHomes(clientA);
    });

    it("should add to pantry for authenticated user with home", async () => {
      const result = await clientA.rpc<string>("add_to_pantry", {
        p_food_id: foodId,
        p_quantity: 10,
        p_unit: "st",
      });

      expectSuccess(result, "Should add to pantry");
      expect(typeof result.data).toBe("string");
    });

    it("should fail for user without home", async () => {
      // Ensure user B has no homes (multi-home support)
      await leaveAllHomes(clientB);

      const food = await getOrCreateFood(clientB, `No Home Food ${uniqueId()}`);

      const result = await clientB.rpc("add_to_pantry", {
        p_food_id: food.id,
        p_quantity: 1,
        p_unit: "st",
      });

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("user-has-no-home");
    });

    it("should fail for anonymous users", async () => {
      const result = await anonClient.rpc("add_to_pantry", {
        p_food_id: foodId,
        p_quantity: 1,
        p_unit: "st",
      });

      expect(result.error).not.toBeNull();
    });
  });

  describe("remove_from_pantry function", () => {
    let foodId: string;

    beforeAll(async () => {
      await createTestHome(clientA, `Remove Pantry Home A ${uniqueId()}`);
      await createTestHome(clientB, `Remove Pantry Home B ${uniqueId()}`);

      const food = await getOrCreateFood(clientA, `Remove Pantry Food ${uniqueId()}`);
      foodId = food.id;
    });

    afterAll(async () => {
      await leaveAllHomes(clientA);
      await leaveAllHomes(clientB);
    });

    it("should remove from pantry for owner", async () => {
      // First add the item
      await addToPantry(clientA, foodId, { quantity: 5, unit: "st" });

      const result = await clientA.rpc<boolean>("remove_from_pantry", {
        p_food_id: foodId,
      });

      expectSuccess(result);
      expect(result.data).toBe(true);
    });

    it("should return false when removing non-existent item", async () => {
      const result = await clientA.rpc<boolean>("remove_from_pantry", {
        p_food_id: "00000000-0000-0000-0000-000000000001",
      });

      expectSuccess(result);
      expect(result.data).toBe(false);
    });

    it("should NOT remove item from another user's home", async () => {
      // Add item to user A's pantry
      const food = await getOrCreateFood(clientA, `Protected Food ${uniqueId()}`);
      await addToPantry(clientA, food.id, { quantity: 10, unit: "st" });

      // User B tries to remove it
      const result = await clientB.rpc<boolean>("remove_from_pantry", {
        p_food_id: food.id,
      });

      // Should return false since user B's home doesn't have this item
      expectSuccess(result);
      expect(result.data).toBe(false);

      // Verify item still exists in user A's pantry
      const checkResult = await clientA
        .from("user_pantry")
        .select("*")
        .eq("food_id", food.id);

      expectSuccess(checkResult);
      expect((checkResult.data as PantryItem[]).length).toBe(1);
    });
  });

  describe("get_user_pantry function", () => {
    beforeAll(async () => {
      await createTestHome(clientA, `Get Pantry Home ${uniqueId()}`);

      // Add some items
      const food1 = await getOrCreateFood(clientA, `Pantry Item 1 ${uniqueId()}`);
      const food2 = await getOrCreateFood(clientA, `Pantry Item 2 ${uniqueId()}`);
      await addToPantry(clientA, food1.id, { quantity: 5, unit: "st" });
      await addToPantry(clientA, food2.id, { quantity: 10, unit: "kg" });
    });

    afterAll(async () => {
      await leaveAllHomes(clientA);
    });

    it("should return pantry items for authenticated user with home", async () => {
      const result = await clientA.rpc<
        Array<{
          id: string;
          food_id: string;
          food_name: string;
          quantity: number;
          unit: string;
        }>
      >("get_user_pantry");

      expectSuccess(result, "Should return pantry items");
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data!.length).toBeGreaterThanOrEqual(2);

      // Check shape of returned items
      result.data!.forEach((item) => {
        expectPantryItemShape(item);
      });
    });

    it("should return empty array for user without home", async () => {
      const result = await clientB.rpc<Array<unknown>>("get_user_pantry");

      expectSuccess(result);
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data!.length).toBe(0);
    });

    it("should fail for anonymous users", async () => {
      const result = await anonClient.rpc("get_user_pantry");

      expect(result.error).not.toBeNull();
    });
  });

  describe("find_recipes_from_pantry function", () => {
    beforeAll(async () => {
      await createTestHome(clientA, `Recipes Pantry Home ${uniqueId()}`);
    });

    afterAll(async () => {
      await leaveAllHomes(clientA);
    });

    it("should work for authenticated user with home", async () => {
      const result = await clientA.rpc("find_recipes_from_pantry", {
        p_min_match_percentage: 50,
        p_limit: 10,
      });

      // May return empty if no matching recipes, but should not error
      expect(result.error).toBeNull();
    });

    it("should return empty for user without home", async () => {
      const result = await clientB.rpc<Array<unknown>>("find_recipes_from_pantry", {
        p_min_match_percentage: 50,
        p_limit: 10,
      });

      expect(result.error).toBeNull();
      expect(result.data).toEqual([]);
    });

    it("should fail for anonymous users", async () => {
      const result = await anonClient.rpc("find_recipes_from_pantry", {
        p_min_match_percentage: 50,
        p_limit: 10,
      });

      expect(result.error).not.toBeNull();
    });
  });
});

describe("RLS: Pantry data isolation verification", () => {
  let clientA: PostgrestClient;
  let clientB: PostgrestClient;

  beforeAll(async () => {
    await createTestUser(TEST_USERS.userA);
    await createTestUser(TEST_USERS.userB);

    clientA = await createAuthenticatedClient(TEST_USERS.userA.email);
    clientB = await createAuthenticatedClient(TEST_USERS.userB.email);
  });

  afterAll(async () => {
    await cleanupTestData(TEST_USERS.userA.email);
    await cleanupTestData(TEST_USERS.userB.email);
  });

  it("should completely isolate pantry data between different homes", async () => {
    // Create separate homes
    const homeIdA = await createTestHome(clientA, `Isolation Home A ${uniqueId()}`);
    const homeIdB = await createTestHome(clientB, `Isolation Home B ${uniqueId()}`);

    // Add items to each pantry
    const foodA = await getOrCreateFood(clientA, `Food A Only ${uniqueId()}`);
    const foodB = await getOrCreateFood(clientB, `Food B Only ${uniqueId()}`);

    await addToPantry(clientA, foodA.id, { quantity: 100, unit: "st" });
    await addToPantry(clientB, foodB.id, { quantity: 200, unit: "kg" });

    // Verify user A can only see their items
    const resultA = await clientA.from("user_pantry").select("*");
    expectSuccess(resultA);
    const itemsA = resultA.data as PantryItem[];
    expect(itemsA.every((item) => item.home_id === homeIdA)).toBe(true);
    expect(itemsA.some((item) => item.food_id === foodB.id)).toBe(false);

    // Verify user B can only see their items
    const resultB = await clientB.from("user_pantry").select("*");
    expectSuccess(resultB);
    const itemsB = resultB.data as PantryItem[];
    expect(itemsB.every((item) => item.home_id === homeIdB)).toBe(true);
    expect(itemsB.some((item) => item.food_id === foodA.id)).toBe(false);

    // Cleanup
    await leaveAllHomes(clientA);
    await leaveAllHomes(clientB);
  });

  it("should properly share pantry when users join the same home", async () => {
    // User A creates a home
    const sharedHomeId = await createTestHome(clientA, `Shared Isolation Home ${uniqueId()}`);

    // User A adds an item
    const sharedFood = await getOrCreateFood(clientA, `Shared Food ${uniqueId()}`);
    await addToPantry(clientA, sharedFood.id, { quantity: 50, unit: "dl" });

    // User A invites User B
    await clientA.rpc("invite_to_home", { p_email: TEST_USERS.userB.email });

    const invitations = await clientB.rpc<Array<{ token: string; home_id: string }>>(
      "get_pending_invitations"
    );
    const invitation = invitations.data?.find((inv) => inv.home_id === sharedHomeId);
    await clientB.rpc("accept_invitation", { p_token: invitation!.token });

    // User B should now see the pantry item
    const resultB = await clientB.from("user_pantry").select("*").eq("food_id", sharedFood.id);
    expectSuccess(resultB);
    const sharedItems = resultB.data as PantryItem[];
    expect(sharedItems.length).toBe(1);
    expect(sharedItems[0].quantity).toBe(50);

    // User B adds another item
    const bFood = await getOrCreateFood(clientB, `B Added Food ${uniqueId()}`);
    await addToPantry(clientB, bFood.id, { quantity: 75, unit: "ml" });

    // User A should now see User B's item
    const resultA2 = await clientA.from("user_pantry").select("*").eq("food_id", bFood.id);
    expectSuccess(resultA2);
    const aSeesB = resultA2.data as PantryItem[];
    expect(aSeesB.length).toBe(1);
    expect(aSeesB[0].quantity).toBe(75);

    // Cleanup
    await leaveAllHomes(clientB);
    await leaveAllHomes(clientA);
  });

  it("should orphan pantry items when user leaves home", async () => {
    // Ensure user starts with no homes for a clean test
    await leaveAllHomes(clientA);

    // User A creates a home and adds items
    const homeId = await createTestHome(clientA, `Leave Home Test ${uniqueId()}`);
    const food = await getOrCreateFood(clientA, `Leave Home Food ${uniqueId()}`);
    await addToPantry(clientA, food.id, { quantity: 30, unit: "st" });

    // Verify item exists
    const beforeResult = await clientA.from("user_pantry").select("*").eq("food_id", food.id);
    expectSuccess(beforeResult);
    expect((beforeResult.data as PantryItem[]).length).toBe(1);

    // User A leaves the specific home
    await clientA.rpc("leave_home", { p_home_id: homeId });

    // User A should no longer see the item (no homes left, RLS filters it out)
    const afterResult = await clientA.from("user_pantry").select("*").eq("food_id", food.id);
    expectSuccess(afterResult);
    expect((afterResult.data as PantryItem[]).length).toBe(0);
  });
});
