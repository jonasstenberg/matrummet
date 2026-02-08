/**
 * Contract tests for Recipe Pagination
 *
 * Tests the pagination API using PostgREST's:
 * - limit/offset parameters
 * - Prefer: count=exact header
 * - Content-Range response header
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  createAuthenticatedClient,
  TEST_CONFIG,
  TEST_USERS,
  setupTestHooks,
  signPostgrestToken,
} from "../setup";
import { createTestRecipe, createTestUser, uniqueId } from "../seed";

setupTestHooks();

describe("Recipe Pagination", () => {
  let userAToken: string;

  beforeAll(async () => {
    // Create test user and get token
    await createTestUser(TEST_USERS.userA);
    userAToken = await signPostgrestToken(TEST_USERS.userA.email);

    // Create authenticated client for creating recipes
    const client = await createAuthenticatedClient(TEST_USERS.userA.email);

    // Create multiple test recipes for pagination testing
    const recipePromises: Promise<string>[] = [];
    for (let i = 0; i < 5; i++) {
      recipePromises.push(
        createTestRecipe(client, {
          name: `Pagination Test Recipe ${uniqueId()}`,
        })
      );
    }
    await Promise.all(recipePromises);
  });

  describe("user_recipes view", () => {
    it("returns Content-Range header with count=exact", async () => {
      const response = await fetch(
        `${TEST_CONFIG.POSTGREST_URL}/user_recipes?select=id,name&limit=2`,
        {
          headers: {
            Authorization: `Bearer ${userAToken}`,
            Prefer: "count=exact",
          },
        }
      );

      expect(response.ok).toBe(true);

      const contentRange = response.headers.get("Content-Range");
      expect(contentRange).not.toBeNull();
      // Format: "0-1/N" where N is total count
      expect(contentRange).toMatch(/^\d+-\d+\/\d+$/);

      const data = await response.json();
      expect(data).toHaveLength(2);
    });

    it("supports offset parameter", async () => {
      // Get first page
      const firstPageResponse = await fetch(
        `${TEST_CONFIG.POSTGREST_URL}/user_recipes?select=id,name&limit=2&offset=0&order=date_published.desc`,
        {
          headers: {
            Authorization: `Bearer ${userAToken}`,
            Prefer: "count=exact",
          },
        }
      );
      const firstPage = await firstPageResponse.json();

      // Get second page
      const secondPageResponse = await fetch(
        `${TEST_CONFIG.POSTGREST_URL}/user_recipes?select=id,name&limit=2&offset=2&order=date_published.desc`,
        {
          headers: {
            Authorization: `Bearer ${userAToken}`,
            Prefer: "count=exact",
          },
        }
      );
      const secondPage = await secondPageResponse.json();

      // Pages should have different recipes
      const firstIds = firstPage.map((r: { id: string }) => r.id);
      const secondIds = secondPage.map((r: { id: string }) => r.id);

      // No overlap between pages
      const overlap = firstIds.filter((id: string) => secondIds.includes(id));
      expect(overlap).toHaveLength(0);
    });

    it("returns same total count across pages", async () => {
      const firstPageResponse = await fetch(
        `${TEST_CONFIG.POSTGREST_URL}/user_recipes?select=id&limit=2&offset=0`,
        {
          headers: {
            Authorization: `Bearer ${userAToken}`,
            Prefer: "count=exact",
          },
        }
      );
      const firstRange = firstPageResponse.headers.get("Content-Range");

      const secondPageResponse = await fetch(
        `${TEST_CONFIG.POSTGREST_URL}/user_recipes?select=id&limit=2&offset=2`,
        {
          headers: {
            Authorization: `Bearer ${userAToken}`,
            Prefer: "count=exact",
          },
        }
      );
      const secondRange = secondPageResponse.headers.get("Content-Range");

      // Extract total from Content-Range (e.g., "0-1/5" -> 5)
      const firstTotal = firstRange?.split("/")[1];
      const secondTotal = secondRange?.split("/")[1];

      expect(firstTotal).toBe(secondTotal);
    });
  });

  // public_recipes view has been removed - recipes require authentication

  describe("liked_recipes view", () => {
    beforeAll(async () => {
      // Like some recipes for testing
      const client = await createAuthenticatedClient(TEST_USERS.userA.email);
      const response = await client
        .from("user_recipes")
        .select("id")
        .limit(3);

      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        for (const recipe of response.data as { id: string }[]) {
          await client.rpc("toggle_recipe_like", { p_recipe_id: recipe.id });
        }
      }
    });

    it("returns Content-Range header with count=exact", async () => {
      const response = await fetch(
        `${TEST_CONFIG.POSTGREST_URL}/liked_recipes?select=id,name&limit=2`,
        {
          headers: {
            Authorization: `Bearer ${userAToken}`,
            Prefer: "count=exact",
          },
        }
      );

      expect(response.ok).toBe(true);

      const contentRange = response.headers.get("Content-Range");
      expect(contentRange).not.toBeNull();
    });

    it("supports offset parameter", async () => {
      // Test that the API accepts offset parameter (may return empty if not enough liked recipes)
      const response = await fetch(
        `${TEST_CONFIG.POSTGREST_URL}/liked_recipes?select=id&limit=1&offset=0&order=liked_at.desc`,
        {
          headers: {
            Authorization: `Bearer ${userAToken}`,
            Prefer: "count=exact",
          },
        }
      );

      expect(response.ok).toBe(true);

      // Verify Content-Range header is present (confirms pagination is working)
      const contentRange = response.headers.get("Content-Range");
      expect(contentRange).not.toBeNull();
    });
  });

  describe("Content-Range parsing", () => {
    it("handles empty result set", async () => {
      // Create a user with no recipes liked
      await createTestUser({
        email: "pagination-empty@test.com",
        name: "Empty User",
        password: "TestPassword123!",
      });
      const emptyUserToken = await signPostgrestToken("pagination-empty@test.com");

      const response = await fetch(
        `${TEST_CONFIG.POSTGREST_URL}/liked_recipes?select=id&limit=10`,
        {
          headers: {
            Authorization: `Bearer ${emptyUserToken}`,
            Prefer: "count=exact",
          },
        }
      );

      expect(response.ok).toBe(true);

      const contentRange = response.headers.get("Content-Range");
      // Empty results should have format "*/0"
      expect(contentRange).toMatch(/\*\/0$/);

      const data = await response.json();
      expect(data).toHaveLength(0);
    });
  });
});
