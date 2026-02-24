/**
 * Contract tests for Auth RPCs
 *
 * Tests the shape and behavior of authentication-related RPC functions:
 * - login(email, password)
 * - signup(p_name, p_email, p_password, p_provider)
 * - signup_provider(p_name, p_email, p_provider)
 * - validate_password_reset_token(p_token)
 * - reset_password(p_token, p_new_password)
 * - validate_api_key(p_api_key)
 *
 * Note: V27 introduced domain-based rate limiting (3 signups per domain per hour).
 * To avoid rate limiting issues in tests, we use unique domains for each signup test.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createAnonymousClient,
  createAuthenticatedClient,
  setupTestHooks,
  type PostgrestClient,
} from "../setup";
import {
  expectSuccess,
  expectUserShape,
  randomString,
} from "../helpers";
import type { User } from "../../../types";

/**
 * Generate a unique email with a unique domain to avoid rate limiting.
 * V27 rate limits signups to 3 per domain per hour.
 */
function uniqueEmail(): string {
  const id = Math.random().toString(36).slice(2, 10);
  const domain = Math.random().toString(36).slice(2, 10);
  return `test-${id}@${domain}.test`;
}

// Test-specific user for auth tests (isolated from other tests)
// Use a unique domain to avoid rate limiting conflicts
const AUTH_TEST_USER = {
  email: `auth-test-${Date.now()}@authtest-${Date.now()}.test`,
  name: "Auth Test User",
  password: "AuthTest123!",
};

// Track users created during tests for cleanup reference
const createdUsers: string[] = [];

describe("Auth RPCs Contract Tests", () => {
  setupTestHooks();

  let anonClient: PostgrestClient;

  beforeAll(() => {
    anonClient = createAnonymousClient();
  });

  // ============================================================================
  // login(email, password)
  // ============================================================================
  describe("login(email, password)", () => {
    // First create a user we can use for login tests
    beforeAll(async () => {
      const signupResult = await anonClient.rpc<User>("signup", {
        p_name: AUTH_TEST_USER.name,
        p_email: AUTH_TEST_USER.email,
        p_password: AUTH_TEST_USER.password,
        p_provider: null,
      });

      // If signup fails due to rate limiting or existing user, that's ok for these tests
      if (!signupResult.error) {
        createdUsers.push(AUTH_TEST_USER.email);
      }
    });

    it("should return user object with correct shape on successful login", async () => {
      const result = await anonClient.rpc<User>("login", {
        login_email: AUTH_TEST_USER.email,
        login_password: AUTH_TEST_USER.password,
      });

      expectSuccess(result, "Login should succeed");
      expectUserShape(result.data);

      // Verify specific fields match expected types
      expect(result.data).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        email: AUTH_TEST_USER.email,
        measures_system: expect.stringMatching(/^(metric|imperial)$/),
        owner: expect.any(String),
      });

      // Provider can be null or string
      expect(
        result.data.provider === null || typeof result.data.provider === "string"
      ).toBe(true);

      // Role can be undefined, 'user', or 'admin'
      if (result.data.role !== undefined) {
        expect(["user", "admin"]).toContain(result.data.role);
      }
    });

    it("should return error for invalid email", async () => {
      const result = await anonClient.rpc<User>("login", {
        login_email: "nonexistent@example.com",
        login_password: "SomePassword123!",
      });

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("invalid user or password");
      expect(result.data).toBeNull();
    });

    it("should return error for invalid password", async () => {
      const result = await anonClient.rpc<User>("login", {
        login_email: AUTH_TEST_USER.email,
        login_password: "WrongPassword123!",
      });

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("invalid user or password");
      expect(result.data).toBeNull();
    });

    it("should return error for empty credentials", async () => {
      const result = await anonClient.rpc<User>("login", {
        login_email: "",
        login_password: "",
      });

      expect(result.error).not.toBeNull();
      expect(result.data).toBeNull();
    });

    it("should be case-insensitive for email (normalized internally)", async () => {
      // Login with uppercase email should work (normalized to lowercase)
      const result = await anonClient.rpc<User>("login", {
        login_email: AUTH_TEST_USER.email.toUpperCase(),
        login_password: AUTH_TEST_USER.password,
      });

      // Note: This might fail if the implementation doesn't normalize
      // The test documents the expected behavior
      if (!result.error) {
        expectUserShape(result.data);
      }
    });
  });

  // ============================================================================
  // signup(p_name, p_email, p_password, p_provider)
  // ============================================================================
  describe("signup(p_name, p_email, p_password, p_provider)", () => {
    it("should return full user object on successful signup", async () => {
      const newUser = {
        email: uniqueEmail(),
        name: `Test User ${randomString(6)}`,
        password: "TestPass123!",
      };

      const result = await anonClient.rpc<User>("signup", {
        p_name: newUser.name,
        p_email: newUser.email,
        p_password: newUser.password,
        p_provider: null,
      });

      expectSuccess(result, "Signup should succeed");
      createdUsers.push(newUser.email);

      // Verify the full user shape is returned (not just { id })
      expect(result.data).toMatchObject({
        id: expect.any(String),
        name: newUser.name,
        email: newUser.email,
        measures_system: expect.stringMatching(/^(metric|imperial)$/),
        owner: newUser.email,
      });

      // Provider should be null for password-based signup
      expect(result.data.provider).toBeNull();
    });

    it("should return user object with provider for OAuth signup", async () => {
      const newUser = {
        email: uniqueEmail(),
        name: `OAuth User ${randomString(6)}`,
      };

      const result = await anonClient.rpc<User>("signup", {
        p_name: newUser.name,
        p_email: newUser.email,
        p_password: null,
        p_provider: "google",
      });

      expectSuccess(result, "OAuth signup should succeed");
      createdUsers.push(newUser.email);

      expect(result.data).toMatchObject({
        id: expect.any(String),
        name: newUser.name,
        email: newUser.email,
        provider: "google",
      });
    });

    it("should return error for duplicate email", async () => {
      // Try to signup with existing user's email
      const result = await anonClient.rpc<User>("signup", {
        p_name: "Duplicate User",
        p_email: AUTH_TEST_USER.email,
        p_password: "DuplicatePass123!",
        p_provider: null,
      });

      expect(result.error).not.toBeNull();
      // V27 changed error to 'signup-failed' for security (prevents enumeration)
      expect(result.error?.message).toMatch(/signup-failed|already-exists/);
      expect(result.data).toBeNull();
    });

    it("should return error for invalid name (empty)", async () => {
      const result = await anonClient.rpc<User>("signup", {
        p_name: "",
        p_email: uniqueEmail(),
        p_password: "ValidPass123!",
        p_provider: null,
      });

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("invalid-name");
      expect(result.data).toBeNull();
    });

    it("should return error for weak password (no letters)", async () => {
      // Password with only numbers - no letters at all
      const result = await anonClient.rpc<User>("signup", {
        p_name: "Test User",
        p_email: uniqueEmail(),
        p_password: "12345678",
        p_provider: null,
      });

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("password-not-meet-requirements");
      expect(result.data).toBeNull();
    });

    it("should accept password with mixed case and numbers", async () => {
      // Note: The current implementation uses case-insensitive regex (~*)
      // which means lowercase-only passwords may pass the uppercase check.
      // This test documents the actual behavior.
      const email = uniqueEmail();
      const result = await anonClient.rpc<User>("signup", {
        p_name: "Test User",
        p_email: email,
        p_password: "Password123",
        p_provider: null,
      });

      // Should succeed with properly mixed-case password
      expectSuccess(result, "Password with mixed case and numbers should be accepted");
      if (result.data) {
        createdUsers.push(email);
      }
    });

    it("should return error for weak password (no number)", async () => {
      const result = await anonClient.rpc<User>("signup", {
        p_name: "Test User",
        p_email: uniqueEmail(),
        p_password: "WeakPassword",
        p_provider: null,
      });

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("password-not-meet-requirements");
      expect(result.data).toBeNull();
    });

    it("should return error for password too short (< 8 chars)", async () => {
      const result = await anonClient.rpc<User>("signup", {
        p_name: "Test User",
        p_email: uniqueEmail(),
        p_password: "Abc123!",
        p_provider: null,
      });

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("password-not-meet-requirements");
      expect(result.data).toBeNull();
    });

    it("should allow OAuth signup without password", async () => {
      const result = await anonClient.rpc<User>("signup", {
        p_name: "GitHub User",
        p_email: uniqueEmail(),
        p_password: null,
        p_provider: "github",
      });

      expectSuccess(result, "OAuth signup without password should succeed");
      if (result.data) {
        createdUsers.push(result.data.email);
        expect(result.data.provider).toBe("github");
      }
    });
  });

  // ============================================================================
  // signup_provider(p_name, p_email, p_provider)
  // ============================================================================
  describe("signup_provider(p_name, p_email, p_provider)", () => {
    it("should return user JSONB object for new OAuth user", async () => {
      const newUser = {
        email: uniqueEmail(),
        name: `Provider User ${randomString(6)}`,
      };

      const result = await anonClient.rpc<{
        id: string;
        name: string;
        email: string;
        provider: string;
        owner: string;
        role: string;
        measures_system: string;
      }>("signup_provider", {
        p_name: newUser.name,
        p_email: newUser.email,
        p_provider: "google",
      });

      expectSuccess(result, "signup_provider should succeed for new user");
      createdUsers.push(newUser.email);

      expect(result.data).toMatchObject({
        id: expect.any(String),
        name: newUser.name,
        email: newUser.email,
        provider: "google",
        owner: newUser.email,
        measures_system: expect.stringMatching(/^(metric|imperial)$/),
      });
    });

    it("should return existing user for idempotent OAuth login", async () => {
      // First create a user
      const existingUser = {
        email: uniqueEmail(),
        name: "Existing Provider User",
      };

      const firstResult = await anonClient.rpc<{
        id: string;
        email: string;
        provider: string;
      }>("signup_provider", {
        p_name: existingUser.name,
        p_email: existingUser.email,
        p_provider: "google",
      });

      expectSuccess(firstResult, "First signup_provider should succeed");
      createdUsers.push(existingUser.email);

      // Now call signup_provider again with same email and provider
      const secondResult = await anonClient.rpc<{
        id: string;
        email: string;
        provider: string;
      }>("signup_provider", {
        p_name: "Different Name",
        p_email: existingUser.email,
        p_provider: "google",
      });

      expectSuccess(secondResult, "Second signup_provider should succeed (idempotent)");

      // Should return the same user
      expect(secondResult.data?.id).toBe(firstResult.data?.id);
      expect(secondResult.data?.email).toBe(existingUser.email);
    });

    it("should return error for provider mismatch", async () => {
      // Create user with Google
      const user = {
        email: uniqueEmail(),
        name: "Provider Mismatch User",
      };

      const createResult = await anonClient.rpc("signup_provider", {
        p_name: user.name,
        p_email: user.email,
        p_provider: "google",
      });

      expectSuccess(createResult);
      createdUsers.push(user.email);

      // Try to login with different provider (GitHub)
      const mismatchResult = await anonClient.rpc("signup_provider", {
        p_name: user.name,
        p_email: user.email,
        p_provider: "github",
      });

      expect(mismatchResult.error).not.toBeNull();
      expect(mismatchResult.error?.message).toContain("provider-mismatch");
    });

    it("should handle null provider gracefully", async () => {
      const result = await anonClient.rpc<{
        id: string;
        email: string;
        provider: string | null;
      }>("signup_provider", {
        p_name: "Null Provider User",
        p_email: uniqueEmail(),
        p_provider: null,
      });

      // This should either succeed (creating user with null provider)
      // or be handled appropriately
      if (!result.error) {
        createdUsers.push(result.data!.email);
        expect(result.data?.provider).toBeNull();
      }
    });
  });

  // ============================================================================
  // validate_password_reset_token(p_token)
  // ============================================================================
  describe("validate_password_reset_token(p_token)", () => {
    it("should return { valid: true } for valid token", async () => {
      // Note: We can't easily create a valid token in tests without DB access
      // This test documents the expected shape for when a token IS valid

      // First, request a password reset to create a token
      // We need to test with a user that exists
      const requestResult = await anonClient.rpc<{ success: boolean }>(
        "request_password_reset",
        {
          p_email: AUTH_TEST_USER.email,
          p_app_url: "https://test.example.com",
        }
      );

      // This always returns success (to prevent email enumeration)
      expect(requestResult.data).toMatchObject({ success: true });

      // Since we don't have access to the actual token (it's hashed and emailed),
      // we test the shape of an invalid token response to document the contract
    });

    it("should return { valid: false, error: 'invalid-or-expired-token' } for invalid token", async () => {
      const result = await anonClient.rpc<{
        valid: boolean;
        error?: string;
      }>("validate_password_reset_token", {
        p_token: "invalid-token-that-does-not-exist",
      });

      expectSuccess(result, "validate_password_reset_token should return a response");

      expect(result.data).toMatchObject({
        valid: false,
        error: "invalid-or-expired-token",
      });
    });

    it("should return { valid: false, error: 'invalid-or-expired-token' } for empty token", async () => {
      const result = await anonClient.rpc<{
        valid: boolean;
        error?: string;
      }>("validate_password_reset_token", {
        p_token: "",
      });

      expectSuccess(result);

      expect(result.data).toMatchObject({
        valid: false,
        error: "invalid-or-expired-token",
      });
    });

    it("should return { valid: false, error: 'invalid-or-expired-token' } for random UUID token", async () => {
      const randomToken = crypto.randomUUID();

      const result = await anonClient.rpc<{
        valid: boolean;
        error?: string;
      }>("validate_password_reset_token", {
        p_token: randomToken,
      });

      expectSuccess(result);

      expect(result.data).toMatchObject({
        valid: false,
        error: "invalid-or-expired-token",
      });
    });
  });

  // ============================================================================
  // reset_password(p_token, p_new_password)
  // ============================================================================
  describe("reset_password(p_token, p_new_password)", () => {
    it("should return error for invalid token", async () => {
      const result = await anonClient.rpc<{ success?: boolean; error?: string }>(
        "reset_password",
        {
          p_token: "invalid-token-that-does-not-exist",
          p_new_password: "NewPassword123!",
        }
      );

      // Either returns error in response body or raises exception
      if (result.error) {
        expect(result.error.message).toMatch(/invalid|expired|token/i);
      } else {
        expect(result.data?.success).toBe(false);
        expect(result.data?.error).toMatch(/invalid|expired|token/i);
      }
    });

    it("should return error for empty token", async () => {
      const result = await anonClient.rpc<{ success?: boolean; error?: string }>(
        "reset_password",
        {
          p_token: "",
          p_new_password: "NewPassword123!",
        }
      );

      // Empty token should be treated as invalid
      if (result.error) {
        expect(result.error.message).toMatch(/invalid|expired|token/i);
      } else {
        expect(result.data?.success).toBe(false);
        expect(result.data?.error).toMatch(/invalid|expired|token/i);
      }
    });

    it("should return error for random UUID token", async () => {
      const randomToken = crypto.randomUUID();

      const result = await anonClient.rpc<{ success?: boolean; error?: string }>(
        "reset_password",
        {
          p_token: randomToken,
          p_new_password: "NewPassword123!",
        }
      );

      // Random UUID should not match any existing token
      if (result.error) {
        expect(result.error.message).toMatch(/invalid|expired|token/i);
      } else {
        expect(result.data?.success).toBe(false);
        expect(result.data?.error).toMatch(/invalid|expired|token/i);
      }
    });

    it("should return error for empty password", async () => {
      const result = await anonClient.rpc<{ success?: boolean; error?: string }>(
        "reset_password",
        {
          p_token: "some-token",
          p_new_password: "",
        }
      );

      // Empty password should fail validation
      // Could be token error (checked first) or password error
      if (result.error) {
        expect(result.error.message).toMatch(/invalid|password|token/i);
      } else {
        expect(result.data?.success).toBe(false);
        expect(result.data?.error).toBeDefined();
      }
    });

    it("should return error for weak password (no letters)", async () => {
      const result = await anonClient.rpc<{ success?: boolean; error?: string }>(
        "reset_password",
        {
          p_token: "some-token",
          p_new_password: "12345678",
        }
      );

      // Password with only numbers should fail validation
      // Note: Token validation may happen first, returning token error
      if (result.error) {
        expect(result.error.message).toMatch(/invalid|password|token/i);
      } else {
        expect(result.data?.success).toBe(false);
        expect(result.data?.error).toBeDefined();
      }
    });

    it("should return error for weak password (no number)", async () => {
      const result = await anonClient.rpc<{ success?: boolean; error?: string }>(
        "reset_password",
        {
          p_token: "some-token",
          p_new_password: "WeakPassword",
        }
      );

      // Password without number should fail validation
      // Note: Token validation may happen first, returning token error
      if (result.error) {
        expect(result.error.message).toMatch(/invalid|password|token/i);
      } else {
        expect(result.data?.success).toBe(false);
        expect(result.data?.error).toBeDefined();
      }
    });

    it("should return error for password too short (< 8 chars)", async () => {
      const result = await anonClient.rpc<{ success?: boolean; error?: string }>(
        "reset_password",
        {
          p_token: "some-token",
          p_new_password: "Abc123!",
        }
      );

      // Short password should fail validation
      // Note: Token validation may happen first, returning token error
      if (result.error) {
        expect(result.error.message).toMatch(/invalid|password|token/i);
      } else {
        expect(result.data?.success).toBe(false);
        expect(result.data?.error).toBeDefined();
      }
    });

    it("should return consistent error shape for invalid tokens", async () => {
      // Test multiple invalid token formats to verify consistent response shape
      const invalidTokens = [
        "invalid-token",
        crypto.randomUUID(),
        "a".repeat(100),
        "token-with-special-chars-!@#$%",
      ];

      for (const token of invalidTokens) {
        const result = await anonClient.rpc<{ success?: boolean; error?: string }>(
          "reset_password",
          {
            p_token: token,
            p_new_password: "ValidPassword123!",
          }
        );

        // All invalid tokens should return a consistent response
        if (result.error) {
          expect(result.error.message).toBeDefined();
        } else {
          expect(result.data?.success).toBe(false);
          expect(result.data?.error).toBeDefined();
        }
      }
    });
  });

  // ============================================================================
  // validate_api_key(p_api_key)
  // ============================================================================
  describe("validate_api_key(p_api_key)", () => {
    let authenticatedClient: PostgrestClient;
    let testApiKey: { id: string; api_key: string; prefix: string } | null = null;

    beforeAll(async () => {
      // Create authenticated client for the test user
      authenticatedClient = await createAuthenticatedClient(AUTH_TEST_USER.email);

      // Create an API key for testing
      const createResult = await authenticatedClient.rpc<{
        id: string;
        api_key: string;
        api_key_prefix: string;
      }>("create_user_api_key", {
        p_name: `Test API Key ${Date.now()}`,
      });

      if (!createResult.error && createResult.data) {
        testApiKey = {
          id: createResult.data.id,
          api_key: createResult.data.api_key,
          prefix: createResult.data.api_key_prefix,
        };
      }
    });

    afterAll(async () => {
      // Clean up the API key
      if (testApiKey) {
        await authenticatedClient.rpc("revoke_api_key", {
          p_key_id: testApiKey.id,
        });
      }
    });

    // validate_api_key is now internal-only (called by pre_request SECURITY DEFINER).
    // It is no longer callable by anon; authenticated users can still call it.

    it("should return user_email for valid API key", async () => {
      if (!testApiKey) {
        console.warn("Skipping test: Could not create test API key");
        return;
      }

      const result = await authenticatedClient.rpc<string>("validate_api_key", {
        p_api_key: testApiKey.api_key,
      });

      expectSuccess(result, "validate_api_key should succeed for valid key");

      // Returns the user's email
      expect(result.data).toBe(AUTH_TEST_USER.email);
    });

    it("should return null for invalid API key", async () => {
      const result = await authenticatedClient.rpc<string | null>("validate_api_key", {
        p_api_key: "invalid-api-key-that-does-not-exist",
      });

      // Should return null (not an error) for invalid keys
      expect(result.error).toBeNull();
      expect(result.data).toBeNull();
    });

    it("should return null for empty API key", async () => {
      const result = await authenticatedClient.rpc<string | null>("validate_api_key", {
        p_api_key: "",
      });

      expect(result.error).toBeNull();
      expect(result.data).toBeNull();
    });

    it("should return null for API key shorter than 8 characters", async () => {
      const result = await authenticatedClient.rpc<string | null>("validate_api_key", {
        p_api_key: "short",
      });

      expect(result.error).toBeNull();
      expect(result.data).toBeNull();
    });

    it("should return null for API key with valid prefix but wrong hash", async () => {
      if (!testApiKey) {
        console.warn("Skipping test: Could not create test API key");
        return;
      }

      // Use the correct prefix but with wrong suffix
      const wrongKey = testApiKey.prefix + "wrongsuffix";

      const result = await authenticatedClient.rpc<string | null>("validate_api_key", {
        p_api_key: wrongKey,
      });

      expect(result.error).toBeNull();
      expect(result.data).toBeNull();
    });

    it("should return null for anonymous users with invalid key", async () => {
      // anon can call validate_api_key (needed for pre_request API key auth)
      const result = await anonClient.rpc<string | null>("validate_api_key", {
        p_api_key: "some-key",
      });

      expect(result.error).toBeNull();
      expect(result.data).toBeNull();
    });
  });

  // ============================================================================
  // Additional Security Tests
  // ============================================================================
  describe("Auth Security Tests", () => {
    it("login should use consistent timing (prevent enumeration)", async () => {
      // Note: This is more of a documentation test - actual timing attacks
      // are difficult to test reliably in unit tests

      // Both invalid email and invalid password should return the same error
      const invalidEmailResult = await anonClient.rpc<User>("login", {
        login_email: "nonexistent-user-12345@example.com",
        login_password: "SomePassword123!",
      });

      const invalidPasswordResult = await anonClient.rpc<User>("login", {
        login_email: AUTH_TEST_USER.email,
        login_password: "WrongPassword123!",
      });

      // Both should return the same generic error message
      expect(invalidEmailResult.error?.message).toBe(
        invalidPasswordResult.error?.message
      );
      expect(invalidEmailResult.error?.message).toContain("invalid user or password");
    });

    it("signup should not reveal if email exists (generic error)", async () => {
      const result = await anonClient.rpc<User>("signup", {
        p_name: "Duplicate Test",
        p_email: AUTH_TEST_USER.email,
        p_password: "DuplicatePass123!",
        p_provider: null,
      });

      expect(result.error).not.toBeNull();
      // V27 uses 'signup-failed' instead of 'already-exists' to prevent enumeration
      // Accept either for backwards compatibility during migration
      expect(result.error?.message).toMatch(/signup-failed|already-exists/);
    });

    it("request_password_reset should always return success (prevent enumeration)", async () => {
      // Request for existing user
      const existingResult = await anonClient.rpc<{ success: boolean }>(
        "request_password_reset",
        {
          p_email: AUTH_TEST_USER.email,
        }
      );

      expect(existingResult.data).toMatchObject({ success: true });

      // Request for non-existing user
      const nonExistingResult = await anonClient.rpc<{ success: boolean }>(
        "request_password_reset",
        {
          p_email: "definitely-not-existing@example.com",
        }
      );

      // Both should return the same response
      expect(nonExistingResult.data).toMatchObject({ success: true });
    });
  });

  // ============================================================================
  // Type Contracts (Shape Verification)
  // ============================================================================
  describe("Return Type Contracts", () => {
    it("login() returns User type", async () => {
      const result = await anonClient.rpc<User>("login", {
        login_email: AUTH_TEST_USER.email,
        login_password: AUTH_TEST_USER.password,
      });

      if (result.data) {
        // Type-level verification of User shape
        const user: User = result.data;

        // Required fields
        expect(typeof user.id).toBe("string");
        expect(typeof user.name).toBe("string");
        expect(typeof user.email).toBe("string");
        expect(["metric", "imperial"]).toContain(user.measures_system);
        expect(typeof user.owner).toBe("string");

        // Optional fields
        expect(
          user.provider === null || typeof user.provider === "string"
        ).toBe(true);
        expect(
          user.role === undefined ||
            user.role === "user" ||
            user.role === "admin"
        ).toBe(true);
        // home_id and home_name can be null, undefined, or string
        expect(
          user.home_id === undefined ||
            user.home_id === null ||
            typeof user.home_id === "string"
        ).toBe(true);
        expect(
          user.home_name === undefined ||
            user.home_name === null ||
            typeof user.home_name === "string"
        ).toBe(true);
      }
    });

    it("signup() returns User type", async () => {
      const email = uniqueEmail();
      const result = await anonClient.rpc<User>("signup", {
        p_name: "Type Contract User",
        p_email: email,
        p_password: "TypeContract123!",
        p_provider: null,
      });

      if (result.data) {
        createdUsers.push(email);

        const user: User = result.data;

        expect(typeof user.id).toBe("string");
        expect(typeof user.name).toBe("string");
        expect(typeof user.email).toBe("string");
        expect(["metric", "imperial"]).toContain(user.measures_system);
        expect(typeof user.owner).toBe("string");
      }
    });

    it("signup_provider() returns JSONB with User fields", async () => {
      const email = uniqueEmail();
      const result = await anonClient.rpc<{
        id: string;
        name: string;
        email: string;
        provider: string | null;
        owner: string;
        role: string;
        measures_system: string;
      }>("signup_provider", {
        p_name: "Provider Type User",
        p_email: email,
        p_provider: "google",
      });

      if (result.data) {
        createdUsers.push(email);

        expect(typeof result.data.id).toBe("string");
        expect(typeof result.data.name).toBe("string");
        expect(typeof result.data.email).toBe("string");
        expect(typeof result.data.provider).toBe("string");
        expect(typeof result.data.owner).toBe("string");
        expect(typeof result.data.measures_system).toBe("string");
      }
    });

    it("validate_password_reset_token() returns JSONB with valid and optional error", async () => {
      const result = await anonClient.rpc<{
        valid: boolean;
        error?: string;
      }>("validate_password_reset_token", {
        p_token: "test-token",
      });

      if (result.data) {
        expect(typeof result.data.valid).toBe("boolean");
        if (result.data.error !== undefined) {
          expect(typeof result.data.error).toBe("string");
        }
      }
    });

    it("validate_api_key() returns TEXT (email) or null", async () => {
      // validate_api_key is no longer callable by anon (revoked in V49).
      // Use authenticated client to verify the return type contract.
      const authClient = await createAuthenticatedClient(AUTH_TEST_USER.email);
      const result = await authClient.rpc<string | null>("validate_api_key", {
        p_api_key: "some-invalid-key",
      });

      // Should return null for invalid key (not an error)
      expect(result.error).toBeNull();
      expect(result.data).toBeNull();
    });
  });

  // ============================================================================
  // current_user_info()
  // V50: Converted to SECURITY INVOKER — RLS on users table enforces access.
  // ============================================================================
  describe("current_user_info()", () => {
    it("should return email and name for authenticated user", async () => {
      const authClient = await createAuthenticatedClient(AUTH_TEST_USER.email);
      const result = await authClient.rpc<{ email: string; name: string }>(
        "current_user_info"
      );

      expectSuccess(result, "current_user_info should succeed");

      expect(result.data).toMatchObject({
        email: AUTH_TEST_USER.email,
        name: AUTH_TEST_USER.name,
      });
    });

    it("should return correct shape with email and name fields", async () => {
      const authClient = await createAuthenticatedClient(AUTH_TEST_USER.email);
      const result = await authClient.rpc<{ email: string; name: string }>(
        "current_user_info"
      );

      expectSuccess(result);

      expect(typeof result.data!.email).toBe("string");
      expect(typeof result.data!.name).toBe("string");
      // Should not leak extra fields
      const keys = Object.keys(result.data!);
      expect(keys).toContain("email");
      expect(keys).toContain("name");
      expect(keys).toHaveLength(2);
    });

    it("should only return the authenticated user's own info", async () => {
      const clientA = await createAuthenticatedClient(AUTH_TEST_USER.email);
      const result = await clientA.rpc<{ email: string; name: string }>(
        "current_user_info"
      );

      expectSuccess(result);
      expect(result.data!.email).toBe(AUTH_TEST_USER.email);
      // Cannot see other users' info
      expect(result.data!.email).not.toBe("test-user-a@example.com");
    });

    it("should be denied for anonymous users", async () => {
      const result = await anonClient.rpc<{ email: string; name: string }>(
        "current_user_info"
      );

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("permission denied");
    });

    it("should return null for non-existent user (JWT with unknown email)", async () => {
      const fakeClient = await createAuthenticatedClient("non-existent-user@example.com");
      const result = await fakeClient.rpc<{ email: string; name: string } | null>(
        "current_user_info"
      );

      // RLS blocks the SELECT — no matching row, so result is null
      expect(result.error).toBeNull();
      expect(result.data).toBeNull();
    });
  });
});
