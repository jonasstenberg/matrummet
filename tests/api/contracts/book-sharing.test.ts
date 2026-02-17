/**
 * Contract tests for Book Sharing RPCs
 *
 * Tests the following RPCs and their return shapes:
 * 1. create_book_share_token - Returns { token, expires_at }
 * 2. get_book_share_info - Returns sharer info (anon accessible)
 * 3. accept_book_share - Creates connection, returns { sharer_name, sharer_id }
 * 4. get_shared_books - Returns connections where user is recipient
 * 5. revoke_book_share_token - Returns boolean
 * 6. remove_book_share_connection - Returns boolean
 * 7. RLS: recipient can see sharer's recipes via has_book_share_from
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
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

interface CreateBookShareTokenResponse {
  token: string;
  expires_at: string | null;
}

interface BookShareInfo {
  sharer_name: string;
  sharer_email: string;
  recipe_count: number;
  already_connected: boolean;
}

interface AcceptBookShareResponse {
  sharer_name: string;
  sharer_id: string;
}

interface SharedBook {
  id: string;
  sharer_name: string;
  sharer_id: string;
  created_at: string;
}

describe("Book Sharing Contract Tests", () => {
  setupTestHooks();

  let clientA: PostgrestClient;
  let clientB: PostgrestClient;
  let anonymousClient: PostgrestClient;

  beforeAll(async () => {
    await createTestUser(TEST_USERS.userA);
    await createTestUser(TEST_USERS.userB);

    clientA = await createAuthenticatedClient(TEST_USERS.userA.email);
    clientB = await createAuthenticatedClient(TEST_USERS.userB.email);
    anonymousClient = createAnonymousClient();
  });

  afterAll(async () => {
    // Clean up any book share connections between test users
    const sharedBooks = await clientB.rpc<SharedBook[]>("get_shared_books");
    if (!sharedBooks.error && sharedBooks.data) {
      for (const book of sharedBooks.data) {
        await clientB.rpc("remove_book_share_connection", { p_connection_id: book.id });
      }
    }

    await cleanupTestData(TEST_USERS.userA.email);
    await cleanupTestData(TEST_USERS.userB.email);
  });

  describe("create_book_share_token", () => {
    it("creates a token without expiration", async () => {
      const result = await clientA.rpc<CreateBookShareTokenResponse[]>("create_book_share_token", {
        p_expires_days: null,
      });

      expectSuccess(result, "create_book_share_token should succeed");
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data!.length).toBe(1);

      const tokenData = result.data![0];
      expect(tokenData.token).toBeDefined();
      expect(typeof tokenData.token).toBe("string");
      expect(tokenData.token.length).toBeGreaterThan(20);
      expect(tokenData.expires_at).toBeNull();
    });

    it("creates a token with expiration", async () => {
      const result = await clientA.rpc<CreateBookShareTokenResponse[]>("create_book_share_token", {
        p_expires_days: 7,
      });

      expectSuccess(result, "create_book_share_token with expiration should succeed");
      const tokenData = result.data![0];

      expect(tokenData.expires_at).not.toBeNull();
      const expiresAt = new Date(tokenData.expires_at!);
      const now = new Date();
      const daysDiff = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      expect(daysDiff).toBeGreaterThan(6.9);
      expect(daysDiff).toBeLessThan(7.1);
    });

    it("fails for unauthenticated users", async () => {
      const result = await anonymousClient.rpc<CreateBookShareTokenResponse[]>("create_book_share_token", {
        p_expires_days: null,
      });

      expectError(result);
      expect(result.error?.message).toContain("permission denied");
    });
  });

  describe("get_book_share_info", () => {
    let shareToken: string;

    beforeAll(async () => {
      // Create a recipe so there's at least one for the count
      await createTestRecipe(clientA, {
        name: `Book Share Info Test ${uniqueId()}`,
      });

      const tokenResult = await clientA.rpc<CreateBookShareTokenResponse[]>("create_book_share_token", {
        p_expires_days: null,
      });
      shareToken = tokenResult.data![0].token;
    });

    it("returns sharer info for valid token (authenticated)", async () => {
      const result = await clientB.rpc<BookShareInfo[]>("get_book_share_info", {
        p_token: shareToken,
      });

      expectSuccess(result, "get_book_share_info should succeed");
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data!.length).toBe(1);

      const info = result.data![0];
      expect(info.sharer_name).toBe(TEST_USERS.userA.name);
      expect(info.sharer_email).toBe(TEST_USERS.userA.email);
      expect(typeof info.recipe_count).toBe("number");
      expect(info.recipe_count).toBeGreaterThan(0);
      expect(info.already_connected).toBe(false);
    });

    it("returns empty for invalid token", async () => {
      const result = await clientB.rpc<BookShareInfo[]>("get_book_share_info", {
        p_token: "invalid-token",
      });

      expectSuccess(result, "returns empty for invalid token");
      expect(result.data).toEqual([]);
    });

    it("returns empty for revoked token", async () => {
      const createResult = await clientA.rpc<CreateBookShareTokenResponse[]>("create_book_share_token", {
        p_expires_days: null,
      });
      const token = createResult.data![0].token;

      await clientA.rpc("revoke_book_share_token", { p_token: token });

      const result = await clientB.rpc<BookShareInfo[]>("get_book_share_info", {
        p_token: token,
      });

      expectSuccess(result);
      expect(result.data).toEqual([]);
    });
  });

  describe("accept_book_share", () => {
    let shareToken: string;

    beforeAll(async () => {
      const tokenResult = await clientA.rpc<CreateBookShareTokenResponse[]>("create_book_share_token", {
        p_expires_days: null,
      });
      shareToken = tokenResult.data![0].token;
    });

    it("creates a connection and returns sharer info", async () => {
      const result = await clientB.rpc<AcceptBookShareResponse[]>("accept_book_share", {
        p_token: shareToken,
      });

      expectSuccess(result, "accept_book_share should succeed");
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data!.length).toBe(1);

      const data = result.data![0];
      expect(data.sharer_name).toBe(TEST_USERS.userA.name);
      expectValidUuid(data.sharer_id);
    });

    it("is idempotent (accepting again succeeds)", async () => {
      const result = await clientB.rpc<AcceptBookShareResponse[]>("accept_book_share", {
        p_token: shareToken,
      });

      expectSuccess(result, "second accept should succeed (idempotent)");
      expect(result.data!.length).toBe(1);
    });

    it("shows already_connected in get_book_share_info after accepting", async () => {
      const result = await clientB.rpc<BookShareInfo[]>("get_book_share_info", {
        p_token: shareToken,
      });

      expectSuccess(result);
      expect(result.data![0].already_connected).toBe(true);
    });

    it("fails for self-share", async () => {
      const result = await clientA.rpc<AcceptBookShareResponse[]>("accept_book_share", {
        p_token: shareToken,
      });

      expectError(result);
      expect(result.error?.message).toContain("cannot-share-with-self");
    });

    it("fails for invalid token", async () => {
      const result = await clientB.rpc<AcceptBookShareResponse[]>("accept_book_share", {
        p_token: "invalid-token",
      });

      expectError(result);
      expect(result.error?.message).toContain("invalid-or-expired-token");
    });

    it("fails for unauthenticated users", async () => {
      const result = await anonymousClient.rpc<AcceptBookShareResponse[]>("accept_book_share", {
        p_token: shareToken,
      });

      expectError(result);
      expect(result.error?.message).toContain("permission denied");
    });
  });

  describe("get_shared_books", () => {
    it("returns connections where user is recipient", async () => {
      const result = await clientB.rpc<SharedBook[]>("get_shared_books");

      expectSuccess(result, "get_shared_books should succeed");
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data!.length).toBeGreaterThan(0);

      const book = result.data![0];
      expect(book.sharer_name).toBe(TEST_USERS.userA.name);
      expectValidUuid(book.sharer_id);
      expectValidUuid(book.id);
      expect(book.created_at).toBeDefined();
    });

    it("returns empty for user with no shared books", async () => {
      const result = await clientA.rpc<SharedBook[]>("get_shared_books");

      expectSuccess(result);
      // User A is a sharer, not a recipient — should be empty
      expect(result.data).toEqual([]);
    });

    it("fails for unauthenticated users", async () => {
      const result = await anonymousClient.rpc<SharedBook[]>("get_shared_books");

      expectError(result);
      expect(result.error?.message).toContain("permission denied");
    });
  });

  describe("RLS: book share recipient can see sharer's recipes", () => {
    let recipeId: string;
    const recipeName = `RLS Book Share Test ${uniqueId()}`;

    beforeAll(async () => {
      // Create a private recipe as user A
      recipeId = await createTestRecipe(clientA, {
        name: recipeName,
        description: "Only visible to book share recipients",
      });
    });

    it("recipient can see sharer's recipes", async () => {
      // User B has accepted user A's book share (from earlier tests)
      // User B should be able to see user A's recipes
      const result = await clientB
        .from("recipes")
        .select("id,name")
        .eq("id", recipeId)
        .single();

      expectSuccess(result, "recipient should see sharer's recipe");
      const recipe = result.data as { id: string; name: string };
      expect(recipe.id).toBe(recipeId);
      expect(recipe.name).toBe(recipeName);
    });
  });

  describe("revoke_book_share_token", () => {
    it("revokes owned token", async () => {
      const createResult = await clientA.rpc<CreateBookShareTokenResponse[]>("create_book_share_token", {
        p_expires_days: null,
      });
      const token = createResult.data![0].token;

      const result = await clientA.rpc<boolean>("revoke_book_share_token", {
        p_token: token,
      });

      expectSuccess(result, "revoke should succeed");
      expect(result.data).toBe(true);
    });

    it("returns false for non-existent token", async () => {
      const result = await clientA.rpc<boolean>("revoke_book_share_token", {
        p_token: "non-existent",
      });

      expectSuccess(result);
      expect(result.data).toBe(false);
    });

    it("returns false when other user tries to revoke", async () => {
      const createResult = await clientA.rpc<CreateBookShareTokenResponse[]>("create_book_share_token", {
        p_expires_days: null,
      });
      const token = createResult.data![0].token;

      const result = await clientB.rpc<boolean>("revoke_book_share_token", {
        p_token: token,
      });

      expectSuccess(result);
      expect(result.data).toBe(false);
    });
  });

  describe("remove_book_share_connection", () => {
    it("recipient can remove the connection", async () => {
      // Get the connection
      const booksResult = await clientB.rpc<SharedBook[]>("get_shared_books");
      expectSuccess(booksResult);
      const connection = booksResult.data!.find((b) => b.sharer_name === TEST_USERS.userA.name);
      expect(connection).toBeDefined();

      const result = await clientB.rpc<boolean>("remove_book_share_connection", {
        p_connection_id: connection!.id,
      });

      expectSuccess(result, "remove should succeed");
      expect(result.data).toBe(true);

      // Verify it's gone
      const afterResult = await clientB.rpc<SharedBook[]>("get_shared_books");
      expectSuccess(afterResult);
      const remaining = afterResult.data!.find((b) => b.sharer_name === TEST_USERS.userA.name);
      expect(remaining).toBeUndefined();
    });

    it("returns false for non-existent connection", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000";
      const result = await clientB.rpc<boolean>("remove_book_share_connection", {
        p_connection_id: fakeId,
      });

      expectSuccess(result);
      expect(result.data).toBe(false);
    });
  });
});
