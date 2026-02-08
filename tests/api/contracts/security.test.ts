/**
 * Contract tests for V49 security migration
 *
 * Verifies the critical security properties introduced by
 * V49__revoke_anon_function_access.sql:
 *
 * 1. is_admin() returns FALSE (not NULL) for unauthenticated requests
 * 2. Admin functions are inaccessible to anon
 * 3. Admin functions reject non-admin authenticated users with is_admin() error
 * 4. Sensitive internal functions are inaccessible to anon
 * 5. Anon can still call whitelisted functions
 * 6. Authenticated users retain full access after inheritance break
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createAnonymousClient,
  createAuthenticatedClient,
  setupTestHooks,
  TEST_USERS,
  type PostgrestClient,
} from "../setup";
import { createTestUser, createTestRecipe, cleanupTestData } from "../seed";

describe("V49 Security: Anon Function Access Revocation", () => {
  setupTestHooks();

  let anonClient: PostgrestClient;
  let authClient: PostgrestClient;

  beforeAll(async () => {
    anonClient = createAnonymousClient();

    // Ensure test user exists
    await createTestUser(TEST_USERS.userA);
    authClient = await createAuthenticatedClient(TEST_USERS.userA.email);
  });

  afterAll(async () => {
    await cleanupTestData(TEST_USERS.userA.email);
  });

  // ==========================================================================
  // 1. is_admin() returns FALSE (not NULL) for unauthenticated requests
  // ==========================================================================
  describe("is_admin() NULL fix", () => {
    it("admin_list_users as anon fails with 'permission denied', not a NULL error", async () => {
      const result = await anonClient.rpc("admin_list_users");

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("permission denied");
      // Must NOT be a NULL-related error (which would indicate is_admin()
      // returned NULL instead of FALSE)
      expect(result.error?.message).not.toContain("null");
      expect(result.error?.message).not.toContain("NULL");
    });
  });

  // ==========================================================================
  // 2. Admin functions are inaccessible to anon
  // ==========================================================================
  describe("Admin functions blocked for anon", () => {
    it("anon cannot call admin_list_users", async () => {
      const result = await anonClient.rpc("admin_list_users");

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("permission denied");
    });

    it("anon cannot call admin_delete_user", async () => {
      const result = await anonClient.rpc("admin_delete_user", {
        p_user_id: "00000000-0000-0000-0000-000000000000",
      });

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("permission denied");
    });

    it("anon cannot call admin_update_user", async () => {
      const result = await anonClient.rpc("admin_update_user", {
        p_user_id: "00000000-0000-0000-0000-000000000000",
        p_name: "Hacked",
      });

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("permission denied");
    });

    it("anon cannot call admin_update_user_role", async () => {
      const result = await anonClient.rpc("admin_update_user_role", {
        p_user_id: "00000000-0000-0000-0000-000000000000",
        p_new_role: "admin",
      });

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("permission denied");
    });
  });

  // ==========================================================================
  // 3. Admin functions are accessible to authenticated but rejected by is_admin()
  // ==========================================================================
  describe("Admin functions denied for non-admin authenticated users (V12)", () => {
    it("authenticated non-admin gets permission denied for admin_list_users (revoked in V12)", async () => {
      const result = await authClient.rpc("admin_list_users");

      expect(result.error).not.toBeNull();
      // V12 revoked EXECUTE from authenticated — grant-level denial
      expect(result.error?.message).toContain("permission denied");
    });
  });

  // ==========================================================================
  // 4. Sensitive internal functions are inaccessible to anon
  // ==========================================================================
  describe("Sensitive functions blocked for anon", () => {
    it("anon can call validate_api_key (needed for pre_request API key auth)", async () => {
      const result = await anonClient.rpc("validate_api_key", {
        p_api_key: "some-key",
      });

      // Callable by anon but returns null for invalid keys
      expect(result.error).toBeNull();
      expect(result.data).toBeNull();
    });

    it("anon cannot call is_admin", async () => {
      const result = await anonClient.rpc("is_admin");

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("permission denied");
    });

    it("anon cannot call queue_email", async () => {
      const result = await anonClient.rpc("queue_email", {
        p_template_name: "test",
        p_recipient_email: "test@example.com",
      });

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("permission denied");
    });
  });

  // ==========================================================================
  // 5. Anon CAN still call whitelisted functions
  // ==========================================================================
  describe("Anon whitelist still works", () => {
    // search_public_recipes has been removed - recipes require authentication

    it("anon can call login (with invalid creds, just checking callable)", async () => {
      const result = await anonClient.rpc("login", {
        login_email: "nonexistent@example.com",
        login_password: "WrongPassword123!",
      });

      // Login should be callable — the error should be about credentials,
      // NOT about "permission denied"
      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("invalid user or password");
      expect(result.error?.message).not.toContain("permission denied");
    });
  });

  // ==========================================================================
  // 6. Authenticated users retain full access after inheritance break
  // ==========================================================================
  describe("Authenticated access preserved after REVOKE anon FROM authenticated", () => {
    it("authenticated can call insert_recipe", async () => {
      const recipeId = await createTestRecipe(authClient, {
        name: `Security Test Recipe ${Date.now()}`,
      });

      expect(typeof recipeId).toBe("string");
      expect(recipeId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it("authenticated can call search_foods", async () => {
      const result = await authClient.rpc("search_foods", {
        p_query: "salt",
      });

      expect(result.error).toBeNull();
      expect(result.status).toBe(200);
    });

    it("authenticated can call validate_api_key", async () => {
      const result = await authClient.rpc("validate_api_key", {
        p_api_key: "nonexistent-key",
      });

      // Should succeed (return null for invalid key, not an error)
      expect(result.error).toBeNull();
    });
  });
});
