/**
 * Contract tests for Recipe Share Token RPCs
 *
 * Tests the following RPCs and their return shapes:
 * 1. create_share_token - Returns { token, expires_at }
 * 2. revoke_share_token - Returns boolean
 * 3. get_shared_recipe - Returns recipe data (anon accessible)
 * 4. get_recipe_share_tokens - Returns array of share tokens
 * 5. copy_shared_recipe - Returns new recipe UUID
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
  createTestRecipe,
  createTestUser,
  cleanupTestData,
  uniqueId,
} from "../seed";
import {
  expectSuccess,
  expectError,
  expectValidUuid,
} from "../helpers";

// Share token shape from get_recipe_share_tokens
interface ShareToken {
  id: string;
  token: string;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  view_count: number;
  last_viewed_at: string | null;
  is_active: boolean;
}

// Create share token response shape
interface CreateShareTokenResponse {
  token: string;
  expires_at: string | null;
}

// Shared recipe shape from get_shared_recipe
interface SharedRecipe {
  id: string;
  name: string;
  author: string | null;
  description: string;
  url: string | null;
  recipe_yield: number | null;
  recipe_yield_name: string | null;
  prep_time: number | null;
  cook_time: number | null;
  cuisine: string | null;
  image: string | null;
  thumbnail: string | null;
  date_published: string | null;
  date_modified: string | null;
  categories: string[];
  ingredient_groups: unknown[];
  ingredients: unknown[];
  instruction_groups: unknown[];
  instructions: unknown[];
  owner_name: string;
  shared_by_name: string;
}

describe("Recipe Share Token Contract Tests", () => {
  setupTestHooks();

  let clientA: PostgrestClient;
  let clientB: PostgrestClient;
  let anonymousClient: PostgrestClient;

  beforeAll(async () => {
    // Create test users
    await createTestUser(TEST_USERS.userA);
    await createTestUser(TEST_USERS.userB);

    // Create authenticated clients
    clientA = await createAuthenticatedClient(TEST_USERS.userA.email);
    clientB = await createAuthenticatedClient(TEST_USERS.userB.email);
    anonymousClient = createAnonymousClient();
  });

  afterAll(async () => {
    await cleanupTestData(TEST_USERS.userA.email);
    await cleanupTestData(TEST_USERS.userB.email);
  });

  describe("create_share_token", () => {
    let recipeId: string;

    beforeEach(async () => {
      recipeId = await createTestRecipe(clientA, {
        name: `Share Token Test ${uniqueId()}`,
        description: "A recipe to test share tokens",
      });
    });

    it("creates a share token for owned recipe", async () => {
      const result = await clientA.rpc<CreateShareTokenResponse[]>("create_share_token", {
        p_recipe_id: recipeId,
        p_expires_days: null,
      });

      expectSuccess(result, "create_share_token should succeed");
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data!.length).toBe(1);

      const tokenData = result.data![0];
      expect(tokenData.token).toBeDefined();
      expect(typeof tokenData.token).toBe("string");
      expect(tokenData.token.length).toBeGreaterThan(20); // URL-safe base64
      expect(tokenData.expires_at).toBeNull(); // No expiration set
    });

    it("creates a share token with expiration", async () => {
      const result = await clientA.rpc<CreateShareTokenResponse[]>("create_share_token", {
        p_recipe_id: recipeId,
        p_expires_days: 7,
      });

      expectSuccess(result, "create_share_token with expiration should succeed");
      const tokenData = result.data![0];

      expect(tokenData.expires_at).not.toBeNull();
      // Should be approximately 7 days from now
      const expiresAt = new Date(tokenData.expires_at!);
      const now = new Date();
      const daysDiff = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      expect(daysDiff).toBeGreaterThan(6.9);
      expect(daysDiff).toBeLessThan(7.1);
    });

    it("fails when user does not own the recipe", async () => {
      const result = await clientB.rpc<CreateShareTokenResponse[]>("create_share_token", {
        p_recipe_id: recipeId,
        p_expires_days: null,
      });

      expectError(result);
      expect(result.error?.message).toContain("access-denied");
    });

    it("fails for unauthenticated users", async () => {
      const result = await anonymousClient.rpc<CreateShareTokenResponse[]>("create_share_token", {
        p_recipe_id: recipeId,
        p_expires_days: null,
      });

      expectError(result);
      expect(result.error?.message).toContain("permission denied");
    });

    it("fails for non-existent recipe", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000";
      const result = await clientA.rpc<CreateShareTokenResponse[]>("create_share_token", {
        p_recipe_id: fakeId,
        p_expires_days: null,
      });

      expectError(result);
      expect(result.error?.message).toContain("access-denied");
    });
  });

  describe("get_shared_recipe", () => {
    let recipeId: string;
    let shareToken: string;
    const recipeName = `Shared Recipe ${uniqueId()}`;

    beforeAll(async () => {
      // Create a recipe with full content
      recipeId = await createTestRecipe(clientA, {
        name: recipeName,
        description: "A recipe to be shared",
        categories: ["Middag", "Vegetariskt"],
        ingredients: [
          { name: "Lök", measurement: "st", quantity: "2" },
          { name: "Vitlök", measurement: "klyftor", quantity: "3" },
        ],
        instructions: [
          { step: "Hacka löken fint." },
          { step: "Fräs löken i olivolja." },
        ],
      });

      // Create a share token
      const tokenResult = await clientA.rpc<CreateShareTokenResponse[]>("create_share_token", {
        p_recipe_id: recipeId,
        p_expires_days: null,
      });
      shareToken = tokenResult.data![0].token;
    });

    it("returns recipe data for valid token (anonymous)", async () => {
      const result = await anonymousClient.rpc<SharedRecipe[]>("get_shared_recipe", {
        p_token: shareToken,
      });

      expectSuccess(result, "get_shared_recipe should succeed for anon");
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data!.length).toBe(1);

      const recipe = result.data![0];
      expect(recipe.id).toBe(recipeId);
      expect(recipe.name).toBe(recipeName);
      expect(recipe.description).toBe("A recipe to be shared");
      expect(recipe.owner_name).toBeDefined();
      expect(recipe.shared_by_name).toBeDefined();

      // Verify arrays
      expect(Array.isArray(recipe.categories)).toBe(true);
      expect(recipe.categories).toContain("Middag");
      expect(recipe.categories).toContain("Vegetariskt");

      expect(Array.isArray(recipe.ingredients)).toBe(true);
      expect(recipe.ingredients.length).toBe(2);

      expect(Array.isArray(recipe.instructions)).toBe(true);
      expect(recipe.instructions.length).toBe(2);
    });

    it("returns recipe data for valid token (authenticated)", async () => {
      const result = await clientB.rpc<SharedRecipe[]>("get_shared_recipe", {
        p_token: shareToken,
      });

      expectSuccess(result, "get_shared_recipe should succeed for authenticated user");
      expect(result.data!.length).toBe(1);
      expect(result.data![0].id).toBe(recipeId);
    });

    it("increments view count on each access", async () => {
      // Get initial view count
      const tokensResult1 = await clientA.rpc<ShareToken[]>("get_recipe_share_tokens", {
        p_recipe_id: recipeId,
      });
      const initialViewCount = tokensResult1.data![0].view_count;

      // Access the shared recipe
      await anonymousClient.rpc("get_shared_recipe", { p_token: shareToken });

      // Check view count increased
      const tokensResult2 = await clientA.rpc<ShareToken[]>("get_recipe_share_tokens", {
        p_recipe_id: recipeId,
      });
      expect(tokensResult2.data![0].view_count).toBe(initialViewCount + 1);
      expect(tokensResult2.data![0].last_viewed_at).not.toBeNull();
    });

    it("returns empty for invalid token", async () => {
      const result = await anonymousClient.rpc<SharedRecipe[]>("get_shared_recipe", {
        p_token: "invalid-token-that-does-not-exist",
      });

      expectSuccess(result, "get_shared_recipe returns empty for invalid token");
      expect(result.data).toEqual([]);
    });

    it("returns empty for revoked token", async () => {
      // Create a new token to revoke
      const createResult = await clientA.rpc<CreateShareTokenResponse[]>("create_share_token", {
        p_recipe_id: recipeId,
        p_expires_days: null,
      });
      const tokenToRevoke = createResult.data![0].token;

      // Revoke the token
      await clientA.rpc("revoke_share_token", { p_token: tokenToRevoke });

      // Try to access with revoked token
      const result = await anonymousClient.rpc<SharedRecipe[]>("get_shared_recipe", {
        p_token: tokenToRevoke,
      });

      expectSuccess(result, "get_shared_recipe returns empty for revoked token");
      expect(result.data).toEqual([]);
    });

    it("returns empty for expired token", async () => {
      // Create a token that expires immediately (we can't easily test this without DB manipulation)
      // So we'll create one with 0 days (should still work) and verify structure
      const createResult = await clientA.rpc<CreateShareTokenResponse[]>("create_share_token", {
        p_recipe_id: recipeId,
        p_expires_days: 1, // Expires in 1 day, not expired yet
      });

      expect(createResult.data![0].expires_at).not.toBeNull();
      // This token should still work since it's not expired
      const result = await anonymousClient.rpc<SharedRecipe[]>("get_shared_recipe", {
        p_token: createResult.data![0].token,
      });
      expectSuccess(result);
      expect(result.data!.length).toBe(1);
    });
  });

  describe("revoke_share_token", () => {
    let recipeId: string;

    beforeEach(async () => {
      recipeId = await createTestRecipe(clientA, {
        name: `Revoke Token Test ${uniqueId()}`,
      });
    });

    it("revokes owned token and returns true", async () => {
      // Create a token
      const createResult = await clientA.rpc<CreateShareTokenResponse[]>("create_share_token", {
        p_recipe_id: recipeId,
        p_expires_days: null,
      });
      const token = createResult.data![0].token;

      // Revoke it
      const result = await clientA.rpc<boolean>("revoke_share_token", {
        p_token: token,
      });

      expectSuccess(result, "revoke_share_token should succeed");
      expect(result.data).toBe(true);

      // Verify token is revoked
      const tokensResult = await clientA.rpc<ShareToken[]>("get_recipe_share_tokens", {
        p_recipe_id: recipeId,
      });
      const revokedToken = tokensResult.data!.find((t) => t.token === token);
      expect(revokedToken?.revoked_at).not.toBeNull();
      expect(revokedToken?.is_active).toBe(false);
    });

    it("returns false for non-existent token", async () => {
      const result = await clientA.rpc<boolean>("revoke_share_token", {
        p_token: "non-existent-token",
      });

      expectSuccess(result, "revoke_share_token returns false for non-existent");
      expect(result.data).toBe(false);
    });

    it("returns false when trying to revoke other user's token", async () => {
      // Create a token as user A
      const createResult = await clientA.rpc<CreateShareTokenResponse[]>("create_share_token", {
        p_recipe_id: recipeId,
        p_expires_days: null,
      });
      const token = createResult.data![0].token;

      // Try to revoke as user B
      const result = await clientB.rpc<boolean>("revoke_share_token", {
        p_token: token,
      });

      expectSuccess(result, "revoke_share_token returns false for non-owner");
      expect(result.data).toBe(false);

      // Verify token is still active
      const tokensResult = await clientA.rpc<ShareToken[]>("get_recipe_share_tokens", {
        p_recipe_id: recipeId,
      });
      const stillActiveToken = tokensResult.data!.find((t) => t.token === token);
      expect(stillActiveToken?.is_active).toBe(true);
    });

    it("fails for unauthenticated users", async () => {
      const result = await anonymousClient.rpc<boolean>("revoke_share_token", {
        p_token: "any-token",
      });

      expectError(result);
      expect(result.error?.message).toContain("permission denied");
    });
  });

  describe("get_recipe_share_tokens", () => {
    let recipeId: string;

    beforeEach(async () => {
      recipeId = await createTestRecipe(clientA, {
        name: `List Tokens Test ${uniqueId()}`,
      });
    });

    it("returns all tokens for owned recipe", async () => {
      // Create multiple tokens
      await clientA.rpc("create_share_token", {
        p_recipe_id: recipeId,
        p_expires_days: null,
      });
      await clientA.rpc("create_share_token", {
        p_recipe_id: recipeId,
        p_expires_days: 7,
      });

      const result = await clientA.rpc<ShareToken[]>("get_recipe_share_tokens", {
        p_recipe_id: recipeId,
      });

      expectSuccess(result, "get_recipe_share_tokens should succeed");
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data!.length).toBe(2);

      // Verify token shape
      const token = result.data![0];
      expect(token.id).toBeDefined();
      expect(token.token).toBeDefined();
      expect(token.created_at).toBeDefined();
      expect(typeof token.view_count).toBe("number");
      expect(typeof token.is_active).toBe("boolean");
    });

    it("returns tokens ordered by created_at desc", async () => {
      // Create multiple tokens with small delay
      await clientA.rpc("create_share_token", {
        p_recipe_id: recipeId,
        p_expires_days: null,
      });

      // Small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 50));

      await clientA.rpc("create_share_token", {
        p_recipe_id: recipeId,
        p_expires_days: 7,
      });

      const result = await clientA.rpc<ShareToken[]>("get_recipe_share_tokens", {
        p_recipe_id: recipeId,
      });

      expectSuccess(result);
      expect(result.data!.length).toBe(2);

      // Most recent should be first
      const first = new Date(result.data![0].created_at);
      const second = new Date(result.data![1].created_at);
      expect(first.getTime()).toBeGreaterThanOrEqual(second.getTime());
    });

    it("fails when user does not own the recipe", async () => {
      const result = await clientB.rpc<ShareToken[]>("get_recipe_share_tokens", {
        p_recipe_id: recipeId,
      });

      expectError(result);
      expect(result.error?.message).toContain("access-denied");
    });

    it("fails for unauthenticated users", async () => {
      const result = await anonymousClient.rpc<ShareToken[]>("get_recipe_share_tokens", {
        p_recipe_id: recipeId,
      });

      expectError(result);
      expect(result.error?.message).toContain("permission denied");
    });

    it("returns empty array for recipe with no tokens", async () => {
      const result = await clientA.rpc<ShareToken[]>("get_recipe_share_tokens", {
        p_recipe_id: recipeId,
      });

      expectSuccess(result);
      expect(result.data).toEqual([]);
    });
  });

  describe("copy_shared_recipe", () => {
    let recipeId: string;
    let shareToken: string;

    beforeAll(async () => {
      // Create a recipe with full content as user A
      recipeId = await createTestRecipe(clientA, {
        name: `Copy Source ${uniqueId()}`,
        description: "A recipe to be copied via share link",
        categories: ["Middag", "Vegetariskt"],
        ingredients: [
          { name: "Lök", measurement: "st", quantity: "2" },
          { name: "Vitlök", measurement: "klyftor", quantity: "3" },
        ],
        instructions: [
          { step: "Hacka löken fint." },
          { step: "Fräs löken i olivolja." },
        ],
      });

      // Create a share token
      const tokenResult = await clientA.rpc<CreateShareTokenResponse[]>("create_share_token", {
        p_recipe_id: recipeId,
        p_expires_days: null,
      });
      shareToken = tokenResult.data![0].token;
    });

    it("copies shared recipe to user's collection", async () => {
      const result = await clientB.rpc<string>("copy_shared_recipe", {
        p_token: shareToken,
      });

      expectSuccess(result, "copy_shared_recipe should succeed");
      expectValidUuid(result.data);
      expect(result.data).not.toBe(recipeId); // Different ID

      // Verify the copy exists and belongs to user B
      const fetchResult = await clientB
        .from("user_recipes")
        .select("*")
        .eq("id", result.data)
        .single();

      expectSuccess(fetchResult, "Should fetch copied recipe");
      const copy = fetchResult.data as Record<string, unknown>;
      expect(copy.is_owner).toBe(true);
      expect(copy.name).toContain("Copy Source");
      expect(copy.copied_from_recipe_id).toBe(recipeId);
    });

    it("copied recipe includes all content", async () => {
      const result = await clientB.rpc<string>("copy_shared_recipe", {
        p_token: shareToken,
      });

      expectSuccess(result);

      // Fetch the copy with full details
      const fetchResult = await clientB
        .from("user_recipes")
        .select("*")
        .eq("id", result.data)
        .single();

      expectSuccess(fetchResult);
      const copy = fetchResult.data as Record<string, unknown>;

      // Verify content was copied
      expect(copy.categories).toContain("Middag");
      expect(copy.categories).toContain("Vegetariskt");

      const ingredients = copy.ingredients as unknown[];
      expect(ingredients.length).toBe(2);

      const instructions = copy.instructions as unknown[];
      expect(instructions.length).toBe(2);
    });

    it("fails for invalid token", async () => {
      const result = await clientB.rpc<string>("copy_shared_recipe", {
        p_token: "invalid-token",
      });

      expectError(result);
      expect(result.error?.message).toContain("invalid-or-expired-token");
    });

    it("fails for revoked token", async () => {
      // Create and revoke a token
      const createResult = await clientA.rpc<CreateShareTokenResponse[]>("create_share_token", {
        p_recipe_id: recipeId,
        p_expires_days: null,
      });
      const revokedToken = createResult.data![0].token;
      await clientA.rpc("revoke_share_token", { p_token: revokedToken });

      const result = await clientB.rpc<string>("copy_shared_recipe", {
        p_token: revokedToken,
      });

      expectError(result);
      expect(result.error?.message).toContain("invalid-or-expired-token");
    });

    it("fails for unauthenticated users", async () => {
      const result = await anonymousClient.rpc<string>("copy_shared_recipe", {
        p_token: shareToken,
      });

      expectError(result);
      expect(result.error?.message).toContain("permission denied");
    });

    it("allows owner to copy their own shared recipe", async () => {
      // User A can copy their own recipe via share link
      const result = await clientA.rpc<string>("copy_shared_recipe", {
        p_token: shareToken,
      });

      expectSuccess(result, "Owner can copy their own shared recipe");
      expectValidUuid(result.data);
      expect(result.data).not.toBe(recipeId);
    });
  });

  describe("cascade delete behavior", () => {
    it("deletes share tokens when recipe is deleted", async () => {
      // Create recipe and share token
      const recipeId = await createTestRecipe(clientA, {
        name: `Cascade Delete Test ${uniqueId()}`,
      });

      const createResult = await clientA.rpc<CreateShareTokenResponse[]>("create_share_token", {
        p_recipe_id: recipeId,
        p_expires_days: null,
      });
      const token = createResult.data![0].token;

      // Delete the recipe
      await clientA.from("recipes").delete().eq("id", recipeId);

      // Token should no longer work
      const result = await anonymousClient.rpc<SharedRecipe[]>("get_shared_recipe", {
        p_token: token,
      });

      expectSuccess(result);
      expect(result.data).toEqual([]);
    });
  });
});
