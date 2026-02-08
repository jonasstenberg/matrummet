/**
 * Contract tests for admin function access control
 *
 * Verifies that admin and internal functions are not accessible to anon.
 * These functions have internal is_admin() checks, but should not be
 * granted to anon because:
 * 1. They shouldn't appear in the public OpenAPI spec
 * 2. Anon users shouldn't be able to probe admin endpoints
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createAnonymousClient,
  createAuthenticatedClient,
  setupTestHooks,
  TEST_USERS,
  type PostgrestClient,
} from "../setup";
import { createTestUser, cleanupTestData } from "../seed";

describe("Admin Function Access Control", () => {
  setupTestHooks();

  let anonClient: PostgrestClient;
  let authClient: PostgrestClient;

  beforeAll(async () => {
    anonClient = createAnonymousClient();
    await createTestUser(TEST_USERS.userA);
    authClient = await createAuthenticatedClient(TEST_USERS.userA.email);
  });

  afterAll(async () => {
    await cleanupTestData(TEST_USERS.userA.email);
  });

  // ==========================================================================
  // Food admin functions (V7, V12, V56)
  // ==========================================================================
  describe("Food admin functions blocked for anon", () => {
    it("anon cannot call admin_list_foods", async () => {
      const result = await anonClient.rpc("admin_list_foods", {
        p_search: null,
        p_status: null,
        p_limit: 10,
        p_offset: 0,
      });

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("permission denied");
    });

    it("anon cannot call approve_food", async () => {
      const result = await anonClient.rpc("approve_food", {
        p_food_id: "00000000-0000-0000-0000-000000000000",
      });

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("permission denied");
    });

    it("anon cannot call reject_food", async () => {
      const result = await anonClient.rpc("reject_food", {
        p_food_id: "00000000-0000-0000-0000-000000000000",
      });

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("permission denied");
    });

    it("anon cannot call approve_food_as_alias", async () => {
      const result = await anonClient.rpc("approve_food_as_alias", {
        p_food_id: "00000000-0000-0000-0000-000000000000",
        p_canonical_food_id: "00000000-0000-0000-0000-000000000001",
      });

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("permission denied");
    });

    it("anon cannot call set_food_canonical", async () => {
      const result = await anonClient.rpc("set_food_canonical", {
        p_food_id: "00000000-0000-0000-0000-000000000000",
        p_canonical_food_id: null,
      });

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("permission denied");
    });
  });

  // ==========================================================================
  // Account management functions
  // ==========================================================================
  describe("Account functions require authentication", () => {
    it("anon cannot call delete_account", async () => {
      const result = await anonClient.rpc("delete_account", {
        p_password: "test",
        p_delete_data: false,
      });

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("permission denied");
    });
  });

  // ==========================================================================
  // Internal helper functions
  // ==========================================================================
  describe("Internal helper functions blocked for anon", () => {
    it("anon cannot call resolve_food_ids_to_canonical", async () => {
      const result = await anonClient.rpc("resolve_food_ids_to_canonical", {
        p_food_ids: [],
      });

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("permission denied");
    });

    it("anon cannot call resolve_canonical", async () => {
      const result = await anonClient.rpc("resolve_canonical", {
        p_food_id: "00000000-0000-0000-0000-000000000000",
      });

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("permission denied");
    });

    it("anon cannot call search_foods", async () => {
      const result = await anonClient.rpc("search_foods", {
        p_query: "test",
        p_limit: 10,
      });

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("permission denied");
    });

    it("anon cannot call current_user_info", async () => {
      const result = await anonClient.rpc("current_user_info", {});

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("permission denied");
    });
  });

  // ==========================================================================
  // Authenticated users can call (but may be rejected by is_admin())
  // ==========================================================================
  describe("Authenticated CANNOT call admin functions (revoked in V12/V13)", () => {
    it("authenticated gets permission denied for admin_list_foods (revoked in V12)", async () => {
      const result = await authClient.rpc("admin_list_foods", {
        p_search: null,
        p_status: null,
        p_limit: 10,
        p_offset: 0,
      });

      expect(result.error).not.toBeNull();
      // V12 revoked EXECUTE from authenticated — grant-level denial
      expect(result.error?.message).toContain("permission denied");
    });

    it("authenticated gets permission denied for approve_food (revoked in V13)", async () => {
      const result = await authClient.rpc("approve_food", {
        p_food_id: "00000000-0000-0000-0000-000000000000",
      });

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("permission denied");
    });
  });
});
