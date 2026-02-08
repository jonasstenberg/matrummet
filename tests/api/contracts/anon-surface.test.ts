/**
 * Contract tests for V50/V51 anon surface area restriction
 *
 * Verifies the security properties introduced by
 * V50__restrict_anon_tables_and_public_functions.sql and
 * V51__move_extensions_to_separate_schema.sql:
 *
 * 1. Anon table access revoked except whitelisted public tables
 * 2. Anon CAN read recipe content tables (ingredients, instructions, etc.)
 * 3. Extension functions (pgcrypto, uuid-ossp, pg_trgm) not callable by anon
 * 4. debug_admin_check dropped/inaccessible
 * 5. Authenticated retains full table and function access
 * 6. Anon can still browse recipes and use public search
 * 7. Application functions using extensions still work after schema move
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

describe("V50: Anon Surface Area Restriction", () => {
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
  // 1. Sensitive tables blocked for anon
  // ==========================================================================
  describe("Sensitive tables blocked for anon", () => {
    it("anon cannot SELECT from users table", async () => {
      const result = await anonClient.from("users").select("id,email");

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("permission denied");
    });

    it("anon cannot SELECT from user_passwords table", async () => {
      const result = await anonClient.from("user_passwords").select("email");

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("permission denied");
    });

    it("anon cannot SELECT from email_messages table", async () => {
      const result = await anonClient.from("email_messages").select("id");

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("permission denied");
    });

    it("anon cannot SELECT from password_reset_tokens table", async () => {
      const result = await anonClient
        .from("password_reset_tokens")
        .select("id");

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("permission denied");
    });

    it("anon CAN SELECT from foods table (approved only via RLS)", async () => {
      // V2: foods now readable by anon, RLS restricts to approved only
      const result = await anonClient.from("foods").select("id").limit(1);

      // No error - but RLS will filter to only approved foods
      expect(result.error).toBeNull();
    });

    it("anon CAN SELECT from units table", async () => {
      // V2: units now readable by anon (public reference data)
      const result = await anonClient.from("units").select("id").limit(1);

      expect(result.error).toBeNull();
    });

    it("anon cannot SELECT from food_review_logs table", async () => {
      const result = await anonClient
        .from("food_review_logs")
        .select("id")
        .limit(1);

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("permission denied");
    });

    it("anon cannot INSERT into recipes table", async () => {
      const result = await anonClient.from("recipes").insert({
        name: "Hack Attempt",
        owner: "hacker@example.com",
      });

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("permission denied");
    });
  });

  // ==========================================================================
  // 2. Anon CAN read recipe content tables (public browsing)
  // ==========================================================================
  describe("Anon public table whitelist", () => {
    it("anon can SELECT from recipes table", async () => {
      const result = await anonClient
        .from("recipes")
        .select("id,name")
        .limit(1);

      expect(result.error).toBeNull();
      expect(result.status).toBe(200);
    });

    // public_recipes view has been removed - recipes require authentication

    it("anon can SELECT from ingredients table", async () => {
      const result = await anonClient
        .from("ingredients")
        .select("id")
        .limit(1);

      expect(result.error).toBeNull();
      expect(result.status).toBe(200);
    });

    it("anon can SELECT from instructions table", async () => {
      const result = await anonClient
        .from("instructions")
        .select("id")
        .limit(1);

      expect(result.error).toBeNull();
      expect(result.status).toBe(200);
    });

    it("anon can SELECT from categories table", async () => {
      const result = await anonClient
        .from("categories")
        .select("id,name")
        .limit(1);

      expect(result.error).toBeNull();
      expect(result.status).toBe(200);
    });

    it("anon can SELECT from recipe_categories table", async () => {
      const result = await anonClient
        .from("recipe_categories")
        .select("recipe,category")
        .limit(1);

      expect(result.error).toBeNull();
      expect(result.status).toBe(200);
    });

    it("anon can SELECT from ingredient_groups table", async () => {
      const result = await anonClient
        .from("ingredient_groups")
        .select("id")
        .limit(1);

      expect(result.error).toBeNull();
      expect(result.status).toBe(200);
    });

    it("anon can SELECT from instruction_groups table", async () => {
      const result = await anonClient
        .from("instruction_groups")
        .select("id")
        .limit(1);

      expect(result.error).toBeNull();
      expect(result.status).toBe(200);
    });

    it("anon cannot INSERT into whitelisted tables (SELECT only)", async () => {
      const result = await anonClient.from("categories").insert({
        name: "Hack Attempt",
      });

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("permission denied");
    });
  });

  // ==========================================================================
  // 3. Extension functions not callable by anon
  //    After V51, functions are moved to extensions schema (not in db-schemas),
  //    so PostgREST returns 404 instead of permission denied.
  // ==========================================================================
  describe("Extension functions hidden from anon", () => {
    it("anon cannot call gen_random_uuid (pgcrypto)", async () => {
      const result = await anonClient.rpc("gen_random_uuid");

      expect(result.error).not.toBeNull();
      expect(result.status).not.toBe(200);
    });

    it("anon cannot call uuid_generate_v4 (uuid-ossp)", async () => {
      const result = await anonClient.rpc("uuid_generate_v4");

      expect(result.error).not.toBeNull();
      expect(result.status).not.toBe(200);
    });

    it("anon cannot call show_trgm (pg_trgm)", async () => {
      const result = await anonClient.rpc("show_trgm", {
        "": "test",
      });

      expect(result.error).not.toBeNull();
      expect(result.status).not.toBe(200);
    });

    it("anon cannot call gen_salt (pgcrypto)", async () => {
      const result = await anonClient.rpc("gen_salt", {
        "": "bf",
      });

      expect(result.error).not.toBeNull();
      expect(result.status).not.toBe(200);
    });
  });

  // ==========================================================================
  // 4. debug_admin_check is inaccessible
  // ==========================================================================
  describe("debug_admin_check removed", () => {
    it("anon cannot call debug_admin_check", async () => {
      const result = await anonClient.rpc("debug_admin_check");

      expect(result.error).not.toBeNull();
      expect(result.status).not.toBe(200);
    });

    it("authenticated cannot call debug_admin_check (function dropped)", async () => {
      const result = await authClient.rpc("debug_admin_check");

      expect(result.error).not.toBeNull();
    });
  });

  // ==========================================================================
  // 5. Authenticated retains full access after PUBLIC revoke
  // ==========================================================================
  describe("Authenticated access preserved after PUBLIC revoke", () => {
    it("authenticated can SELECT from users table", async () => {
      const result = await authClient
        .from("users")
        .select("id,email")
        .limit(1);

      expect(result.error).toBeNull();
      expect(result.status).toBe(200);
    });

    it("authenticated can SELECT from foods table", async () => {
      const result = await authClient.from("foods").select("id").limit(1);

      expect(result.error).toBeNull();
      expect(result.status).toBe(200);
    });

    it("authenticated can SELECT from user_recipes", async () => {
      const result = await authClient
        .from("user_recipes")
        .select("id,name")
        .limit(1);

      expect(result.error).toBeNull();
      expect(result.status).toBe(200);
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

      expect(result.error).toBeNull();
    });
  });

  // ==========================================================================
  // 6. Anon public endpoints still work
  // ==========================================================================
  describe("Anon public endpoints preserved", () => {
    // search_public_recipes has been removed - recipes require authentication

    it("anon can call login (callable, credentials checked)", async () => {
      const result = await anonClient.rpc("login", {
        login_email: "nonexistent@example.com",
        login_password: "WrongPassword123!",
      });

      // Callable but credentials fail — NOT "permission denied"
      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("invalid user or password");
      expect(result.error?.message).not.toContain("permission denied");
    });

    it("anon can call signup (callable)", async () => {
      const result = await anonClient.rpc("signup", {
        p_name: "Test",
        p_email: `anon-surface-test-${Date.now()}@example.com`,
        p_password: "TestPassword123!",
        p_provider: null,
      });

      // Should be callable (may succeed or fail based on rate limiting)
      if (result.error) {
        expect(result.error.message).not.toContain("permission denied");
      }
    });
  });

  // ==========================================================================
  // 7. V51: Application functions using extensions still work after schema move
  //    These functions use pgcrypto (crypt/gen_salt) or pg_trgm (word_similarity)
  //    and must continue working with search_path = public, extensions.
  // ==========================================================================
  describe("Extension-dependent functions work after V51 schema move", () => {
    it("login still works (uses pgcrypto crypt)", async () => {
      const result = await anonClient.rpc("login", {
        login_email: "nonexistent@example.com",
        login_password: "WrongPassword123!",
      });

      // Callable — error is about invalid credentials, NOT a function/extension error
      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("invalid user or password");
    });

    // search_public_recipes has been removed - recipes require authentication

    it("authenticated search_foods still works", async () => {
      const result = await authClient.rpc("search_foods", {
        p_query: "salt",
      });

      expect(result.error).toBeNull();
      expect(result.status).toBe(200);
    });

    it("authenticated validate_api_key still works (uses pgcrypto crypt)", async () => {
      const result = await authClient.rpc("validate_api_key", {
        p_api_key: "nonexistent-key",
      });

      expect(result.error).toBeNull();
    });

    it("authenticated create_user_api_key works (uses pgcrypto gen_random_bytes/crypt)", async () => {
      const result = await authClient.rpc("create_user_api_key", {
        p_name: `V51 Test Key ${Date.now()}`,
      });

      expect(result.error).toBeNull();
      expect(result.status).toBe(200);
    });
  });
});
