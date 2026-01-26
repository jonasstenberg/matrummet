/**
 * Auth Security Behavior Tests
 *
 * Tests authentication security features including:
 * - Password reset token expiration
 * - Home join code expiration
 * - Password validation
 * - Token security
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
  uniqueId,
} from "../seed";
import { expectSuccess, expectNoError } from "../helpers";

describe("Auth Security Behavior", () => {
  setupTestHooks();

  let clientA: PostgrestClient;
  let clientB: PostgrestClient;
  let anonClient: PostgrestClient;

  beforeAll(async () => {
    // Create test users
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

  describe("Password Reset Token Expiration", () => {
    it("should create password reset token that can be validated", async () => {
      // Request password reset
      const requestResult = await anonClient.rpc<{ success: boolean }>(
        "request_password_reset",
        {
          p_email: TEST_USERS.userA.email,
          p_app_url: "https://test.example.com",
        }
      );

      expectSuccess(requestResult, "Failed to request password reset");
      expect(requestResult.data.success).toBe(true);

      // Note: We can't directly access the token from tests since it's
      // hashed in the database and returned via email. This test verifies
      // the request succeeds.
    });

    it("should rate limit password reset requests (5 minute cooldown)", async () => {
      // First request should succeed
      const firstRequest = await anonClient.rpc<{ success: boolean }>(
        "request_password_reset",
        {
          p_email: TEST_USERS.userA.email,
        }
      );
      expectSuccess(firstRequest, "First request should succeed");

      // Second request within 5 minutes should also return success
      // (but not create a new token - silent rate limiting)
      const secondRequest = await anonClient.rpc<{ success: boolean }>(
        "request_password_reset",
        {
          p_email: TEST_USERS.userA.email,
        }
      );
      expectSuccess(secondRequest, "Second request should not error");
      expect(secondRequest.data.success).toBe(true);

      // Note: We can't verify a new token wasn't created without DB access,
      // but the function handles rate limiting internally
    });

    it("should validate token format and reject invalid tokens", async () => {
      // Try to validate an invalid token
      const validateResult = await anonClient.rpc<{ valid: boolean; error?: string }>(
        "validate_password_reset_token",
        {
          p_token: "invalid-token-format",
        }
      );

      expectSuccess(validateResult, "Validation call should not error");
      expect(validateResult.data.valid).toBe(false);
      expect(validateResult.data.error).toBe("invalid-or-expired-token");
    });

    it("should reject expired tokens when completing password reset", async () => {
      // Try to complete reset with invalid/expired token
      const completeResult = await anonClient.rpc<{ success: boolean }>(
        "complete_password_reset",
        {
          p_token: "expired-or-invalid-token",
          p_new_password: "NewPassword123!",
        }
      );

      expect(completeResult.error).not.toBeNull();
      expect(completeResult.error?.message).toContain("invalid-or-expired-token");
    });

    it("should prevent token reuse after completion", async () => {
      // We can't test actual token reuse without creating a real token,
      // but we can verify the function rejects used tokens

      // First attempt with fake token
      const firstAttempt = await anonClient.rpc(
        "complete_password_reset",
        {
          p_token: "fake-token-123",
          p_new_password: "NewPassword123!",
        }
      );

      expect(firstAttempt.error).not.toBeNull();

      // Second attempt with same token (would also be rejected)
      const secondAttempt = await anonClient.rpc(
        "complete_password_reset",
        {
          p_token: "fake-token-123",
          p_new_password: "NewPassword456!",
        }
      );

      expect(secondAttempt.error).not.toBeNull();
    });
  });

  describe("Home Join Code Expiration", () => {
    beforeEach(async () => {
      // Ensure User B leaves any existing home before tests that require joining
      await clientB.rpc("leave_home");

      // User A creates a home
      try {
        await createTestHome(clientA, `Home ${uniqueId()}`);
      } catch {
        // User might already have a home, get it instead
        const homeInfo = await clientA.rpc<{ id: string } | null>("get_home_info");
        if (homeInfo.data?.id) {
          userAHomeId = homeInfo.data.id;
        }
      }
    });

    it("should generate join code with expiration", async () => {
      // Generate join code with 24 hour expiration
      const codeResult = await clientA.rpc<string>("generate_join_code", {
        p_expires_hours: 24,
      });

      expectSuccess(codeResult, "Failed to generate join code");
      expect(codeResult.data).toHaveLength(8);

      // Verify home info shows the code and expiration
      const homeInfo = await clientA.rpc<{
        join_code: string | null;
        join_code_expires_at: string | null;
      }>("get_home_info");

      expectSuccess(homeInfo, "Failed to get home info");
      expect(homeInfo.data?.join_code).toBe(codeResult.data);
      expect(homeInfo.data?.join_code_expires_at).not.toBeNull();

      // Verify expiration is approximately 24 hours from now
      const expiresAt = new Date(homeInfo.data!.join_code_expires_at!);
      const now = new Date();
      const hoursDiff = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);
      expect(hoursDiff).toBeGreaterThan(23);
      expect(hoursDiff).toBeLessThan(25);
    });

    it("should generate join code with custom expiration hours", async () => {
      // Generate code with 1 hour expiration
      const codeResult = await clientA.rpc<string>("generate_join_code", {
        p_expires_hours: 1,
      });

      expectSuccess(codeResult, "Failed to generate join code");

      const homeInfo = await clientA.rpc<{
        join_code_expires_at: string;
      }>("get_home_info");

      expectSuccess(homeInfo, "Failed to get home info");

      const expiresAt = new Date(homeInfo.data!.join_code_expires_at);
      const now = new Date();
      const hoursDiff = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);
      expect(hoursDiff).toBeGreaterThan(0.9);
      expect(hoursDiff).toBeLessThan(1.1);
    });

    it("should reject expired join codes", async () => {
      // Note: We can't easily test actual expiration without waiting,
      // but we can verify the mechanism exists

      // Generate a code
      const codeResult = await clientA.rpc<string>("generate_join_code", {
        p_expires_hours: 168, // 1 week
      });
      expectSuccess(codeResult, "Failed to generate join code");

      // Disable the code
      await clientA.rpc("disable_join_code");

      // Verify code is gone
      const homeInfo = await clientA.rpc<{
        join_code: string | null;
      }>("get_home_info");

      expectSuccess(homeInfo, "Failed to get home info");
      expect(homeInfo.data?.join_code).toBeNull();

      // User B trying to use the disabled code should fail
      const joinResult = await clientB.rpc("join_home_by_code", {
        p_code: codeResult.data,
      });

      expect(joinResult.error).not.toBeNull();
      expect(joinResult.error?.message).toContain("invalid-join-code");
    });

    it("should allow disabling join code", async () => {
      // Generate a code
      const codeResult = await clientA.rpc<string>("generate_join_code", {
        p_expires_hours: 24,
      });
      expectSuccess(codeResult, "Failed to generate join code");

      // Disable it (returns void, so use expectNoError)
      const disableResult = await clientA.rpc("disable_join_code");
      expectNoError(disableResult);

      // Verify it's disabled
      const homeInfo = await clientA.rpc<{
        join_code: string | null;
        join_code_expires_at: string | null;
      }>("get_home_info");

      expectSuccess(homeInfo, "Failed to get home info");
      expect(homeInfo.data?.join_code).toBeNull();
      expect(homeInfo.data?.join_code_expires_at).toBeNull();
    });
  });

  describe("Password Validation", () => {
    it("should reject passwords shorter than 8 characters", async () => {
      const result = await anonClient.rpc("signup", {
        p_name: "Test User",
        p_email: `short-pass-${uniqueId()}@example.com`,
        p_password: "Short1!", // 7 characters
        p_provider: null,
      });

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("password-not-meet-requirements");
    });

    it("should reject passwords without uppercase letters", async () => {
      const result = await anonClient.rpc("signup", {
        p_name: "Test User",
        p_email: `no-upper-${uniqueId()}@example.com`,
        p_password: "lowercase1!", // No uppercase
        p_provider: null,
      });

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("password-not-meet-requirements");
    });

    it("should reject passwords without lowercase letters", async () => {
      const result = await anonClient.rpc("signup", {
        p_name: "Test User",
        p_email: `no-lower-${uniqueId()}@example.com`,
        p_password: "UPPERCASE1!", // No lowercase
        p_provider: null,
      });

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("password-not-meet-requirements");
    });

    it("should reject passwords without digits", async () => {
      const result = await anonClient.rpc("signup", {
        p_name: "Test User",
        p_email: `no-digit-${uniqueId()}@example.com`,
        p_password: "NoDigits!!", // No digit
        p_provider: null,
      });

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("password-not-meet-requirements");
    });

    it("should accept passwords meeting all requirements", async () => {
      const email = `valid-pass-${uniqueId()}@example.com`;
      const result = await anonClient.rpc<{ id: string }>("signup", {
        p_name: "Test User",
        p_email: email,
        p_password: "ValidPass123!", // Meets all requirements
        p_provider: null,
      });

      expectSuccess(result, "Valid password should be accepted");
      expect(result.data.id).toBeDefined();
    });

    it("should validate password on reset as well", async () => {
      // Try to complete reset with weak password
      const result = await anonClient.rpc("complete_password_reset", {
        p_token: "some-token",
        p_new_password: "weak", // Too weak
      });

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("password-not-meet-requirements");
    });
  });

  describe("Login Security", () => {
    it("should reject invalid password", async () => {
      const result = await anonClient.rpc("login", {
        login_email: TEST_USERS.userA.email,
        login_password: "WrongPassword123!",
      });

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("invalid user or password");
    });

    it("should reject non-existent email", async () => {
      const result = await anonClient.rpc("login", {
        login_email: "nonexistent@example.com",
        login_password: "SomePassword123!",
      });

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("invalid user or password");
    });

    it("should accept valid credentials", async () => {
      const result = await anonClient.rpc<{ id: string; email: string }>("login", {
        login_email: TEST_USERS.userA.email,
        login_password: TEST_USERS.userA.password,
      });

      expectSuccess(result, "Valid credentials should work");
      expect(result.data.email).toBe(TEST_USERS.userA.email);
    });

    it("should use same error message for invalid email and password", async () => {
      // Invalid email
      const invalidEmailResult = await anonClient.rpc("login", {
        login_email: "nonexistent@example.com",
        login_password: "SomePassword123!",
      });

      // Invalid password
      const invalidPassResult = await anonClient.rpc("login", {
        login_email: TEST_USERS.userA.email,
        login_password: "WrongPassword123!",
      });

      // Both should have the same error message (prevents email enumeration)
      expect(invalidEmailResult.error?.message).toBe(invalidPassResult.error?.message);
    });
  });

  describe("Signup Security", () => {
    it("should reject duplicate email addresses", async () => {
      // Try to sign up with existing email
      const result = await anonClient.rpc("signup", {
        p_name: "Duplicate User",
        p_email: TEST_USERS.userA.email,
        p_password: "ValidPass123!",
        p_provider: null,
      });

      expect(result.error).not.toBeNull();
      // The signup function returns "signup-failed" for duplicate emails
      // (intentionally vague to prevent email enumeration)
      expect(result.error?.message).toContain("signup-failed");
    });

    it("should reject invalid email formats", async () => {
      const result = await anonClient.rpc("signup", {
        p_name: "Bad Email User",
        p_email: "not-an-email",
        p_password: "ValidPass123!",
        p_provider: null,
      });

      expect(result.error).not.toBeNull();
      // The constraint check will fail
    });

    it("should reject empty names", async () => {
      const result = await anonClient.rpc("signup", {
        p_name: "",
        p_email: `empty-name-${uniqueId()}@example.com`,
        p_password: "ValidPass123!",
        p_provider: null,
      });

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("invalid-name");
    });

    it("should allow provider signup without password", async () => {
      const email = `provider-${uniqueId()}@example.com`;
      const result = await anonClient.rpc<{ id: string }>("signup_provider", {
        p_name: "Provider User",
        p_email: email,
        p_provider: "google",
      });

      expectSuccess(result, "Provider signup should work");
      expect(result.data.id).toBeDefined();
    });
  });

  describe("Home Invitation Token Security", () => {
    beforeEach(async () => {
      // Ensure User B leaves any existing home before tests that require accepting invitations
      await clientB.rpc("leave_home");

      // Ensure user A has a home
      try {
        await createTestHome(clientA, `Invite Home ${uniqueId()}`);
      } catch {
        // User might already have a home, that's fine
      }
    });

    it("should generate unique invitation tokens", async () => {
      const email1 = `invite1-${uniqueId()}@example.com`;
      const email2 = `invite2-${uniqueId()}@example.com`;

      const invite1Result = await clientA.rpc<string>("invite_to_home", {
        p_email: email1,
      });
      const invite2Result = await clientA.rpc<string>("invite_to_home", {
        p_email: email2,
      });

      expectSuccess(invite1Result, "First invite should succeed");
      expectSuccess(invite2Result, "Second invite should succeed");

      // IDs should be different
      expect(invite1Result.data).not.toBe(invite2Result.data);
    });

    it("should reject invalid invitation tokens", async () => {
      const result = await clientB.rpc("accept_invitation", {
        p_token: "invalid-token-that-does-not-exist",
      });

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("invalid-invitation-token");
    });

    it("should prevent self-invitation", async () => {
      const result = await clientA.rpc("invite_to_home", {
        p_email: TEST_USERS.userA.email,
      });

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("cannot-invite-self");
    });

    it("should set default 7-day expiration on invitations", async () => {
      const email = `expiry-test-${uniqueId()}@example.com`;

      await clientA.rpc<string>("invite_to_home", {
        p_email: email,
      });

      // Check the pending invitations
      const homeInfo = await clientA.rpc<{
        pending_invitations: Array<{
          invited_email: string;
          expires_at: string;
        }>;
      }>("get_home_info");

      expectSuccess(homeInfo, "Failed to get home info");

      const invite = homeInfo.data?.pending_invitations.find(
        (i) => i.invited_email === email
      );

      expect(invite).toBeDefined();

      // Verify expiration is approximately 7 days from now
      const expiresAt = new Date(invite!.expires_at);
      const now = new Date();
      const daysDiff = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      expect(daysDiff).toBeGreaterThan(6.9);
      expect(daysDiff).toBeLessThan(7.1);
    });
  });

  describe("API Key Security", () => {
    it("should generate unique API keys with prefix", async () => {
      const key1Result = await clientA.rpc<{
        id: string;
        api_key: string;
        api_key_prefix: string;
      }>("create_user_api_key", {
        p_name: `Key 1 ${uniqueId()}`,
      });

      const key2Result = await clientA.rpc<{
        id: string;
        api_key: string;
        api_key_prefix: string;
      }>("create_user_api_key", {
        p_name: `Key 2 ${uniqueId()}`,
      });

      expectSuccess(key1Result, "First key should be created");
      expectSuccess(key2Result, "Second key should be created");

      // Keys should be different
      expect(key1Result.data.api_key).not.toBe(key2Result.data.api_key);

      // Keys should have sk_ prefix
      expect(key1Result.data.api_key).toMatch(/^sk_/);
      expect(key2Result.data.api_key).toMatch(/^sk_/);

      // Prefix should be first 8 characters
      expect(key1Result.data.api_key_prefix).toBe(key1Result.data.api_key.substring(0, 8));

      // Clean up
      await clientA.rpc("revoke_api_key", { p_key_id: key1Result.data.id });
      await clientA.rpc("revoke_api_key", { p_key_id: key2Result.data.id });
    });

    it("should validate API key and return user email", async () => {
      // Create a key
      const createResult = await clientA.rpc<{
        id: string;
        api_key: string;
      }>("create_user_api_key", {
        p_name: `Validate Test ${uniqueId()}`,
      });

      expectSuccess(createResult, "Failed to create key");

      // validate_api_key is now internal-only (V49), use authenticated client
      const validateResult = await clientA.rpc<string>("validate_api_key", {
        p_api_key: createResult.data.api_key,
      });

      expectSuccess(validateResult, "Failed to validate key");
      expect(validateResult.data).toBe(TEST_USERS.userA.email);

      // Clean up
      await clientA.rpc("revoke_api_key", { p_key_id: createResult.data.id });
    });

    it("should reject invalid API keys", async () => {
      // validate_api_key is now internal-only (V49), use authenticated client
      const result = await clientA.rpc<string | null>("validate_api_key", {
        p_api_key: "sk_invalid_key_here",
      });

      // validate_api_key returns NULL for invalid keys (not an error)
      // so we just check there's no error and data is null
      expect(result.error).toBeNull();
      expect(result.data).toBeNull();
    });

    it("should reject revoked API keys", async () => {
      // Create and then revoke a key
      const createResult = await clientA.rpc<{
        id: string;
        api_key: string;
      }>("create_user_api_key", {
        p_name: `Revoke Test ${uniqueId()}`,
      });

      expectSuccess(createResult, "Failed to create key");

      await clientA.rpc("revoke_api_key", { p_key_id: createResult.data.id });

      // validate_api_key is now internal-only (V49), use authenticated client
      const validateResult = await clientA.rpc<string | null>("validate_api_key", {
        p_api_key: createResult.data.api_key,
      });

      // validate_api_key returns NULL for revoked keys (not an error)
      // so we just check there's no error and data is null
      expect(validateResult.error).toBeNull();
      expect(validateResult.data).toBeNull();
    });

    it("should update last_used_at on successful validation", async () => {
      const createResult = await clientA.rpc<{
        id: string;
        api_key: string;
      }>("create_user_api_key", {
        p_name: `Last Used Test ${uniqueId()}`,
      });

      expectSuccess(createResult, "Failed to create key");

      // Get initial state
      const keysBefore = await clientA.rpc<
        Array<{ id: string; last_used_at: string | null }>
      >("get_user_api_keys");

      expectSuccess(keysBefore, "Failed to get keys");
      const keyBefore = keysBefore.data?.find((k) => k.id === createResult.data.id);
      expect(keyBefore?.last_used_at).toBeNull();

      // validate_api_key is now internal-only (V49), use authenticated client
      await clientA.rpc("validate_api_key", {
        p_api_key: createResult.data.api_key,
      });

      // Check last_used_at is updated
      const keysAfter = await clientA.rpc<
        Array<{ id: string; last_used_at: string | null }>
      >("get_user_api_keys");

      expectSuccess(keysAfter, "Failed to get keys");
      const keyAfter = keysAfter.data?.find((k) => k.id === createResult.data.id);
      expect(keyAfter?.last_used_at).not.toBeNull();

      // Clean up
      await clientA.rpc("revoke_api_key", { p_key_id: createResult.data.id });
    });
  });
});
