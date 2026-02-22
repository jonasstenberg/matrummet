/**
 * Contract tests for API Key RPCs
 *
 * Tests the following RPCs:
 * - create_user_api_key(p_name) -> { id, name, api_key, api_key_prefix }
 * - get_user_api_keys() -> TABLE(id, name, api_key_prefix, last_used_at, expires_at, is_active, date_published)
 * - revoke_api_key(p_key_id) -> { revoked: boolean }
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createAuthenticatedClient,
  createAnonymousClient,
  setupTestHooks,
  TEST_USERS,
  type PostgrestClient,
} from "../setup";
import {
  expectSuccess,
  expectError,
  expectValidUuid,
  randomString,
} from "../helpers";
import { createTestUser, cleanupTestData } from "../seed";

// Types for RPC responses
interface CreateApiKeyResponse {
  id: string;
  name: string;
  api_key: string;
  api_key_prefix: string;
}

interface ApiKeyListItem {
  id: string;
  name: string;
  api_key_prefix: string;
  last_used_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  date_published: string;
}

interface RevokeApiKeyResponse {
  revoked: boolean;
}

describe("API Key RPCs", () => {
  setupTestHooks();

  let clientA: PostgrestClient;
  let clientB: PostgrestClient;
  let anonymousClient: PostgrestClient;

  // Track created API keys for cleanup
  const createdKeyIds: string[] = [];

  beforeAll(async () => {
    // Ensure test users exist
    await createTestUser(TEST_USERS.userA);
    await createTestUser(TEST_USERS.userB);

    // Create authenticated clients
    clientA = await createAuthenticatedClient(TEST_USERS.userA.email);
    clientB = await createAuthenticatedClient(TEST_USERS.userB.email);
    anonymousClient = createAnonymousClient();
  });

  afterAll(async () => {
    // Clean up created API keys
    for (const keyId of createdKeyIds) {
      try {
        await clientA.rpc("revoke_api_key", { p_key_id: keyId });
      } catch {
        // Ignore cleanup errors
      }
    }
    await cleanupTestData(TEST_USERS.userA.email);
    await cleanupTestData(TEST_USERS.userB.email);
  });

  describe("create_user_api_key", () => {
    describe("response shape", () => {
      it("returns correct structure with all required fields", async () => {
        const keyName = `TestKey${randomString(8)}`;
        const response = await clientA.rpc<CreateApiKeyResponse>(
          "create_user_api_key",
          {
            p_name: keyName,
          }
        );

        expectSuccess(response);

        const data = response.data!;
        createdKeyIds.push(data.id);

        // Verify all required fields exist
        expect(data).toHaveProperty("id");
        expect(data).toHaveProperty("name");
        expect(data).toHaveProperty("api_key");
        expect(data).toHaveProperty("api_key_prefix");

        // Verify types
        expectValidUuid(data.id);
        expect(typeof data.name).toBe("string");
        expect(typeof data.api_key).toBe("string");
        expect(typeof data.api_key_prefix).toBe("string");
      });

      it("returns the provided name", async () => {
        const keyName = `NamedKey${randomString(8)}`;
        const response = await clientA.rpc<CreateApiKeyResponse>(
          "create_user_api_key",
          {
            p_name: keyName,
          }
        );

        expectSuccess(response);
        createdKeyIds.push(response.data!.id);

        expect(response.data!.name).toBe(keyName);
      });

      it("generates API key with sk_ prefix", async () => {
        const keyName = `PrefixKey${randomString(8)}`;
        const response = await clientA.rpc<CreateApiKeyResponse>(
          "create_user_api_key",
          {
            p_name: keyName,
          }
        );

        expectSuccess(response);
        createdKeyIds.push(response.data!.id);

        expect(response.data!.api_key).toMatch(/^sk_[a-f0-9]{32}$/);
      });

      it("returns 8-character prefix", async () => {
        const keyName = `PrefixLenKey${randomString(8)}`;
        const response = await clientA.rpc<CreateApiKeyResponse>(
          "create_user_api_key",
          {
            p_name: keyName,
          }
        );

        expectSuccess(response);
        createdKeyIds.push(response.data!.id);

        expect(response.data!.api_key_prefix).toHaveLength(8);
        expect(response.data!.api_key_prefix).toBe("sk_" + response.data!.api_key.slice(3, 8));
      });
    });

    describe("key generation", () => {
      it("generates unique API keys for each creation", async () => {
        const key1Name = `Unique1${randomString(8)}`;
        const key2Name = `Unique2${randomString(8)}`;

        const response1 = await clientA.rpc<CreateApiKeyResponse>(
          "create_user_api_key",
          { p_name: key1Name }
        );
        const response2 = await clientA.rpc<CreateApiKeyResponse>(
          "create_user_api_key",
          { p_name: key2Name }
        );

        expectSuccess(response1);
        expectSuccess(response2);
        createdKeyIds.push(response1.data!.id);
        createdKeyIds.push(response2.data!.id);

        // Keys should be different
        expect(response1.data!.api_key).not.toBe(response2.data!.api_key);
        expect(response1.data!.id).not.toBe(response2.data!.id);
      });

      it("generates unique IDs for each key", async () => {
        const key1Name = `UniqueId1${randomString(8)}`;
        const key2Name = `UniqueId2${randomString(8)}`;

        const response1 = await clientA.rpc<CreateApiKeyResponse>(
          "create_user_api_key",
          { p_name: key1Name }
        );
        const response2 = await clientA.rpc<CreateApiKeyResponse>(
          "create_user_api_key",
          { p_name: key2Name }
        );

        expectSuccess(response1);
        expectSuccess(response2);
        createdKeyIds.push(response1.data!.id);
        createdKeyIds.push(response2.data!.id);

        expect(response1.data!.id).not.toBe(response2.data!.id);
      });
    });

    describe("input validation", () => {
      it("rejects empty name", async () => {
        const response = await clientA.rpc<CreateApiKeyResponse>(
          "create_user_api_key",
          { p_name: "" }
        );

        expectError(response);
        expect(response.error?.message).toContain("invalid-key-name");
      });

      it("rejects null name", async () => {
        const response = await clientA.rpc<CreateApiKeyResponse>(
          "create_user_api_key",
          { p_name: null }
        );

        expectError(response);
      });

      it("rejects whitespace-only name", async () => {
        const response = await clientA.rpc<CreateApiKeyResponse>(
          "create_user_api_key",
          { p_name: "   " }
        );

        expectError(response);
        expect(response.error?.message).toContain("invalid-key-name");
      });

      it("rejects duplicate key names for same user", async () => {
        const keyName = `DuplicateName${randomString(8)}`;

        // Create first key
        const response1 = await clientA.rpc<CreateApiKeyResponse>(
          "create_user_api_key",
          { p_name: keyName }
        );
        expectSuccess(response1);
        createdKeyIds.push(response1.data!.id);

        // Try to create second key with same name
        const response2 = await clientA.rpc<CreateApiKeyResponse>(
          "create_user_api_key",
          { p_name: keyName }
        );

        expectError(response2);
        expect(response2.error?.message).toContain("key-name-already-exists");
      });

      it("allows same key name for different users", async () => {
        const keyName = `SharedName${randomString(8)}`;

        const responseA = await clientA.rpc<CreateApiKeyResponse>(
          "create_user_api_key",
          { p_name: keyName }
        );
        const responseB = await clientB.rpc<CreateApiKeyResponse>(
          "create_user_api_key",
          { p_name: keyName }
        );

        expectSuccess(responseA);
        expectSuccess(responseB);
        createdKeyIds.push(responseA.data!.id);

        // Clean up User B's key separately
        await clientB.rpc("revoke_api_key", { p_key_id: responseB.data!.id });
      });

      it("trims whitespace from key names", async () => {
        const baseName = `TrimmedName${randomString(8)}`;
        const response = await clientA.rpc<CreateApiKeyResponse>(
          "create_user_api_key",
          { p_name: `  ${baseName}  ` }
        );

        expectSuccess(response);
        createdKeyIds.push(response.data!.id);

        expect(response.data!.name).toBe(baseName);
      });
    });

    describe("authentication", () => {
      it("requires authentication", async () => {
        const response = await anonymousClient.rpc<CreateApiKeyResponse>(
          "create_user_api_key",
          { p_name: `AnonKey${randomString(8)}` }
        );

        expectError(response);
        expect(response.error?.message).toContain("permission denied");
      });
    });
  });

  describe("get_user_api_keys", () => {
    let testKeyId: string;

    beforeAll(async () => {
      // Create a test key to query
      const keyName = `ListTestKey${randomString(8)}`;
      const response = await clientA.rpc<CreateApiKeyResponse>(
        "create_user_api_key",
        { p_name: keyName }
      );
      expectSuccess(response);
      testKeyId = response.data!.id;
      createdKeyIds.push(testKeyId);
    });

    describe("response shape", () => {
      it("returns an array of API keys", async () => {
        const response = await clientA.rpc<ApiKeyListItem[]>("get_user_api_keys");

        expectSuccess(response);
        expect(Array.isArray(response.data)).toBe(true);
      });

      it("returns correct shape for each key", async () => {
        const response = await clientA.rpc<ApiKeyListItem[]>("get_user_api_keys");

        expectSuccess(response);
        expect(response.data!.length).toBeGreaterThan(0);

        const key = response.data![0];

        // Verify required fields exist
        expect(key).toHaveProperty("id");
        expect(key).toHaveProperty("name");
        expect(key).toHaveProperty("api_key_prefix");
        expect(key).toHaveProperty("last_used_at");
        expect(key).toHaveProperty("expires_at");
        expect(key).toHaveProperty("is_active");
        expect(key).toHaveProperty("date_published");

        // Verify types
        expectValidUuid(key.id);
        expect(typeof key.name).toBe("string");
        expect(typeof key.api_key_prefix).toBe("string");
        expect(key.api_key_prefix).toHaveLength(8);
        expect(typeof key.is_active).toBe("boolean");
        expect(typeof key.date_published).toBe("string");
        // last_used_at and expires_at can be null or string
        expect(
          key.last_used_at === null || typeof key.last_used_at === "string"
        ).toBe(true);
        expect(
          key.expires_at === null || typeof key.expires_at === "string"
        ).toBe(true);
      });

      it("does not expose the full API key", async () => {
        const response = await clientA.rpc<ApiKeyListItem[]>("get_user_api_keys");

        expectSuccess(response);

        // Ensure no field contains the full API key (32+ chars)
        for (const key of response.data!) {
          expect(key).not.toHaveProperty("api_key");
          expect(key).not.toHaveProperty("api_key_hash");
          expect(key.api_key_prefix.length).toBeLessThan(32);
        }
      });
    });

    describe("filtering", () => {
      it("only returns active keys", async () => {
        // Create and revoke a key
        const keyName = `RevokedKey${randomString(8)}`;
        const createResponse = await clientA.rpc<CreateApiKeyResponse>(
          "create_user_api_key",
          { p_name: keyName }
        );
        expectSuccess(createResponse);

        await clientA.rpc("revoke_api_key", {
          p_key_id: createResponse.data!.id,
        });

        // Get all keys
        const listResponse = await clientA.rpc<ApiKeyListItem[]>(
          "get_user_api_keys"
        );
        expectSuccess(listResponse);

        // Revoked key should not appear
        const revokedKey = listResponse.data!.find(
          (k) => k.id === createResponse.data!.id
        );
        expect(revokedKey).toBeUndefined();
      });
    });

    describe("ordering", () => {
      it("orders keys by date_published descending (newest first)", async () => {
        // Create multiple keys with slight delay
        const key1Name = `OrderKey1${randomString(8)}`;
        const key2Name = `OrderKey2${randomString(8)}`;

        const response1 = await clientA.rpc<CreateApiKeyResponse>(
          "create_user_api_key",
          { p_name: key1Name }
        );
        expectSuccess(response1);
        createdKeyIds.push(response1.data!.id);

        const response2 = await clientA.rpc<CreateApiKeyResponse>(
          "create_user_api_key",
          { p_name: key2Name }
        );
        expectSuccess(response2);
        createdKeyIds.push(response2.data!.id);

        const listResponse = await clientA.rpc<ApiKeyListItem[]>(
          "get_user_api_keys"
        );
        expectSuccess(listResponse);

        // Find positions of both keys
        const key1Index = listResponse.data!.findIndex(
          (k) => k.id === response1.data!.id
        );
        const key2Index = listResponse.data!.findIndex(
          (k) => k.id === response2.data!.id
        );

        // Newer key (key2) should appear before older key (key1)
        expect(key2Index).toBeLessThan(key1Index);
      });
    });

    describe("user isolation", () => {
      it("only returns keys for the authenticated user", async () => {
        // Create a key for User B
        const keyName = `UserBKey${randomString(8)}`;
        const responseB = await clientB.rpc<CreateApiKeyResponse>(
          "create_user_api_key",
          { p_name: keyName }
        );
        expectSuccess(responseB);

        // User A should not see User B's keys
        const listResponseA = await clientA.rpc<ApiKeyListItem[]>(
          "get_user_api_keys"
        );
        expectSuccess(listResponseA);

        const userBKey = listResponseA.data!.find(
          (k) => k.id === responseB.data!.id
        );
        expect(userBKey).toBeUndefined();

        // Clean up User B's key
        await clientB.rpc("revoke_api_key", { p_key_id: responseB.data!.id });
      });
    });

    describe("authentication", () => {
      it("requires authentication", async () => {
        const response = await anonymousClient.rpc<ApiKeyListItem[]>(
          "get_user_api_keys"
        );

        expectError(response);
        expect(response.error?.message).toContain("permission denied");
      });
    });
  });

  describe("revoke_api_key", () => {
    describe("response shape", () => {
      it("returns { revoked: true } on success", async () => {
        // Create a key to revoke
        const keyName = `RevokeTest${randomString(8)}`;
        const createResponse = await clientA.rpc<CreateApiKeyResponse>(
          "create_user_api_key",
          { p_name: keyName }
        );
        expectSuccess(createResponse);

        const revokeResponse = await clientA.rpc<RevokeApiKeyResponse>(
          "revoke_api_key",
          { p_key_id: createResponse.data!.id }
        );

        expectSuccess(revokeResponse);
        expect(revokeResponse.data).toHaveProperty("revoked");
        expect(revokeResponse.data!.revoked).toBe(true);
      });
    });

    describe("revocation behavior", () => {
      it("prevents key from appearing in get_user_api_keys", async () => {
        // Create a key
        const keyName = `RevokeHide${randomString(8)}`;
        const createResponse = await clientA.rpc<CreateApiKeyResponse>(
          "create_user_api_key",
          { p_name: keyName }
        );
        expectSuccess(createResponse);
        const keyId = createResponse.data!.id;

        // Verify it appears in list
        const listBefore = await clientA.rpc<ApiKeyListItem[]>(
          "get_user_api_keys"
        );
        expectSuccess(listBefore);
        expect(listBefore.data!.some((k) => k.id === keyId)).toBe(true);

        // Revoke the key
        await clientA.rpc("revoke_api_key", { p_key_id: keyId });

        // Verify it no longer appears in list
        const listAfter = await clientA.rpc<ApiKeyListItem[]>(
          "get_user_api_keys"
        );
        expectSuccess(listAfter);
        expect(listAfter.data!.some((k) => k.id === keyId)).toBe(false);
      });

      it("rejects revoking an already deleted key", async () => {
        // Create and revoke a key
        const keyName = `DoubleRevoke${randomString(8)}`;
        const createResponse = await clientA.rpc<CreateApiKeyResponse>(
          "create_user_api_key",
          { p_name: keyName }
        );
        expectSuccess(createResponse);
        const keyId = createResponse.data!.id;

        // Revoke once (deletes the row)
        const revoke1 = await clientA.rpc<RevokeApiKeyResponse>("revoke_api_key", {
          p_key_id: keyId,
        });
        expectSuccess(revoke1);

        // Revoke again - key no longer exists
        const revoke2 = await clientA.rpc<RevokeApiKeyResponse>("revoke_api_key", {
          p_key_id: keyId,
        });
        expectError(revoke2);
        expect(revoke2.error?.message).toContain("key-not-found");
      });
    });

    describe("input validation", () => {
      it("rejects non-existent key ID", async () => {
        const fakeKeyId = "00000000-0000-0000-0000-000000000000";
        const response = await clientA.rpc<RevokeApiKeyResponse>("revoke_api_key", {
          p_key_id: fakeKeyId,
        });

        expectError(response);
        expect(response.error?.message).toContain("key-not-found");
      });

      it("rejects invalid UUID format", async () => {
        const response = await clientA.rpc<RevokeApiKeyResponse>("revoke_api_key", {
          p_key_id: "invalid-uuid",
        });

        expectError(response);
      });

      it("rejects null key ID", async () => {
        const response = await clientA.rpc<RevokeApiKeyResponse>("revoke_api_key", {
          p_key_id: null,
        });

        expectError(response);
      });
    });

    describe("user isolation", () => {
      it("cannot revoke another user's key", async () => {
        // User B creates a key
        const keyName = `UserBOnlyKey${randomString(8)}`;
        const createResponse = await clientB.rpc<CreateApiKeyResponse>(
          "create_user_api_key",
          { p_name: keyName }
        );
        expectSuccess(createResponse);
        const keyId = createResponse.data!.id;

        // User A tries to revoke User B's key
        const revokeResponse = await clientA.rpc<RevokeApiKeyResponse>(
          "revoke_api_key",
          { p_key_id: keyId }
        );

        expectError(revokeResponse);
        expect(revokeResponse.error?.message).toContain("key-not-found");

        // Clean up - User B revokes their own key
        await clientB.rpc("revoke_api_key", { p_key_id: keyId });
      });
    });

    describe("authentication", () => {
      it("requires authentication", async () => {
        // Create a key as authenticated user
        const keyName = `AnonRevokeTest${randomString(8)}`;
        const createResponse = await clientA.rpc<CreateApiKeyResponse>(
          "create_user_api_key",
          { p_name: keyName }
        );
        expectSuccess(createResponse);
        createdKeyIds.push(createResponse.data!.id);

        // Try to revoke as anonymous user
        const response = await anonymousClient.rpc<RevokeApiKeyResponse>(
          "revoke_api_key",
          { p_key_id: createResponse.data!.id }
        );

        expectError(response);
        expect(response.error?.message).toContain("permission denied");
      });
    });
  });

  describe("API Key Lifecycle", () => {
    it("complete lifecycle: create -> list -> revoke -> verify removed", async () => {
      // 1. Create a new API key
      const keyName = `LifecycleKey${randomString(8)}`;
      const createResponse = await clientA.rpc<CreateApiKeyResponse>(
        "create_user_api_key",
        { p_name: keyName }
      );
      expectSuccess(createResponse);
      const keyId = createResponse.data!.id;
      const apiKey = createResponse.data!.api_key;

      // Verify key format
      expect(apiKey).toMatch(/^sk_[a-f0-9]{32}$/);

      // 2. Verify key appears in list
      const listResponse1 = await clientA.rpc<ApiKeyListItem[]>(
        "get_user_api_keys"
      );
      expectSuccess(listResponse1);
      const listedKey = listResponse1.data!.find((k) => k.id === keyId);
      expect(listedKey).toBeDefined();
      expect(listedKey!.name).toBe(keyName);
      expect(listedKey!.is_active).toBe(true);
      expect(listedKey!.last_used_at).toBeNull();

      // 3. Revoke the key
      const revokeResponse = await clientA.rpc<RevokeApiKeyResponse>(
        "revoke_api_key",
        { p_key_id: keyId }
      );
      expectSuccess(revokeResponse);
      expect(revokeResponse.data!.revoked).toBe(true);

      // 4. Verify key no longer in list
      const listResponse2 = await clientA.rpc<ApiKeyListItem[]>(
        "get_user_api_keys"
      );
      expectSuccess(listResponse2);
      const removedKey = listResponse2.data!.find((k) => k.id === keyId);
      expect(removedKey).toBeUndefined();
    });

    it("can create multiple keys with different names", async () => {
      const keys: CreateApiKeyResponse[] = [];

      // Create 3 keys
      for (let i = 1; i <= 3; i++) {
        const response = await clientA.rpc<CreateApiKeyResponse>(
          "create_user_api_key",
          { p_name: `MultiKey${i}_${randomString(6)}` }
        );
        expectSuccess(response);
        keys.push(response.data!);
        createdKeyIds.push(response.data!.id);
      }

      // All keys should have unique IDs and API keys
      const ids = keys.map((k) => k.id);
      const apiKeys = keys.map((k) => k.api_key);

      expect(new Set(ids).size).toBe(3);
      expect(new Set(apiKeys).size).toBe(3);

      // All should appear in list
      const listResponse = await clientA.rpc<ApiKeyListItem[]>(
        "get_user_api_keys"
      );
      expectSuccess(listResponse);

      for (const key of keys) {
        expect(listResponse.data!.some((k) => k.id === key.id)).toBe(true);
      }
    });
  });
});
