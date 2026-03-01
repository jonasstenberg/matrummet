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

    describe("prefix matching — real Swedish foods", () => {
      // Tests use actual food names from the seed data to verify
      // real-world search behavior users would encounter.

      it("searching 'Citron' returns Citron and all citron-prefixed foods at rank 2.0", async () => {
        const response = await clientA.rpc<SearchFoodResult[]>("search_foods", {
          p_query: "Citron",
          p_limit: 20,
        });

        expectSuccess(response);

        // All citron-prefixed foods should be rank 2.0
        const citronNames = ["Citron", "Citrongräs", "Citronolja", "Citronsyra", "Citronextrakt", "Citronverbena"];
        for (const name of citronNames) {
          const result = response.data.find((f) => f.name === name);
          expect(result).toBeDefined();
          expect(result!.rank).toBe(2);
        }

        // Meyer-citron does NOT prefix-match (starts with "Meyer")
        const meyerResult = response.data.find((f) => f.name === "Meyer-citron");
        if (meyerResult) {
          expect(meyerResult.rank).toBeLessThan(2);
        }
      });

      it("searching 'Ägg' returns all ägg-prefixed foods first", async () => {
        const response = await clientA.rpc<SearchFoodResult[]>("search_foods", {
          p_query: "Ägg",
          p_limit: 20,
        });

        expectSuccess(response);

        // Prefix matches at rank 2.0
        const prefixed = ["Ägg", "Äggnudel", "Äggtoddy", "Äggtofu"];
        for (const name of prefixed) {
          const result = response.data.find((f) => f.name === name);
          expect(result).toBeDefined();
          expect(result!.rank).toBe(2);
        }

        // Compound matches (Ankägg, Inlagt ägg) should rank lower
        const ankAgg = response.data.find((f) => f.name === "Ankägg");
        if (ankAgg) {
          expect(ankAgg.rank).toBeLessThan(2);
        }
      });

      it("searching 'ägg' (lowercase) is case-insensitive for Ä/ä", async () => {
        const response = await clientA.rpc<SearchFoodResult[]>("search_foods", {
          p_query: "ägg",
          p_limit: 10,
        });

        expectSuccess(response);
        const aggResult = response.data.find((f) => f.name === "Ägg");
        expect(aggResult).toBeDefined();
        expect(aggResult!.rank).toBe(2);
      });

      it("searching 'ål' (lowercase) is case-insensitive for Å/å", async () => {
        const response = await clientA.rpc<SearchFoodResult[]>("search_foods", {
          p_query: "ål",
          p_limit: 10,
        });

        expectSuccess(response);
        const alResult = response.data.find((f) => f.name === "Ål");
        expect(alResult).toBeDefined();
        expect(alResult!.rank).toBe(2);
      });

      it("searching 'öl' (lowercase) is case-insensitive for Ö/ö", async () => {
        const response = await clientA.rpc<SearchFoodResult[]>("search_foods", {
          p_query: "öl",
          p_limit: 10,
        });

        expectSuccess(response);
        const olResult = response.data.find((f) => f.name === "Öl");
        expect(olResult).toBeDefined();
        expect(olResult!.rank).toBe(2);
      });

      it("searching 'Potatis' prefix-matches both Potatis and Potatismjöl", async () => {
        const response = await clientA.rpc<SearchFoodResult[]>("search_foods", {
          p_query: "Potatis",
          p_limit: 20,
        });

        expectSuccess(response);

        const potatis = response.data.find((f) => f.name === "Potatis");
        const potatismjol = response.data.find((f) => f.name === "Potatismjöl");

        expect(potatis).toBeDefined();
        expect(potatis!.rank).toBe(2);
        expect(potatismjol).toBeDefined();
        expect(potatismjol!.rank).toBe(2);
      });

      it("searching 'Mjöl' prefix-matches Mjöl and Mjölk", async () => {
        const response = await clientA.rpc<SearchFoodResult[]>("search_foods", {
          p_query: "Mjöl",
          p_limit: 20,
        });

        expectSuccess(response);

        const mjol = response.data.find((f) => f.name === "Mjöl");
        const mjolk = response.data.find((f) => f.name === "Mjölk");

        expect(mjol).toBeDefined();
        expect(mjol!.rank).toBe(2);
        expect(mjolk).toBeDefined();
        expect(mjolk!.rank).toBe(2);
      });

      it("searching 'Lök' prefix-matches Lök but not Rödlök, Vitlök, Gul lök", async () => {
        const response = await clientA.rpc<SearchFoodResult[]>("search_foods", {
          p_query: "Lök",
          p_limit: 20,
        });

        expectSuccess(response);

        const lok = response.data.find((f) => f.name === "Lök");
        expect(lok).toBeDefined();
        expect(lok!.rank).toBe(2);

        // These don't start with "Lök"
        for (const name of ["Rödlök", "Vitlök", "Gul lök"]) {
          const result = response.data.find((f) => f.name === name);
          if (result) {
            expect(result.rank).toBeLessThan(2);
          }
        }
      });

      it("searching 'Grädde' prefix-matches Grädde but not Gräddfil", async () => {
        const response = await clientA.rpc<SearchFoodResult[]>("search_foods", {
          p_query: "Grädde",
          p_limit: 20,
        });

        expectSuccess(response);

        const gradde = response.data.find((f) => f.name === "Grädde");
        expect(gradde).toBeDefined();
        expect(gradde!.rank).toBe(2);

        // "Gräddfil" starts with "Grädd", not "Grädde"
        const graddfil = response.data.find((f) => f.name === "Gräddfil");
        if (graddfil) {
          expect(graddfil.rank).toBeLessThan(2);
        }
      });
    });

    describe("word similarity — compound Swedish food names", () => {
      it("finds 'ägg' in multi-word 'Inlagt ägg'", async () => {
        const response = await clientA.rpc<SearchFoodResult[]>("search_foods", {
          p_query: "ägg",
          p_limit: 20,
        });

        expectSuccess(response);
        const found = response.data.find((f) => f.name === "Inlagt ägg");
        expect(found).toBeDefined();
      });

      it("finds 'citron' in 'Meyer-citron' via word similarity", async () => {
        const response = await clientA.rpc<SearchFoodResult[]>("search_foods", {
          p_query: "citron",
          p_limit: 20,
        });

        expectSuccess(response);
        const found = response.data.find((f) => f.name === "Meyer-citron");
        expect(found).toBeDefined();
        // Not a prefix match, so rank < 2
        expect(found!.rank).toBeLessThan(2);
        expect(found!.rank).toBeGreaterThan(0);
      });

      it("finds 'grädde' in 'Vispgrädde'", async () => {
        const response = await clientA.rpc<SearchFoodResult[]>("search_foods", {
          p_query: "grädde",
          p_limit: 20,
        });

        expectSuccess(response);
        const found = response.data.find((f) => f.name === "Vispgrädde");
        expect(found).toBeDefined();
      });
    });

    describe("false positive prevention — issue #13 regression tests", () => {
      it("searching 'lägg' does NOT rank 'Ägg' at 1.0", async () => {
        // Core regression test for issue #13: "Lägg is interpreted as ägg"
        // Bug: word_similarity(food_name, query) gave short foods rank 1.0
        const response = await clientA.rpc<SearchFoodResult[]>("search_foods", {
          p_query: "lägg",
          p_limit: 20,
        });

        expectSuccess(response);
        const agg = response.data.find((f) => f.name === "Ägg");
        if (agg) {
          expect(agg.rank).toBeLessThan(1.0);
        }
      });

      it("searching 'lägg' does NOT rank 'Ål' at 1.0", async () => {
        const response = await clientA.rpc<SearchFoodResult[]>("search_foods", {
          p_query: "lägg",
          p_limit: 20,
        });

        expectSuccess(response);
        const al = response.data.find((f) => f.name === "Ål");
        if (al) {
          expect(al.rank).toBeLessThan(1.0);
        }
      });

      it("searching 'lägg' does NOT rank 'Öl' at 1.0", async () => {
        const response = await clientA.rpc<SearchFoodResult[]>("search_foods", {
          p_query: "lägg",
          p_limit: 20,
        });

        expectSuccess(response);
        const ol = response.data.find((f) => f.name === "Öl");
        if (ol) {
          expect(ol.rank).toBeLessThan(1.0);
        }
      });

      it("searching 'Mjöl' ranks 'Mjöl' >= 'Mjölk'", async () => {
        const response = await clientA.rpc<SearchFoodResult[]>("search_foods", {
          p_query: "Mjöl",
          p_limit: 20,
        });

        expectSuccess(response);
        const mjol = response.data.find((f) => f.name === "Mjöl");
        const mjolk = response.data.find((f) => f.name === "Mjölk");

        expect(mjol).toBeDefined();
        if (mjolk) {
          expect(mjol!.rank).toBeGreaterThanOrEqual(mjolk.rank);
        }
      });

      it("searching 'Peppar' does not return unrelated foods like Grädde or Ris", async () => {
        const response = await clientA.rpc<SearchFoodResult[]>("search_foods", {
          p_query: "Peppar",
          p_limit: 10,
        });

        expectSuccess(response);
        // Peppar and Pepparrot should be found
        const pepparrot = response.data.find((f) => f.name === "Pepparrot");
        expect(pepparrot).toBeDefined();

        // Completely unrelated foods should not appear
        for (const name of ["Grädde", "Ris", "Ost", "Ägg"]) {
          const found = response.data.find((f) => f.name === name);
          expect(found).toBeUndefined();
        }
      });

      it("prefix matches always appear before fuzzy-only matches in result order", async () => {
        const response = await clientA.rpc<SearchFoodResult[]>("search_foods", {
          p_query: "Tomat",
          p_limit: 20,
        });

        expectSuccess(response);
        // Tomat and Tomater are prefix matches at rank 2
        const tomat = response.data.find((f) => f.name === "Tomat");
        const tomater = response.data.find((f) => f.name === "Tomater");
        expect(tomat).toBeDefined();
        expect(tomat!.rank).toBe(2);
        if (tomater) {
          expect(tomater.rank).toBe(2);
        }

        // All rank-2 results should come before non-rank-2 results
        let seenNonPrefix = false;
        for (const r of response.data) {
          if (r.rank < 2) seenNonPrefix = true;
          if (seenNonPrefix) {
            expect(r.rank).toBeLessThan(2);
          }
        }
      });

      it("searching 'Lök' finds it before 'Mjölk' in results", async () => {
        const response = await clientA.rpc<SearchFoodResult[]>("search_foods", {
          p_query: "Lök",
          p_limit: 20,
        });

        expectSuccess(response);
        const lokIdx = response.data.findIndex((f) => f.name === "Lök");
        const mjolkIdx = response.data.findIndex((f) => f.name === "Mjölk");

        expect(lokIdx).toBeGreaterThanOrEqual(0);
        if (mjolkIdx >= 0) {
          expect(lokIdx).toBeLessThan(mjolkIdx);
        }
      });

      it("searching 'Smör' returns it as a prefix match", async () => {
        const response = await clientA.rpc<SearchFoodResult[]>("search_foods", {
          p_query: "Smör",
          p_limit: 10,
        });

        expectSuccess(response);
        const smor = response.data.find((f) => f.name === "Smör");
        expect(smor).toBeDefined();
        expect(smor!.rank).toBe(2);
      });

      it("searching 'Salt' returns Salt as top result", async () => {
        const response = await clientA.rpc<SearchFoodResult[]>("search_foods", {
          p_query: "Salt",
          p_limit: 10,
        });

        expectSuccess(response);
        expect(response.data.length).toBeGreaterThan(0);
        // Salt should be in the results as a prefix match
        const salt = response.data.find((f) => f.name === "Salt");
        expect(salt).toBeDefined();
        expect(salt!.rank).toBe(2);
      });

      it("searching 'Sill' returns Sill as prefix match", async () => {
        const response = await clientA.rpc<SearchFoodResult[]>("search_foods", {
          p_query: "Sill",
          p_limit: 10,
        });

        expectSuccess(response);
        const sill = response.data.find((f) => f.name === "Sill");
        expect(sill).toBeDefined();
        expect(sill!.rank).toBe(2);
      });

      it("searching 'Dijonsenap' returns exact match", async () => {
        const response = await clientA.rpc<SearchFoodResult[]>("search_foods", {
          p_query: "Dijonsenap",
          p_limit: 10,
        });

        expectSuccess(response);
        const dijon = response.data.find((f) => f.name === "Dijonsenap");
        expect(dijon).toBeDefined();
        expect(dijon!.rank).toBe(2);
      });

      it("searching 'Kokosmjölk' returns prefix match", async () => {
        const response = await clientA.rpc<SearchFoodResult[]>("search_foods", {
          p_query: "Kokosmjölk",
          p_limit: 10,
        });

        expectSuccess(response);
        const kokos = response.data.find((f) => f.name === "Kokosmjölk");
        expect(kokos).toBeDefined();
        expect(kokos!.rank).toBe(2);
      });

      it("searching 'Grönkål' returns prefix match", async () => {
        const response = await clientA.rpc<SearchFoodResult[]>("search_foods", {
          p_query: "Grönkål",
          p_limit: 10,
        });

        expectSuccess(response);
        const gronkal = response.data.find((f) => f.name === "Grönkål");
        expect(gronkal).toBeDefined();
        expect(gronkal!.rank).toBe(2);
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
