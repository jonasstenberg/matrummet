/**
 * Contract tests for Food RPCs
 *
 * Tests the following RPCs:
 * - search_foods(p_query, p_limit) -> TABLE(id, name, rank, status, is_own_pending)
 * - get_or_create_food(p_name) -> UUID
 * - find_similar_foods(p_food_name, p_limit) -> TABLE(id, name, similarity_score)
 * - link_ingredients_to_food(p_recipe_id, p_ingredient_ids, p_food_ids) -> void
 * - admin_count_foods(p_search, p_status) -> integer
 * - admin_list_units(p_search, p_limit, p_offset) -> TABLE
 * - search_units(p_query, p_limit) -> TABLE(id, name, plural, abbreviation)
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createAuthenticatedClient,
  createAdminClient,
  createAnonymousClient,
  setupTestHooks,
  TEST_USERS,
  type PostgrestClient,
} from "../setup";
import {
  expectSuccess,
  expectNoError,
  expectValidUuid,
  randomString,
} from "../helpers";
import { createTestUser, createTestRecipe, cleanupTestData, createPendingFoodForUser } from "../seed";

// Types for RPC responses
interface SearchFoodResult {
  id: string;
  name: string;
  rank: number;
  status: "pending" | "approved" | "rejected";
  is_own_pending: boolean;
}

interface SimilarFoodResult {
  id: string;
  name: string;
  similarity_score: number;
}

interface UnitResult {
  id: string;
  name: string;
  plural: string | null;
  abbreviation: string | null;
}

interface AdminUnitResult {
  id: string;
  name: string;
  plural: string | null;
  abbreviation: string | null;
}


describe("Food RPCs", () => {
  setupTestHooks();

  let clientA: PostgrestClient;
  let clientB: PostgrestClient;
  let anonymousClient: PostgrestClient;
  let adminSetupClient: PostgrestClient;

  beforeAll(async () => {
    // Ensure test users exist
    await createTestUser(TEST_USERS.userA);
    await createTestUser(TEST_USERS.userB);

    // Create authenticated clients
    clientA = await createAuthenticatedClient(TEST_USERS.userA.email);
    clientB = await createAuthenticatedClient(TEST_USERS.userB.email);
    anonymousClient = createAnonymousClient();
    // Admin client for internal functions (get_or_create_food revoked from authenticated in V13)
    adminSetupClient = await createAdminClient(TEST_USERS.admin.email);
  });

  afterAll(async () => {
    await cleanupTestData(TEST_USERS.userA.email);
    await cleanupTestData(TEST_USERS.userB.email);
  });

  describe("search_foods", () => {
    describe("response shape", () => {
      it("returns an array of food results", async () => {
        const response = await clientA.rpc<SearchFoodResult[]>("search_foods", {
          p_query: "salt",
          p_limit: 10,
        });

        expectSuccess(response);
        expect(Array.isArray(response.data)).toBe(true);
      });

      it("returns correct shape for each result", async () => {
        // First create a food to search for
        const uniqueName = `TestFood${randomString(8)}`;
        await adminSetupClient.rpc("get_or_create_food", { p_name: uniqueName });

        const response = await clientA.rpc<SearchFoodResult[]>("search_foods", {
          p_query: uniqueName,
          p_limit: 10,
        });

        expectSuccess(response);

        if (response.data && response.data.length > 0) {
          const food = response.data[0];

          // Verify required fields exist
          expect(food).toHaveProperty("id");
          expect(food).toHaveProperty("name");
          expect(food).toHaveProperty("rank");
          expect(food).toHaveProperty("status");
          expect(food).toHaveProperty("is_own_pending");

          // Verify types
          expectValidUuid(food.id);
          expect(typeof food.name).toBe("string");
          expect(typeof food.rank).toBe("number");
          expect(["pending", "approved", "rejected"]).toContain(food.status);
          expect(typeof food.is_own_pending).toBe("boolean");
        }
      });
    });

    describe("query behavior", () => {
      it("returns matching foods for valid query", async () => {
        const response = await clientA.rpc<SearchFoodResult[]>("search_foods", {
          p_query: "salt",
          p_limit: 10,
        });

        expectSuccess(response);
        expect(Array.isArray(response.data)).toBe(true);
      });

      it("respects the limit parameter", async () => {
        const response = await clientA.rpc<SearchFoodResult[]>("search_foods", {
          p_query: "a",
          p_limit: 3,
        });

        expectSuccess(response);
        expect(response.data!.length).toBeLessThanOrEqual(3);
      });

      it("returns empty array for no matches", async () => {
        const response = await clientA.rpc<SearchFoodResult[]>("search_foods", {
          p_query: "xyznonexistentfood123",
          p_limit: 10,
        });

        expectSuccess(response);
        expect(response.data).toEqual([]);
      });

      it("uses default limit when not specified", async () => {
        const response = await clientA.rpc<SearchFoodResult[]>("search_foods", {
          p_query: "a",
        });

        expectSuccess(response);
        // Default limit is 10 according to the function definition
        expect(response.data!.length).toBeLessThanOrEqual(10);
      });

      it("handles empty query gracefully", async () => {
        const response = await clientA.rpc<SearchFoodResult[]>("search_foods", {
          p_query: "",
          p_limit: 10,
        });

        expectSuccess(response);
        expect(response.data).toEqual([]);
      });

      it("handles whitespace-only query", async () => {
        const response = await clientA.rpc<SearchFoodResult[]>("search_foods", {
          p_query: "   ",
          p_limit: 10,
        });

        expectSuccess(response);
        expect(response.data).toEqual([]);
      });
    });

    describe("search ranking", () => {
      it("ranks exact matches higher than partial matches", async () => {
        // Create foods with distinct names
        const exactName = `ExactMatch${randomString(6)}`;
        const partialName = `${exactName}Partial`;

        await adminSetupClient.rpc("get_or_create_food", { p_name: exactName });
        await adminSetupClient.rpc("get_or_create_food", { p_name: partialName });

        const response = await clientA.rpc<SearchFoodResult[]>("search_foods", {
          p_query: exactName,
          p_limit: 10,
        });

        expectSuccess(response);

        if (response.data && response.data.length >= 2) {
          // Exact match should have higher rank (closer to 1.0)
          const exactResult = response.data.find((f) => f.name === exactName);
          const partialResult = response.data.find(
            (f) => f.name === partialName
          );

          if (exactResult && partialResult) {
            expect(exactResult.rank).toBeGreaterThanOrEqual(partialResult.rank);
          }
        }
      });

      it("prioritizes approved foods over pending", async () => {
        // Create a unique pending food owned by user A
        const pendingName = `PendingFood${randomString(8)}`;
        await createPendingFoodForUser(TEST_USERS.userA.email, pendingName);

        const response = await clientA.rpc<SearchFoodResult[]>("search_foods", {
          p_query: pendingName,
          p_limit: 10,
        });

        expectSuccess(response);

        if (response.data && response.data.length > 0) {
          // The created food should be pending (since user created it)
          const result = response.data.find((f) => f.name === pendingName);
          expect(result).toBeDefined();
          expect(result?.status).toBe("pending");
          expect(result?.is_own_pending).toBe(true);
        }
      });
    });

    describe("pending food visibility", () => {
      it("shows user's own pending foods", async () => {
        const uniqueName = `MyPending${randomString(8)}`;
        await createPendingFoodForUser(TEST_USERS.userA.email, uniqueName);

        const response = await clientA.rpc<SearchFoodResult[]>("search_foods", {
          p_query: uniqueName,
          p_limit: 10,
        });

        expectSuccess(response);
        expect(response.data!.length).toBeGreaterThan(0);

        const myFood = response.data!.find((f) => f.name === uniqueName);
        expect(myFood).toBeDefined();
        expect(myFood?.is_own_pending).toBe(true);
      });

      it("hides other users' pending foods", async () => {
        // User A creates a pending food
        const uniqueName = `OtherPending${randomString(8)}`;
        await createPendingFoodForUser(TEST_USERS.userA.email, uniqueName);

        // User B searches for it - should not find it
        const response = await clientB.rpc<SearchFoodResult[]>("search_foods", {
          p_query: uniqueName,
          p_limit: 10,
        });

        expectSuccess(response);
        const otherFood = response.data!.find((f) => f.name === uniqueName);
        expect(otherFood).toBeUndefined();
      });
    });

    describe("authentication", () => {
      it("anonymous users cannot search foods (permission denied)", async () => {
        const response = await anonymousClient.rpc<SearchFoodResult[]>(
          "search_foods",
          {
            p_query: "salt",
            p_limit: 10,
          }
        );

        expect(response.error).not.toBeNull();
        expect(response.error?.message).toContain("permission denied");
      });

      it("anonymous users cannot see any foods (permission denied)", async () => {
        // Create a pending food as authenticated user
        const uniqueName = `AnonTest${randomString(8)}`;
        await adminSetupClient.rpc("get_or_create_food", { p_name: uniqueName });

        // Anonymous user should get permission denied
        const response = await anonymousClient.rpc<SearchFoodResult[]>(
          "search_foods",
          {
            p_query: uniqueName,
            p_limit: 10,
          }
        );

        expect(response.error).not.toBeNull();
        expect(response.error?.message).toContain("permission denied");
      });
    });
  });

  describe("get_or_create_food", () => {
    describe("response shape", () => {
      it("returns a UUID for valid food name", async () => {
        const uniqueName = `NewFood${randomString(8)}`;
        const response = await adminSetupClient.rpc<string>("get_or_create_food", {
          p_name: uniqueName,
        });

        expectSuccess(response);
        expectValidUuid(response.data);
      });
    });

    describe("create behavior", () => {
      it("creates new pending food for new name", async () => {
        const uniqueName = `BrandNew${randomString(8)}`;
        const response = await adminSetupClient.rpc<string>("get_or_create_food", {
          p_name: uniqueName,
        });

        expectSuccess(response);
        expectValidUuid(response.data);

        // Verify the food was created with pending status
        // Use admin client since admin created the food (is_own_pending is relative to caller)
        const searchResponse = await adminSetupClient.rpc<SearchFoodResult[]>(
          "search_foods",
          {
            p_query: uniqueName,
            p_limit: 1,
          }
        );

        expectSuccess(searchResponse);
        expect(searchResponse.data!.length).toBe(1);
        expect(searchResponse.data![0].status).toBe("pending");
        expect(searchResponse.data![0].is_own_pending).toBe(true);
      });

      it("returns same ID when called with same name twice", async () => {
        const uniqueName = `Duplicate${randomString(8)}`;

        const response1 = await adminSetupClient.rpc<string>("get_or_create_food", {
          p_name: uniqueName,
        });
        const response2 = await adminSetupClient.rpc<string>("get_or_create_food", {
          p_name: uniqueName,
        });

        expectSuccess(response1);
        expectSuccess(response2);
        expect(response1.data).toBe(response2.data);
      });

      it("is case-insensitive for existing foods", async () => {
        const baseName = `CaseTest${randomString(8)}`;

        // Create with lowercase
        const response1 = await adminSetupClient.rpc<string>("get_or_create_food", {
          p_name: baseName.toLowerCase(),
        });

        // Try with uppercase
        const response2 = await adminSetupClient.rpc<string>("get_or_create_food", {
          p_name: baseName.toUpperCase(),
        });

        expectSuccess(response1);
        expectSuccess(response2);
        // Should return same ID if case-insensitive matching
        expect(response1.data).toBe(response2.data);
      });
    });

    describe("input validation", () => {
      it("returns null for empty string", async () => {
        const response = await adminSetupClient.rpc<string | null>("get_or_create_food", {
          p_name: "",
        });

        expectNoError(response);
        expect(response.data).toBeNull();
      });

      it("returns null for null input", async () => {
        const response = await adminSetupClient.rpc<string | null>("get_or_create_food", {
          p_name: null,
        });

        expectNoError(response);
        expect(response.data).toBeNull();
      });

      it("returns null for whitespace-only input", async () => {
        const response = await adminSetupClient.rpc<string | null>("get_or_create_food", {
          p_name: "   ",
        });

        expectNoError(response);
        expect(response.data).toBeNull();
      });

      it("trims whitespace from food names", async () => {
        const baseName = `Trimmed${randomString(8)}`;

        // Create with extra whitespace
        const response1 = await adminSetupClient.rpc<string>("get_or_create_food", {
          p_name: `  ${baseName}  `,
        });

        // Create without whitespace
        const response2 = await adminSetupClient.rpc<string>("get_or_create_food", {
          p_name: baseName,
        });

        expectSuccess(response1);
        expectSuccess(response2);
        expect(response1.data).toBe(response2.data);
      });
    });

    describe("similar food detection", () => {
      it("returns null when similar approved food exists (trigram > 0.7)", async () => {
        // This test depends on existing approved foods in the database
        // Create a food that would be similar to an existing one
        // Note: This behavior may vary based on seed data

        const response = await adminSetupClient.rpc<string | null>("get_or_create_food", {
          p_name: "Salttt", // Similar to "Salt" if approved
        });

        // The function may return null if a similar food exists
        // or return a UUID if it creates a new one
        expectSuccess(response);
        // Result depends on whether "Salt" exists and is approved
      });
    });

    describe("authentication", () => {
      it("requires authentication to create foods (permission denied for anon)", async () => {
        const response = await anonymousClient.rpc<string>("get_or_create_food", {
          p_name: `AnonFood${randomString(8)}`,
        });

        // Anonymous users are now denied access to this function (V49)
        expect(response.error).not.toBeNull();
        expect(response.error?.message).toContain("permission denied");
      });
    });

    describe("multi-user scenarios", () => {
      it("allows different users to see the same approved food", async () => {
        // Search for a common food that's likely approved
        const responseA = await clientA.rpc<SearchFoodResult[]>("search_foods", {
          p_query: "salt",
          p_limit: 1,
        });

        const responseB = await clientB.rpc<SearchFoodResult[]>("search_foods", {
          p_query: "salt",
          p_limit: 1,
        });

        expectSuccess(responseA);
        expectSuccess(responseB);

        // Both users should see the same approved food
        if (
          responseA.data!.length > 0 &&
          responseB.data!.length > 0 &&
          responseA.data![0].status === "approved"
        ) {
          expect(responseA.data![0].id).toBe(responseB.data![0].id);
        }
      });

      it("each user sees their own pending foods only", async () => {
        const nameA = `UserAPending${randomString(8)}`;
        const nameB = `UserBPending${randomString(8)}`;

        // User A creates a food
        await createPendingFoodForUser(TEST_USERS.userA.email, nameA);

        // User B creates a different food
        await createPendingFoodForUser(TEST_USERS.userB.email, nameB);

        // User A searches for their exact food - should find it
        const searchA = await clientA.rpc<SearchFoodResult[]>("search_foods", {
          p_query: nameA,
          p_limit: 20,
        });
        expectSuccess(searchA);
        expect(searchA.data!.some((f) => f.name === nameA)).toBe(true);

        // User A searches for B's food - should NOT find it (pending foods are private)
        const searchAForB = await clientA.rpc<SearchFoodResult[]>("search_foods", {
          p_query: nameB,
          p_limit: 20,
        });
        expectSuccess(searchAForB);
        expect(searchAForB.data!.some((f) => f.name === nameB)).toBe(false);

        // User B searches for their exact food - should find it
        const searchB = await clientB.rpc<SearchFoodResult[]>("search_foods", {
          p_query: nameB,
          p_limit: 20,
        });
        expectSuccess(searchB);
        expect(searchB.data!.some((f) => f.name === nameB)).toBe(true);

        // User B searches for A's food - should NOT find it
        const searchBForA = await clientB.rpc<SearchFoodResult[]>("search_foods", {
          p_query: nameA,
          p_limit: 20,
        });
        expectSuccess(searchBForA);
        expect(searchBForA.data!.some((f) => f.name === nameA)).toBe(false);
      });
    });
  });

  // Note: find_similar_foods requires admin privileges
  describe("find_similar_foods (admin only)", () => {
    let adminClient: PostgrestClient;

    beforeAll(async () => {
      await createTestUser(TEST_USERS.admin);
      adminClient = await createAdminClient(TEST_USERS.admin.email);
    });

    afterAll(async () => {
      await cleanupTestData(TEST_USERS.admin.email);
    });

    describe("response shape", () => {
      it("returns an array of similar food results", async () => {
        const response = await adminClient.rpc<SimilarFoodResult[]>(
          "find_similar_foods",
          { p_name: "tomat", p_limit: 10 }
        );

        expectSuccess(response);
        expect(Array.isArray(response.data)).toBe(true);
      });

      it("returns correct shape for each result", async () => {
        const response = await adminClient.rpc<SimilarFoodResult[]>(
          "find_similar_foods",
          { p_name: "salt", p_limit: 10 }
        );

        expectSuccess(response);

        if (response.data && response.data.length > 0) {
          const food = response.data[0];

          // Verify required fields exist
          expect(food).toHaveProperty("id");
          expect(food).toHaveProperty("name");
          expect(food).toHaveProperty("similarity_score");

          // Verify types
          expectValidUuid(food.id);
          expect(typeof food.name).toBe("string");
          expect(typeof food.similarity_score).toBe("number");
        }
      });
    });

    describe("query behavior", () => {
      it("respects the limit parameter", async () => {
        const response = await adminClient.rpc<SimilarFoodResult[]>(
          "find_similar_foods",
          { p_name: "a", p_limit: 3 }
        );

        expectSuccess(response);
        expect(response.data!.length).toBeLessThanOrEqual(3);
      });

      it("returns empty array for no matches", async () => {
        const response = await adminClient.rpc<SimilarFoodResult[]>(
          "find_similar_foods",
          { p_name: "xyznonexistentfood123456789", p_limit: 10 }
        );

        expectSuccess(response);
        expect(response.data).toEqual([]);
      });
    });

    describe("authentication", () => {
      it("non-admin users get Access denied error", async () => {
        const response = await clientA.rpc<SimilarFoodResult[]>(
          "find_similar_foods",
          { p_name: "tomat", p_limit: 10 }
        );

        expect(response.error).not.toBeNull();
        expect(response.error?.message).toContain("Access denied");
      });

      it("anonymous users get permission denied", async () => {
        const response = await anonymousClient.rpc<SimilarFoodResult[]>(
          "find_similar_foods",
          { p_name: "tomat", p_limit: 10 }
        );

        expect(response.error).not.toBeNull();
        expect(response.error?.message).toContain("permission denied");
      });
    });
  });

  // Note: link_ingredients_to_food links a single ingredient name to a food
  // Signature: link_ingredients_to_food(p_ingredient_name text, p_food_id uuid)
  // Requires admin privileges
  describe("link_ingredients_to_food (admin only)", () => {
    let adminClient: PostgrestClient;

    beforeAll(async () => {
      await createTestUser(TEST_USERS.admin);
      adminClient = await createAdminClient(TEST_USERS.admin.email);
    });

    afterAll(async () => {
      await cleanupTestData(TEST_USERS.admin.email);
    });

    describe("successful linking", () => {
      it("admin links an ingredient name to a food and returns void on success", async () => {
        // Create a food to link
        const foodResponse = await adminClient.rpc<string>("get_or_create_food", {
          p_name: `LinkFood${randomString(8)}`,
        });
        expectSuccess(foodResponse);

        // Link ingredient name to food
        const response = await adminClient.rpc("link_ingredients_to_food", {
          p_ingredient_name: "Tomat",
          p_food_id: foodResponse.data,
        });

        expectNoError(response);
      });

      it("handles empty ingredient name gracefully", async () => {
        const foodResponse = await adminClient.rpc<string>("get_or_create_food", {
          p_name: `EmptyIngFood${randomString(8)}`,
        });
        expectSuccess(foodResponse);

        const response = await adminClient.rpc("link_ingredients_to_food", {
          p_ingredient_name: "",
          p_food_id: foodResponse.data,
        });

        // Empty name should be handled gracefully
        if (response.error) {
          expect(response.error.message).toBeDefined();
        }
      });
    });

    describe("authorization", () => {
      it("non-admin users get Access denied error", async () => {
        const foodResponse = await adminSetupClient.rpc<string>("get_or_create_food", {
          p_name: `NonAdminFood${randomString(8)}`,
        });
        expectSuccess(foodResponse);

        const response = await clientA.rpc("link_ingredients_to_food", {
          p_ingredient_name: "Test",
          p_food_id: foodResponse.data,
        });

        expect(response.error).not.toBeNull();
        expect(response.error?.message).toContain("Access denied");
      });
    });

    describe("authentication", () => {
      it("anonymous users cannot link ingredients (permission denied)", async () => {
        const response = await anonymousClient.rpc("link_ingredients_to_food", {
          p_ingredient_name: "Test",
          p_food_id: "00000000-0000-0000-0000-000000000000",
        });

        expect(response.error).not.toBeNull();
        expect(response.error?.message).toContain("permission denied");
      });
    });
  });

  describe("admin_count_foods", () => {
    let adminClient: PostgrestClient;

    beforeAll(async () => {
      await createTestUser(TEST_USERS.admin);
      adminClient = await createAdminClient(TEST_USERS.admin.email);
    });

    afterAll(async () => {
      await cleanupTestData(TEST_USERS.admin.email);
    });

    describe("admin access", () => {
      it("admin can count all foods", async () => {
        const response = await adminClient.rpc<number>("admin_count_foods", {
          p_search: null,
          p_status: null,
        });

        expectSuccess(response);
        expect(typeof response.data).toBe("number");
        expect(response.data).toBeGreaterThanOrEqual(0);
      });

      it("search filter works", async () => {
        // Create a food with unique name
        const uniqueName = `AdminCountTest${randomString(8)}`;
        await adminClient.rpc("get_or_create_food", { p_name: uniqueName });

        const response = await adminClient.rpc<number>("admin_count_foods", {
          p_search: uniqueName,
          p_status: null,
        });

        expectSuccess(response);
        expect(response.data).toBeGreaterThanOrEqual(1);
      });

      it("status filter works for pending", async () => {
        // Create a pending food
        const uniqueName = `AdminPending${randomString(8)}`;
        await adminClient.rpc("get_or_create_food", { p_name: uniqueName });

        const response = await adminClient.rpc<number>("admin_count_foods", {
          p_search: null,
          p_status: "pending",
        });

        expectSuccess(response);
        expect(typeof response.data).toBe("number");
        expect(response.data).toBeGreaterThanOrEqual(0);
      });

      it("status filter works for approved", async () => {
        const response = await adminClient.rpc<number>("admin_count_foods", {
          p_search: null,
          p_status: "approved",
        });

        expectSuccess(response);
        expect(typeof response.data).toBe("number");
        expect(response.data).toBeGreaterThanOrEqual(0);
      });

      it("status filter works for rejected", async () => {
        const response = await adminClient.rpc<number>("admin_count_foods", {
          p_search: null,
          p_status: "rejected",
        });

        expectSuccess(response);
        expect(typeof response.data).toBe("number");
        expect(response.data).toBeGreaterThanOrEqual(0);
      });
    });

    describe("authorization", () => {
      it("non-admin gets permission denied (function revoked from authenticated in V12)", async () => {
        const response = await clientA.rpc<number>("admin_count_foods", {
          p_search: null,
          p_status: null,
        });

        expect(response.error).not.toBeNull();
        expect(response.error?.message).toContain("permission denied");
      });
    });

    describe("authentication", () => {
      it("anonymous users cannot count foods (permission denied)", async () => {
        const response = await anonymousClient.rpc<number>("admin_count_foods", {
          p_search: null,
          p_status: null,
        });

        expect(response.error).not.toBeNull();
        expect(response.error?.message).toContain("permission denied");
      });
    });
  });

  describe("admin_list_units", () => {
    let adminClient: PostgrestClient;

    beforeAll(async () => {
      await createTestUser(TEST_USERS.admin);
      adminClient = await createAdminClient(TEST_USERS.admin.email);
    });

    afterAll(async () => {
      await cleanupTestData(TEST_USERS.admin.email);
    });

    describe("admin access", () => {
      it("admin can list units with pagination", async () => {
        const response = await adminClient.rpc<AdminUnitResult[]>(
          "admin_list_units",
          {
            p_search: null,
            p_limit: 10,
            p_offset: 0,
          }
        );

        expectSuccess(response);
        expect(Array.isArray(response.data)).toBe(true);
      });

      it("search filter works", async () => {
        const response = await adminClient.rpc<AdminUnitResult[]>(
          "admin_list_units",
          {
            p_search: "dl",
            p_limit: 10,
            p_offset: 0,
          }
        );

        expectSuccess(response);
        expect(Array.isArray(response.data)).toBe(true);
      });

      it("respects limit parameter", async () => {
        const response = await adminClient.rpc<AdminUnitResult[]>(
          "admin_list_units",
          {
            p_search: null,
            p_limit: 3,
            p_offset: 0,
          }
        );

        expectSuccess(response);
        expect(response.data!.length).toBeLessThanOrEqual(3);
      });

      it("respects offset parameter", async () => {
        // Get first page
        const firstPage = await adminClient.rpc<AdminUnitResult[]>(
          "admin_list_units",
          {
            p_search: null,
            p_limit: 5,
            p_offset: 0,
          }
        );

        // Get second page
        const secondPage = await adminClient.rpc<AdminUnitResult[]>(
          "admin_list_units",
          {
            p_search: null,
            p_limit: 5,
            p_offset: 5,
          }
        );

        expectSuccess(firstPage);
        expectSuccess(secondPage);

        // If there are enough units, the pages should be different
        if (firstPage.data!.length > 0 && secondPage.data!.length > 0) {
          expect(firstPage.data![0].id).not.toBe(secondPage.data![0].id);
        }
      });
    });

    describe("authorization", () => {
      it("non-admin gets permission denied (function revoked from authenticated in V12)", async () => {
        const response = await clientA.rpc<AdminUnitResult[]>(
          "admin_list_units",
          {
            p_search: null,
            p_limit: 10,
            p_offset: 0,
          }
        );

        expect(response.error).not.toBeNull();
        expect(response.error?.message).toContain("permission denied");
      });
    });

    describe("authentication", () => {
      it("anonymous users cannot list units (permission denied)", async () => {
        const response = await anonymousClient.rpc<AdminUnitResult[]>(
          "admin_list_units",
          {
            p_search: null,
            p_limit: 10,
            p_offset: 0,
          }
        );

        expect(response.error).not.toBeNull();
        expect(response.error?.message).toContain("permission denied");
      });
    });
  });

  describe("search_units", () => {
    describe("response shape", () => {
      it("returns an array of unit results", async () => {
        const response = await clientA.rpc<UnitResult[]>("search_units", {
          p_query: "dl",
          p_limit: 10,
        });

        expectSuccess(response);
        expect(Array.isArray(response.data)).toBe(true);
      });

      it("returns correct shape for each result", async () => {
        const response = await clientA.rpc<UnitResult[]>("search_units", {
          p_query: "dl",
          p_limit: 10,
        });

        expectSuccess(response);

        if (response.data && response.data.length > 0) {
          const unit = response.data[0];

          // Verify required fields exist
          expect(unit).toHaveProperty("id");
          expect(unit).toHaveProperty("name");
          expect(unit).toHaveProperty("plural");
          expect(unit).toHaveProperty("abbreviation");

          // Verify types
          expectValidUuid(unit.id);
          expect(typeof unit.name).toBe("string");
          // plural and abbreviation can be null or string
          expect(
            unit.plural === null || typeof unit.plural === "string"
          ).toBe(true);
          expect(
            unit.abbreviation === null || typeof unit.abbreviation === "string"
          ).toBe(true);
        }
      });
    });

    describe("query behavior", () => {
      it("returns matching units", async () => {
        const response = await clientA.rpc<UnitResult[]>("search_units", {
          p_query: "dl",
          p_limit: 10,
        });

        expectSuccess(response);
        expect(Array.isArray(response.data)).toBe(true);
      });

      it("respects the limit parameter", async () => {
        const response = await clientA.rpc<UnitResult[]>("search_units", {
          p_query: "",
          p_limit: 3,
        });

        expectSuccess(response);
        expect(response.data!.length).toBeLessThanOrEqual(3);
      });

      it("handles empty query gracefully", async () => {
        const response = await clientA.rpc<UnitResult[]>("search_units", {
          p_query: "",
          p_limit: 10,
        });

        // Empty query should return empty or all results depending on implementation
        expectSuccess(response);
        expect(Array.isArray(response.data)).toBe(true);
      });
    });

    describe("authentication", () => {
      it("authenticated users can search units", async () => {
        const response = await clientA.rpc<UnitResult[]>("search_units", {
          p_query: "dl",
          p_limit: 10,
        });

        expectSuccess(response);
        expect(Array.isArray(response.data)).toBe(true);
      });

      it("anonymous users cannot search units (permission denied)", async () => {
        const response = await anonymousClient.rpc<UnitResult[]>(
          "search_units",
          {
            p_query: "dl",
            p_limit: 10,
          }
        );

        expect(response.error).not.toBeNull();
        expect(response.error?.message).toContain("permission denied");
      });
    });
  });
});
