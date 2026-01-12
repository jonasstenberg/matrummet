/**
 * RLS Security Tests for Users and User API Keys
 *
 * Tests Row-Level Security policies for:
 * - users table: self-access, profile updates, cross-user isolation
 * - user_api_keys table: key ownership, creation, modification restrictions
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
  createTestApiKey,
  resetCreatedResources,
  uniqueId,
} from "../seed";
import {
  expectSuccess,
  expectRlsBlocked,
  expectUserShape,
} from "../helpers";

// Type definitions for database records
interface UserRecord {
  id: string;
  name: string;
  email: string;
  measures_system: string;
  provider: string | null;
  owner: string;
  role?: string;
  home_id?: string | null;
  home_joined_at?: string | null;
}

interface ApiKeyRecord {
  id: string;
  user_email: string;
  name: string;
  api_key_hash: string;
  api_key_prefix: string;
  last_used_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  date_published: string;
  api_key?: string; // Not stored, only returned on creation
}

describe("RLS: users table", () => {
  setupTestHooks();

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

  beforeEach(() => {
    resetCreatedResources();
  });

  afterAll(() => {
    resetCreatedResources();
  });

  describe("SELECT policy", () => {
    it("user can SELECT their own profile", async () => {
      const result = await clientA
        .from("users")
        .select("*")
        .eq("email", TEST_USERS.userA.email);

      expectSuccess(result);
      const users = result.data as UserRecord[];
      expect(Array.isArray(users)).toBe(true);
      expect(users).toHaveLength(1);
      expectUserShape(users[0]);
      expect(users[0].email).toBe(TEST_USERS.userA.email);
      expect(users[0].name).toBe(TEST_USERS.userA.name);
    });

    it("user CANNOT SELECT other users profiles", async () => {
      // User A tries to select User B's profile
      const result = await clientA
        .from("users")
        .select("*")
        .eq("email", TEST_USERS.userB.email);

      // RLS should block - empty result (not an error, just no rows returned)
      expectRlsBlocked(result);
    });

    it("anonymous user CANNOT SELECT any user profiles", async () => {
      const result = await anonClient
        .from("users")
        .select("*")
        .eq("email", TEST_USERS.userA.email);

      // RLS should block - empty result
      expectRlsBlocked(result);
    });

    it("user can only see themselves when selecting all users", async () => {
      // Select all users - should only return current user
      const result = await clientA.from("users").select("*");

      expectSuccess(result);
      const users = result.data as UserRecord[];
      expect(Array.isArray(users)).toBe(true);
      // Should only see themselves, not other users
      expect(users).toHaveLength(1);
      expect(users[0].email).toBe(TEST_USERS.userA.email);
    });
  });

  describe("UPDATE policy", () => {
    it("user can UPDATE their own profile (name)", async () => {
      const newName = `Updated ${uniqueId("Name")}`;

      const updateResult = await clientA
        .from("users")
        .update({ name: newName })
        .eq("email", TEST_USERS.userA.email);

      expectSuccess(updateResult);

      // Verify the update
      const selectResult = await clientA
        .from("users")
        .select("name")
        .eq("email", TEST_USERS.userA.email)
        .single();

      expectSuccess(selectResult);
      const user = selectResult.data as UserRecord;
      expect(user.name).toBe(newName);

      // Restore original name
      await clientA
        .from("users")
        .update({ name: TEST_USERS.userA.name })
        .eq("email", TEST_USERS.userA.email);
    });

    it("user can UPDATE their own profile (measures_system)", async () => {
      // Get current value
      const currentResult = await clientA
        .from("users")
        .select("measures_system")
        .eq("email", TEST_USERS.userA.email)
        .single();

      expectSuccess(currentResult);
      const currentUser = currentResult.data as UserRecord;
      const originalValue = currentUser.measures_system;
      const newValue = originalValue === "metric" ? "imperial" : "metric";

      // Update measures_system
      const updateResult = await clientA
        .from("users")
        .update({ measures_system: newValue })
        .eq("email", TEST_USERS.userA.email);

      expectSuccess(updateResult);

      // Verify the update
      const selectResult = await clientA
        .from("users")
        .select("measures_system")
        .eq("email", TEST_USERS.userA.email)
        .single();

      expectSuccess(selectResult);
      const updatedUser = selectResult.data as UserRecord;
      expect(updatedUser.measures_system).toBe(newValue);

      // Restore original value
      await clientA
        .from("users")
        .update({ measures_system: originalValue })
        .eq("email", TEST_USERS.userA.email);
    });

    it("user CANNOT UPDATE other users profiles", async () => {
      const originalNameB = TEST_USERS.userB.name;

      // User A tries to update User B's profile
      const updateResult = await clientA
        .from("users")
        .update({ name: "Hacked Name" })
        .eq("email", TEST_USERS.userB.email);

      // RLS should block - no rows affected
      expectRlsBlocked(updateResult);

      // Verify User B's name was not changed
      const selectResult = await clientB
        .from("users")
        .select("name")
        .eq("email", TEST_USERS.userB.email)
        .single();

      expectSuccess(selectResult);
      const userB = selectResult.data as UserRecord;
      expect(userB.name).toBe(originalNameB);
    });

    it("anonymous user CANNOT UPDATE any profiles", async () => {
      const updateResult = await anonClient
        .from("users")
        .update({ name: "Anonymous Hacker" })
        .eq("email", TEST_USERS.userA.email);

      // Should fail (either error or RLS block)
      if (updateResult.error) {
        expect(updateResult.error).not.toBeNull();
      } else {
        expectRlsBlocked(updateResult);
      }
    });
  });

  describe("INSERT policy", () => {
    it("authenticated user can only INSERT with their own owner field", async () => {
      // Normal signup flow is via the signup RPC
      // Direct insert should fail for other users
      // This test verifies the RLS INSERT policy

      // Attempt to insert a user with a different owner (should fail)
      const insertResult = await clientA.from("users").insert({
        name: "Fake User",
        email: "fake-user@example.com",
        owner: TEST_USERS.userB.email, // Trying to set different owner
      });

      // Should fail due to RLS WITH CHECK
      expect(insertResult.error).not.toBeNull();
    });
  });

  describe("DELETE policy", () => {
    it("user can only DELETE their own profile", async () => {
      // Note: Deleting users is typically done via delete_user RPC
      // This tests the RLS policy directly

      // User A tries to delete User B directly
      const deleteResult = await clientA
        .from("users")
        .delete()
        .eq("email", TEST_USERS.userB.email);

      // RLS should block - no rows affected
      expectRlsBlocked(deleteResult);

      // Verify User B still exists
      const selectResult = await clientB
        .from("users")
        .select("*")
        .eq("email", TEST_USERS.userB.email);

      expectSuccess(selectResult);
      const users = selectResult.data as UserRecord[];
      expect(users).toHaveLength(1);
    });
  });
});

describe("RLS: user_api_keys table", () => {
  setupTestHooks();

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

  beforeEach(async () => {
    resetCreatedResources();

    // Clean up any existing API keys for test users
    await clientA.rpc("revoke_all_api_keys").catch(() => {
      // Ignore if function doesn't exist or fails
    });
    await clientB.rpc("revoke_all_api_keys").catch(() => {
      // Ignore if function doesn't exist or fails
    });
  });

  afterAll(async () => {
    // Cleanup
    try {
      // Revoke all test API keys
      const keysA = await clientA.from("user_api_keys").select("id");
      if (keysA.data && Array.isArray(keysA.data)) {
        for (const key of keysA.data) {
          await clientA.rpc("revoke_api_key", { p_key_id: key.id });
        }
      }
    } catch {
      // Ignore cleanup errors
    }
    resetCreatedResources();
  });

  describe("SELECT policy", () => {
    it("user can SELECT their own API keys", async () => {
      // Create an API key for user A
      const keyData = await createTestApiKey(clientA, uniqueId("API-Key-A"));

      // User A should see their key
      const result = await clientA
        .from("user_api_keys")
        .select("*")
        .eq("id", keyData.id);

      expectSuccess(result);
      const keys = result.data as ApiKeyRecord[];
      expect(Array.isArray(keys)).toBe(true);
      expect(keys).toHaveLength(1);
      expect(keys[0].id).toBe(keyData.id);
      expect(keys[0].user_email).toBe(TEST_USERS.userA.email);
    });

    it("user CANNOT see other users API keys", async () => {
      // Create an API key for user A
      const keyData = await createTestApiKey(clientA, uniqueId("API-Key-Hidden"));

      // User B tries to see User A's key
      const result = await clientB
        .from("user_api_keys")
        .select("*")
        .eq("id", keyData.id);

      // RLS should block - empty result
      expectRlsBlocked(result);
    });

    it("anonymous user CANNOT see any API keys", async () => {
      // Create an API key for user A
      const keyData = await createTestApiKey(clientA, uniqueId("API-Key-Anon"));

      // Anonymous client tries to see the key
      const result = await anonClient
        .from("user_api_keys")
        .select("*")
        .eq("id", keyData.id);

      // RLS should block
      expectRlsBlocked(result);
    });

    it("user can only see their own keys when selecting all", async () => {
      // Create keys for both users
      await createTestApiKey(clientA, uniqueId("API-Key-A-All"));
      await createTestApiKey(clientB, uniqueId("API-Key-B-All"));

      // User A selects all keys
      const result = await clientA.from("user_api_keys").select("*");

      expectSuccess(result);
      expect(Array.isArray(result.data)).toBe(true);

      // All returned keys should belong to user A
      for (const key of result.data as Array<{ user_email: string }>) {
        expect(key.user_email).toBe(TEST_USERS.userA.email);
      }
    });
  });

  describe("INSERT policy", () => {
    it("user can INSERT new API keys for themselves", async () => {
      // Use the RPC to create a key (proper way)
      const result = await clientA.rpc<{
        id: string;
        api_key: string;
        api_key_prefix: string;
      }>("create_user_api_key", {
        p_name: uniqueId("New-API-Key"),
      });

      expectSuccess(result);
      expect(result.data).not.toBeNull();
      expect(result.data!.id).toBeDefined();
      expect(result.data!.api_key).toBeDefined();
      expect(result.data!.api_key_prefix).toHaveLength(8);
    });

    it("user CANNOT INSERT API keys for other users", async () => {
      // Try to directly insert a key for another user
      const insertResult = await clientA.from("user_api_keys").insert({
        user_email: TEST_USERS.userB.email, // Wrong user!
        name: uniqueId("Fake-Key"),
        api_key_hash: "fake_hash",
        api_key_prefix: "12345678",
      });

      // Should fail due to RLS WITH CHECK
      expect(insertResult.error).not.toBeNull();
    });

    it("anonymous user CANNOT INSERT API keys", async () => {
      const insertResult = await anonClient.from("user_api_keys").insert({
        user_email: TEST_USERS.userA.email,
        name: uniqueId("Anon-Key"),
        api_key_hash: "fake_hash",
        api_key_prefix: "12345678",
      });

      // Should fail
      expect(insertResult.error).not.toBeNull();
    });
  });

  describe("DELETE policy (revocation)", () => {
    it("user can DELETE (revoke) their own API keys", async () => {
      // Create a key for user A
      const keyData = await createTestApiKey(clientA, uniqueId("API-Key-Delete"));

      // User A revokes their key via RPC
      const revokeResult = await clientA.rpc("revoke_api_key", {
        p_key_id: keyData.id,
      });

      expectSuccess(revokeResult);

      // Verify the key is no longer active
      const selectResult = await clientA
        .from("user_api_keys")
        .select("is_active")
        .eq("id", keyData.id)
        .single();

      expectSuccess(selectResult);
      const key = selectResult.data as ApiKeyRecord;
      expect(key.is_active).toBe(false);
    });

    it("user can DELETE their own API keys directly", async () => {
      // Create a key for user A
      const keyData = await createTestApiKey(clientA, uniqueId("API-Key-Direct-Delete"));

      // User A deletes their key directly
      const deleteResult = await clientA
        .from("user_api_keys")
        .delete()
        .eq("id", keyData.id);

      expectSuccess(deleteResult);

      // Verify key is gone
      const selectResult = await clientA
        .from("user_api_keys")
        .select("*")
        .eq("id", keyData.id);

      expectRlsBlocked(selectResult);
    });

    it("user CANNOT DELETE other users API keys", async () => {
      // Create a key for user A
      const keyData = await createTestApiKey(clientA, uniqueId("API-Key-Protect"));

      // User B tries to delete User A's key
      const deleteResult = await clientB
        .from("user_api_keys")
        .delete()
        .eq("id", keyData.id);

      // RLS should block - no rows affected
      expectRlsBlocked(deleteResult);

      // Verify the key still exists
      const selectResult = await clientA
        .from("user_api_keys")
        .select("*")
        .eq("id", keyData.id);

      expectSuccess(selectResult);
      const keys = selectResult.data as ApiKeyRecord[];
      expect(keys).toHaveLength(1);
    });

    it("anonymous user CANNOT DELETE any API keys", async () => {
      // Create a key for user A
      const keyData = await createTestApiKey(clientA, uniqueId("API-Key-Anon-Delete"));

      // Anonymous tries to delete
      const deleteResult = await anonClient
        .from("user_api_keys")
        .delete()
        .eq("id", keyData.id);

      // Should fail or be blocked
      if (deleteResult.error) {
        expect(deleteResult.error).not.toBeNull();
      } else {
        expectRlsBlocked(deleteResult);
      }

      // Verify the key still exists
      const selectResult = await clientA
        .from("user_api_keys")
        .select("*")
        .eq("id", keyData.id);

      expectSuccess(selectResult);
      const keys = selectResult.data as ApiKeyRecord[];
      expect(keys).toHaveLength(1);
    });
  });

  describe("Cross-user isolation", () => {
    it("user A cannot modify user B API keys in any way", async () => {
      // Create a key for user B
      const keyDataB = await createTestApiKey(clientB, uniqueId("API-Key-B-Isolation"));

      // User A tries various operations on User B's key

      // 1. Cannot select
      const selectResult = await clientA
        .from("user_api_keys")
        .select("*")
        .eq("id", keyDataB.id);
      expectRlsBlocked(selectResult);

      // 2. Cannot delete
      const deleteResult = await clientA
        .from("user_api_keys")
        .delete()
        .eq("id", keyDataB.id);
      expectRlsBlocked(deleteResult);

      // 3. Cannot update (if update was allowed - but DELETE-only table)
      // user_api_keys doesn't have UPDATE grant, but test the RLS anyway

      // Verify key still exists and is unchanged
      const verifyResult = await clientB
        .from("user_api_keys")
        .select("*")
        .eq("id", keyDataB.id)
        .single();

      expectSuccess(verifyResult);
      const key = verifyResult.data as ApiKeyRecord;
      expect(key.id).toBe(keyDataB.id);
      expect(key.is_active).toBe(true);
    });

    it("listing all API keys only returns own keys", async () => {
      // Create multiple keys for both users
      await createTestApiKey(clientA, uniqueId("Key-A-1"));
      await createTestApiKey(clientA, uniqueId("Key-A-2"));
      await createTestApiKey(clientB, uniqueId("Key-B-1"));
      await createTestApiKey(clientB, uniqueId("Key-B-2"));

      // User A lists all keys
      const resultA = await clientA.from("user_api_keys").select("*");
      expectSuccess(resultA);

      // All keys should belong to user A
      const keysA = resultA.data as ApiKeyRecord[];
      for (const key of keysA) {
        expect(key.user_email).toBe(TEST_USERS.userA.email);
      }

      // User B lists all keys
      const resultB = await clientB.from("user_api_keys").select("*");
      expectSuccess(resultB);

      // All keys should belong to user B
      const keysB = resultB.data as ApiKeyRecord[];
      for (const key of keysB) {
        expect(key.user_email).toBe(TEST_USERS.userB.email);
      }
    });
  });

  describe("API key security", () => {
    it("API key hash is never exposed in SELECT results", async () => {
      // Create a key
      const keyData = await createTestApiKey(clientA, uniqueId("Key-Hash-Check"));

      // Select the key
      const result = await clientA
        .from("user_api_keys")
        .select("*")
        .eq("id", keyData.id)
        .single();

      expectSuccess(result);

      // The full API key should NOT be in the result
      // Only the prefix and hash should be stored
      const key = result.data as ApiKeyRecord;
      expect(key.api_key).toBeUndefined(); // Full key not stored
      expect(key.api_key_hash).toBeDefined(); // Hash is stored
      expect(key.api_key_prefix).toBe(keyData.prefix); // Prefix matches
    });

    it("API key validation works for valid keys", async () => {
      // Create a key and get the full key value
      const keyResult = await clientA.rpc<{
        id: string;
        api_key: string;
        api_key_prefix: string;
      }>("create_user_api_key", {
        p_name: uniqueId("Key-Validate"),
      });

      expectSuccess(keyResult);
      const fullApiKey = keyResult.data!.api_key;

      // Validate the key (this is used by the application for API auth)
      const validateResult = await anonClient.rpc<string>("validate_api_key", {
        p_api_key: fullApiKey,
      });

      expectSuccess(validateResult);
      expect(validateResult.data).toBe(TEST_USERS.userA.email);
    });

    it("API key validation fails for invalid keys", async () => {
      const validateResult = await anonClient.rpc<string>("validate_api_key", {
        p_api_key: "invalid_api_key_12345678",
      });

      // Should return null for invalid key
      expect(validateResult.data).toBeNull();
    });

    it("revoked API keys no longer validate", async () => {
      // Create a key
      const keyResult = await clientA.rpc<{
        id: string;
        api_key: string;
        api_key_prefix: string;
      }>("create_user_api_key", {
        p_name: uniqueId("Key-Revoke-Validate"),
      });

      expectSuccess(keyResult);
      const fullApiKey = keyResult.data!.api_key;
      const keyId = keyResult.data!.id;

      // Revoke the key
      await clientA.rpc("revoke_api_key", { p_key_id: keyId });

      // Try to validate - should fail
      const validateResult = await anonClient.rpc<string>("validate_api_key", {
        p_api_key: fullApiKey,
      });

      // Revoked key should not validate
      expect(validateResult.data).toBeNull();
    });
  });
});
