/**
 * RLS Security Tests for Meal Plans
 *
 * Tests Row Level Security policies for:
 * - meal_plans table
 * - meal_plan_entries table
 *
 * These tests verify that:
 * 1. Users can only access their own meal plans (when not in a home)
 * 2. Home members can access shared home meal plans
 * 3. Users cannot access other users' meal plans
 * 4. Anonymous users cannot access meal plans
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
  cleanupTestData,
  resetCreatedResources,
  uniqueId,
  leaveAllHomes,
} from "../seed";
import { expectSuccess, expectRlsBlocked } from "../helpers";

// Type definitions for meal plan data
interface MealPlan {
  id: string;
  user_email: string;
  home_id: string | null;
  name: string;
  week_start: string;
  preferences: Record<string, unknown>;
  status: string;
  date_published: string;
  date_modified: string;
}

interface MealPlanEntry {
  id: string;
  meal_plan_id: string;
  day_of_week: number;
  meal_type: string;
  recipe_id: string | null;
  suggested_name: string | null;
  suggested_description: string | null;
  servings: number;
  sort_order: number;
}

// Setup global test hooks
setupTestHooks();

describe("RLS: meal_plans table", () => {
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

  describe("Owner CRUD operations", () => {
    let homeId: string;
    let planId: string;

    beforeAll(async () => {
      // Ensure clean state
      await leaveAllHomes(clientA);
      // Create a home for userA
      homeId = await createTestHome(clientA, `Test Home ${uniqueId()}`);
    });

    afterAll(async () => {
      await leaveAllHomes(clientA);
    });

    it("should allow owner to SELECT their own meal plans", async () => {
      // Create a meal plan via direct insert
      const weekStart = "2026-02-17";
      const insertResult = await clientA
        .from("meal_plans")
        .insert({
          user_email: TEST_USERS.userA.email,
          home_id: homeId,
          name: `My Plan ${uniqueId()}`,
          week_start: weekStart,
          status: "active",
        })
        .select()
        .single();

      expectSuccess(insertResult, "Owner should be able to insert meal plans");
      planId = (insertResult.data as MealPlan).id;

      // Query the plan directly
      const result = await clientA
        .from("meal_plans")
        .select("*")
        .eq("id", planId);

      expectSuccess(result, "Owner should see their own meal plans");
      expect(Array.isArray(result.data)).toBe(true);
      expect((result.data as MealPlan[]).length).toBeGreaterThan(0);
    });

    it("should allow owner to INSERT new meal plans", async () => {
      const weekStart = "2026-02-24";
      const result = await clientA
        .from("meal_plans")
        .insert({
          user_email: TEST_USERS.userA.email,
          home_id: homeId,
          name: `Direct Insert Plan ${uniqueId()}`,
          week_start: weekStart,
          status: "active",
        })
        .select()
        .single();

      expectSuccess(result, "Owner should be able to insert meal plans");
      expect(result.data).toMatchObject({
        name: expect.stringContaining("Direct Insert Plan"),
        user_email: TEST_USERS.userA.email,
        home_id: homeId,
      });
    });

    it("should allow owner to UPDATE their own meal plans", async () => {
      const weekStart = "2026-03-03";
      const insertResult = await clientA
        .from("meal_plans")
        .insert({
          user_email: TEST_USERS.userA.email,
          home_id: homeId,
          name: `Update Test ${uniqueId()}`,
          week_start: weekStart,
          status: "active",
        })
        .select()
        .single();

      expectSuccess(insertResult);
      const newPlanId = (insertResult.data as MealPlan).id;

      const updatedName = `Updated ${uniqueId()}`;
      const result = await clientA
        .from("meal_plans")
        .update({ name: updatedName })
        .eq("id", newPlanId)
        .select()
        .single();

      expectSuccess(result, "Owner should be able to update their meal plans");
      expect(result.data).toMatchObject({
        name: updatedName,
      });
    });

    it("should allow owner to DELETE their own meal plans", async () => {
      const weekStart = "2026-03-10";
      const insertResult = await clientA
        .from("meal_plans")
        .insert({
          user_email: TEST_USERS.userA.email,
          home_id: homeId,
          name: `Delete Test ${uniqueId()}`,
          week_start: weekStart,
          status: "active",
        })
        .select()
        .single();

      expectSuccess(insertResult);
      const deletePlanId = (insertResult.data as MealPlan).id;

      const result = await clientA
        .from("meal_plans")
        .delete()
        .eq("id", deletePlanId)
        .select();

      expectSuccess(result, "Owner should be able to delete their meal plans");
    });
  });

  describe("Cross-user isolation", () => {
    let userAHomeId: string;
    let userAPlanId: string;

    beforeAll(async () => {
      // Create separate homes for each user
      await leaveAllHomes(clientA);
      await leaveAllHomes(clientB);

      userAHomeId = await createTestHome(clientA, `User A Home ${uniqueId()}`);
      await createTestHome(clientB, `User B Home ${uniqueId()}`);

      // Create a meal plan for user A
      const weekStart = "2026-02-17";
      const insertResult = await clientA
        .from("meal_plans")
        .insert({
          user_email: TEST_USERS.userA.email,
          home_id: userAHomeId,
          name: `User A Private Plan ${uniqueId()}`,
          week_start: weekStart,
          status: "active",
        })
        .select()
        .single();

      expectSuccess(insertResult);
      userAPlanId = (insertResult.data as MealPlan).id;
    });

    afterAll(async () => {
      await leaveAllHomes(clientA);
      await leaveAllHomes(clientB);
    });

    it("should NOT allow user B to SELECT user A's meal plans", async () => {
      // User B tries to query user A's plan by ID
      const result = await clientB
        .from("meal_plans")
        .select("*")
        .eq("id", userAPlanId);

      // RLS should filter out the result
      expectRlsBlocked(result);
    });

    it("should NOT allow user B to UPDATE user A's meal plans", async () => {
      const result = await clientB
        .from("meal_plans")
        .update({ name: "Hacked Name" })
        .eq("id", userAPlanId)
        .select();

      // Should return empty - RLS blocks the update
      expectRlsBlocked(result);

      // Verify the original wasn't modified
      const checkResult = await clientA
        .from("meal_plans")
        .select("name")
        .eq("id", userAPlanId)
        .single();

      expectSuccess(checkResult);
      expect((checkResult.data as { name: string }).name).not.toBe("Hacked Name");
    });

    it("should NOT allow user B to DELETE user A's meal plans", async () => {
      const result = await clientB
        .from("meal_plans")
        .delete()
        .eq("id", userAPlanId)
        .select();

      // Should return empty - RLS blocks the delete
      expectRlsBlocked(result);

      // Verify the plan still exists
      const checkResult = await clientA
        .from("meal_plans")
        .select("*")
        .eq("id", userAPlanId);

      expectSuccess(checkResult);
      expect((checkResult.data as MealPlan[]).length).toBe(1);
    });
  });

  describe("Home member access", () => {
    let sharedHomeId: string;
    let sharedPlanId: string;

    beforeAll(async () => {
      // Multi-home: leave all existing homes first
      await leaveAllHomes(clientA);
      await leaveAllHomes(clientB);

      sharedHomeId = await createTestHome(clientA, `Shared Home ${uniqueId()}`);

      // User A creates a meal plan in the home
      const weekStart = "2026-02-17";
      const insertResult = await clientA
        .from("meal_plans")
        .insert({
          user_email: TEST_USERS.userA.email,
          home_id: sharedHomeId,
          name: `Shared Plan ${uniqueId()}`,
          week_start: weekStart,
          status: "active",
        })
        .select()
        .single();

      expectSuccess(insertResult);
      sharedPlanId = (insertResult.data as MealPlan).id;

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

    it("should allow home member (User B) to SELECT shared meal plans", async () => {
      const result = await clientB
        .from("meal_plans")
        .select("*")
        .eq("id", sharedPlanId);

      expectSuccess(result, "Home member should see shared meal plans");
      const plans = result.data as MealPlan[];
      expect(plans.length).toBe(1);
      expect(plans[0].id).toBe(sharedPlanId);
    });

    it("should allow home member to UPDATE shared meal plans", async () => {
      const updatedName = `Updated by Member ${uniqueId()}`;
      const result = await clientB
        .from("meal_plans")
        .update({ name: updatedName })
        .eq("id", sharedPlanId)
        .select()
        .single();

      expectSuccess(result, "Home member should update shared meal plans");
      expect((result.data as MealPlan).name).toBe(updatedName);
    });

    it("should NOT allow home member to DELETE shared meal plans", async () => {
      // RLS policy: DELETE is owner-only
      const result = await clientB
        .from("meal_plans")
        .delete()
        .eq("id", sharedPlanId)
        .select();

      // Should return empty - RLS blocks the delete
      expectRlsBlocked(result);

      // Verify the plan still exists
      const checkResult = await clientA
        .from("meal_plans")
        .select("*")
        .eq("id", sharedPlanId);

      expectSuccess(checkResult);
      expect((checkResult.data as MealPlan[]).length).toBe(1);
    });
  });

  describe("Anonymous user access", () => {
    it("should NOT allow anonymous users to SELECT meal plans", async () => {
      const result = await anonClient.from("meal_plans").select("*");

      // Anonymous users should get an error or empty results
      if (result.error) {
        expect(result.status).toBeGreaterThanOrEqual(400);
      } else {
        expectRlsBlocked(result);
      }
    });

    it("should NOT allow anonymous users to INSERT meal plans", async () => {
      const result = await anonClient
        .from("meal_plans")
        .insert({
          user_email: "anon@example.com",
          name: "Anonymous Plan",
          week_start: "2026-02-17",
        })
        .select();

      expect(result.error).not.toBeNull();
    });
  });
});

describe("RLS: meal_plan_entries table", () => {
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

  describe("Owner entry CRUD operations", () => {
    let homeId: string;
    let planId: string;

    beforeAll(async () => {
      await leaveAllHomes(clientA);
      homeId = await createTestHome(clientA, `Entries Test Home ${uniqueId()}`);

      // Create a meal plan
      const weekStart = "2026-02-17";
      const insertResult = await clientA
        .from("meal_plans")
        .insert({
          user_email: TEST_USERS.userA.email,
          home_id: homeId,
          name: `Entries Test Plan ${uniqueId()}`,
          week_start: weekStart,
          status: "active",
        })
        .select()
        .single();

      expectSuccess(insertResult);
      planId = (insertResult.data as MealPlan).id;
    });

    afterAll(async () => {
      await leaveAllHomes(clientA);
    });

    it("should allow owner to SELECT entries of their own plan", async () => {
      // Create an entry
      const entryResult = await clientA
        .from("meal_plan_entries")
        .insert({
          meal_plan_id: planId,
          day_of_week: 1,
          meal_type: "middag",
          suggested_name: "Pasta",
          servings: 4,
          sort_order: 0,
        })
        .select()
        .single();

      expectSuccess(entryResult, "Owner should insert entries to their plan");
      const entryId = (entryResult.data as MealPlanEntry).id;

      // Query the entry
      const result = await clientA
        .from("meal_plan_entries")
        .select("*")
        .eq("id", entryId);

      expectSuccess(result, "Owner should see entries of their plan");
      expect((result.data as MealPlanEntry[]).length).toBe(1);
    });

    it("should allow owner to INSERT entries to their own plan", async () => {
      const result = await clientA
        .from("meal_plan_entries")
        .insert({
          meal_plan_id: planId,
          day_of_week: 2,
          meal_type: "middag",
          suggested_name: "Pizza",
          servings: 4,
          sort_order: 0,
        })
        .select()
        .single();

      expectSuccess(result, "Owner should insert entries to their plan");
      expect(result.data).toMatchObject({
        meal_plan_id: planId,
        day_of_week: 2,
        suggested_name: "Pizza",
      });
    });

    it("should allow owner to UPDATE entries of their own plan", async () => {
      // Create an entry
      const insertResult = await clientA
        .from("meal_plan_entries")
        .insert({
          meal_plan_id: planId,
          day_of_week: 3,
          meal_type: "middag",
          suggested_name: "Original Name",
          servings: 4,
          sort_order: 0,
        })
        .select()
        .single();

      expectSuccess(insertResult);
      const entryId = (insertResult.data as MealPlanEntry).id;

      // Update the entry
      const result = await clientA
        .from("meal_plan_entries")
        .update({ suggested_name: "Updated Name", servings: 6 })
        .eq("id", entryId)
        .select()
        .single();

      expectSuccess(result, "Owner should update entries of their plan");
      const data = result.data as MealPlanEntry;
      expect(data.suggested_name).toBe("Updated Name");
      expect(data.servings).toBe(6);
    });

    it("should allow owner to DELETE entries of their own plan", async () => {
      // Create an entry
      const insertResult = await clientA
        .from("meal_plan_entries")
        .insert({
          meal_plan_id: planId,
          day_of_week: 4,
          meal_type: "middag",
          suggested_name: "To Delete",
          servings: 4,
          sort_order: 0,
        })
        .select()
        .single();

      expectSuccess(insertResult);
      const entryId = (insertResult.data as MealPlanEntry).id;

      // Delete the entry
      const result = await clientA
        .from("meal_plan_entries")
        .delete()
        .eq("id", entryId)
        .select();

      expectSuccess(result, "Owner should delete entries of their plan");
    });
  });

  describe("Cross-user entry isolation", () => {
    let userAHomeId: string;
    let userAPlanId: string;
    let userAEntryId: string;

    beforeAll(async () => {
      await leaveAllHomes(clientA);
      await leaveAllHomes(clientB);

      userAHomeId = await createTestHome(clientA, `User A Entries Home ${uniqueId()}`);
      await createTestHome(clientB, `User B Entries Home ${uniqueId()}`);

      // Create a meal plan for user A
      const weekStart = "2026-02-17";
      const planResult = await clientA
        .from("meal_plans")
        .insert({
          user_email: TEST_USERS.userA.email,
          home_id: userAHomeId,
          name: `User A Entries Plan ${uniqueId()}`,
          week_start: weekStart,
          status: "active",
        })
        .select()
        .single();

      expectSuccess(planResult);
      userAPlanId = (planResult.data as MealPlan).id;

      // Create an entry
      const entryResult = await clientA
        .from("meal_plan_entries")
        .insert({
          meal_plan_id: userAPlanId,
          day_of_week: 1,
          meal_type: "middag",
          suggested_name: "User A Secret Recipe",
          servings: 4,
          sort_order: 0,
        })
        .select()
        .single();

      expectSuccess(entryResult);
      userAEntryId = (entryResult.data as MealPlanEntry).id;
    });

    afterAll(async () => {
      await leaveAllHomes(clientA);
      await leaveAllHomes(clientB);
    });

    it("should NOT allow user B to SELECT entries in user A's plan", async () => {
      const result = await clientB
        .from("meal_plan_entries")
        .select("*")
        .eq("id", userAEntryId);

      expectRlsBlocked(result);
    });

    it("should NOT allow user B to UPDATE entries in user A's plan", async () => {
      const result = await clientB
        .from("meal_plan_entries")
        .update({ suggested_name: "Hacked Entry", servings: 999 })
        .eq("id", userAEntryId)
        .select();

      expectRlsBlocked(result);

      // Verify original wasn't modified
      const checkResult = await clientA
        .from("meal_plan_entries")
        .select("*")
        .eq("id", userAEntryId)
        .single();

      expectSuccess(checkResult);
      const checkData = checkResult.data as MealPlanEntry;
      expect(checkData.suggested_name).toBe("User A Secret Recipe");
      expect(checkData.servings).toBe(4);
    });

    it("should NOT allow user B to DELETE entries in user A's plan", async () => {
      const result = await clientB
        .from("meal_plan_entries")
        .delete()
        .eq("id", userAEntryId)
        .select();

      expectRlsBlocked(result);

      // Verify entry still exists
      const checkResult = await clientA
        .from("meal_plan_entries")
        .select("*")
        .eq("id", userAEntryId);

      expectSuccess(checkResult);
      expect((checkResult.data as MealPlanEntry[]).length).toBe(1);
    });

    it("should NOT allow user B to INSERT entries into user A's plan", async () => {
      // User B tries to insert an entry with user A's plan ID
      const result = await clientB
        .from("meal_plan_entries")
        .insert({
          meal_plan_id: userAPlanId,
          day_of_week: 5,
          meal_type: "middag",
          suggested_name: "Injected Entry",
          servings: 4,
          sort_order: 0,
        })
        .select();

      // Should fail because RLS checks parent meal_plan ownership
      expect(result.error).not.toBeNull();
    });
  });

  describe("Home member entry access", () => {
    let sharedHomeId: string;
    let sharedPlanId: string;
    let sharedEntryId: string;

    beforeAll(async () => {
      // Create shared home and plan
      await leaveAllHomes(clientA);
      await leaveAllHomes(clientB);

      sharedHomeId = await createTestHome(
        clientA,
        `Shared Entries Home ${uniqueId()}`
      );

      const weekStart = "2026-02-17";
      const planResult = await clientA
        .from("meal_plans")
        .insert({
          user_email: TEST_USERS.userA.email,
          home_id: sharedHomeId,
          name: `Shared Entries Plan ${uniqueId()}`,
          week_start: weekStart,
          status: "active",
        })
        .select()
        .single();

      expectSuccess(planResult);
      sharedPlanId = (planResult.data as MealPlan).id;

      // Create an entry
      const entryResult = await clientA
        .from("meal_plan_entries")
        .insert({
          meal_plan_id: sharedPlanId,
          day_of_week: 1,
          meal_type: "middag",
          suggested_name: "Shared Entry",
          servings: 4,
          sort_order: 0,
        })
        .select()
        .single();

      expectSuccess(entryResult);
      sharedEntryId = (entryResult.data as MealPlanEntry).id;

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
      await leaveAllHomes(clientB);
      await leaveAllHomes(clientA);
    });

    it("should allow home member to SELECT entries in shared plan", async () => {
      const result = await clientB
        .from("meal_plan_entries")
        .select("*")
        .eq("id", sharedEntryId);

      expectSuccess(result, "Home member should see shared plan entries");
      expect((result.data as MealPlanEntry[]).length).toBe(1);
    });

    it("should allow home member to UPDATE entries in shared plan", async () => {
      const result = await clientB
        .from("meal_plan_entries")
        .update({ servings: 8 })
        .eq("id", sharedEntryId)
        .select()
        .single();

      expectSuccess(result, "Home member should update shared plan entries");
      expect((result.data as MealPlanEntry).servings).toBe(8);
    });

    it("should allow home member to INSERT entries into shared plan", async () => {
      const result = await clientB
        .from("meal_plan_entries")
        .insert({
          meal_plan_id: sharedPlanId,
          day_of_week: 2,
          meal_type: "middag",
          suggested_name: "Member Added Entry",
          servings: 4,
          sort_order: 0,
        })
        .select()
        .single();

      expectSuccess(result, "Home member should add entries to shared plan");
      expect((result.data as MealPlanEntry).suggested_name).toBe("Member Added Entry");
    });

    it("should allow home member to DELETE entries in shared plan", async () => {
      // Create a new entry to delete
      const tempEntryResult = await clientA
        .from("meal_plan_entries")
        .insert({
          meal_plan_id: sharedPlanId,
          day_of_week: 3,
          meal_type: "middag",
          suggested_name: "Temp Delete Entry",
          servings: 4,
          sort_order: 0,
        })
        .select()
        .single();

      expectSuccess(tempEntryResult);
      const tempEntryId = (tempEntryResult.data as MealPlanEntry).id;

      // User B deletes it
      const result = await clientB
        .from("meal_plan_entries")
        .delete()
        .eq("id", tempEntryId)
        .select();

      expectSuccess(result, "Home member should delete shared plan entries");
    });
  });

  describe("Anonymous user entry access", () => {
    it("should NOT allow anonymous users to SELECT meal plan entries", async () => {
      const result = await anonClient.from("meal_plan_entries").select("*");

      if (result.error) {
        expect(result.status).toBeGreaterThanOrEqual(400);
      } else {
        expectRlsBlocked(result);
      }
    });

    it("should NOT allow anonymous users to INSERT meal plan entries", async () => {
      const result = await anonClient
        .from("meal_plan_entries")
        .insert({
          meal_plan_id: "00000000-0000-0000-0000-000000000000",
          day_of_week: 1,
          meal_type: "middag",
          suggested_name: "Anonymous Entry",
          servings: 4,
        })
        .select();

      expect(result.error).not.toBeNull();
    });
  });
});
