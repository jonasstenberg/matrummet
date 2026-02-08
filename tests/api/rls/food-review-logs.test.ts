/**
 * RLS Security Tests for food_review_logs Table
 *
 * This table is an internal audit log for AI and admin food reviews.
 * It should be:
 * - Admin-only for SELECT (contains admin emails and internal AI reasoning)
 * - No direct INSERT (inserts happen via apply_ai_food_review which is SECURITY DEFINER)
 * - No UPDATE or DELETE (audit logs are immutable)
 *
 * Note: Test admin user is seeded via tests/api/seed-admin.sql before tests run.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  createAuthenticatedClient,
  createAdminClient,
  createAnonymousClient,
  setupTestHooks,
  TEST_USERS,
  type PostgrestClient,
} from "../setup";
import {
  createTestUser,
  cleanupTestData,
  resetCreatedResources,
  getOrCreateFood,
} from "../seed";
import { expectSuccess, expectRlsBlocked, expectError } from "../helpers";

// =============================================================================
// Test Setup
// =============================================================================

setupTestHooks();

describe("RLS Security Tests - food_review_logs", () => {
  let clientA: PostgrestClient;
  let adminClient: PostgrestClient;
  let anonClient: PostgrestClient;
  let testFoodId: string;

  beforeAll(async () => {
    // Create regular test user
    await createTestUser(TEST_USERS.userA);

    // Create clients
    // Regular user
    clientA = await createAuthenticatedClient(TEST_USERS.userA.email);
    // Admin user (seeded via seed-admin.sql before tests)
    adminClient = await createAdminClient(TEST_USERS.admin.email);
    anonClient = createAnonymousClient();

    // Create a test food item for the review logs
    const foodResult = await getOrCreateFood(clientA, "Test Food for Review Logs");
    testFoodId = foodResult.id;

    // Create a review log entry using apply_ai_food_review (SECURITY DEFINER function)
    // This is the proper way to insert into food_review_logs
    const reviewResult = await adminClient.rpc("apply_ai_food_review", {
      p_food_id: testFoodId,
      p_decision: "approved",
      p_reasoning: "Test food review for RLS testing",
      p_confidence: 0.95,
      p_suggested_merge_id: null,
      p_cron_secret: null,
    });

    // The function may fail if food is already reviewed or other conditions
    // That's OK - we just need some review log entries to test against
    if (reviewResult.error) {
      console.log(`Note: apply_ai_food_review returned: ${reviewResult.error.message}`);
    }
  });

  beforeEach(() => {
    resetCreatedResources();
  });

  afterAll(async () => {
    await cleanupTestData(TEST_USERS.userA.email);
  });

  // ===========================================================================
  // SELECT TESTS
  // ===========================================================================

  describe("SELECT Operations", () => {
    it("admin can SELECT from food_review_logs", async () => {
      const result = await adminClient
        .from("food_review_logs")
        .select("*")
        .limit(10);

      expectSuccess(result, "Admin should be able to SELECT from food_review_logs");
      expect(Array.isArray(result.data)).toBe(true);
      // Admin should see review logs (may be 0 if none exist, but query should succeed)
    });

    it("regular user cannot SELECT from food_review_logs", async () => {
      const result = await clientA
        .from("food_review_logs")
        .select("*")
        .limit(10);

      // RLS should block - returns empty array (not an error)
      expectRlsBlocked(result);
    });

    it("anonymous user cannot SELECT from food_review_logs", async () => {
      const result = await anonClient
        .from("food_review_logs")
        .select("*")
        .limit(10);

      // RLS should block - returns empty array or permission denied error
      if (result.error) {
        expect(result.error.message).toMatch(/permission denied|insufficient_privilege/i);
      } else {
        expectRlsBlocked(result);
      }
    });
  });

  // ===========================================================================
  // INSERT TESTS
  // ===========================================================================

  describe("INSERT Operations", () => {
    it("regular user cannot INSERT into food_review_logs", async () => {
      const result = await clientA.from("food_review_logs").insert({
        food_id: testFoodId,
        decision: "approved",
        reasoning: "User attempted insert",
        confidence: 0.5,
        reviewer_type: "admin",
        reviewer_email: TEST_USERS.userA.email,
      });

      // Should be blocked by RLS (no INSERT policy for users)
      expectError(result);
    });

    it("admin cannot directly INSERT into food_review_logs", async () => {
      // Even admins should not insert directly - use apply_ai_food_review instead
      const result = await adminClient.from("food_review_logs").insert({
        food_id: testFoodId,
        decision: "approved",
        reasoning: "Admin attempted direct insert",
        confidence: 0.5,
        reviewer_type: "admin",
        reviewer_email: TEST_USERS.admin.email,
      });

      // Should be blocked - no INSERT policy even for admins
      expectError(result);
    });

    it("anonymous user cannot INSERT into food_review_logs", async () => {
      const result = await anonClient.from("food_review_logs").insert({
        food_id: testFoodId,
        decision: "approved",
        reasoning: "Anonymous attempted insert",
        confidence: 0.5,
        reviewer_type: "ai",
      });

      expectError(result);
    });
  });

  // ===========================================================================
  // UPDATE TESTS
  // ===========================================================================

  describe("UPDATE Operations", () => {
    it("regular user cannot UPDATE food_review_logs", async () => {
      const result = await clientA
        .from("food_review_logs")
        .update({ reasoning: "Modified by user" })
        .eq("food_id", testFoodId)
        .select();

      // Should be blocked - audit logs are immutable
      expectRlsBlocked(result);
    });

    it("admin cannot UPDATE food_review_logs", async () => {
      const result = await adminClient
        .from("food_review_logs")
        .update({ reasoning: "Modified by admin" })
        .eq("food_id", testFoodId)
        .select();

      // Should be blocked - audit logs are immutable (no UPDATE policy)
      expectRlsBlocked(result);
    });

    it("anonymous user cannot UPDATE food_review_logs", async () => {
      const result = await anonClient
        .from("food_review_logs")
        .update({ reasoning: "Modified by anon" })
        .eq("food_id", testFoodId)
        .select();

      // Should be blocked
      if (result.error) {
        expect(result.error.message).toMatch(/permission denied|insufficient_privilege/i);
      } else {
        expectRlsBlocked(result);
      }
    });
  });

  // ===========================================================================
  // DELETE TESTS
  // ===========================================================================

  describe("DELETE Operations", () => {
    it("regular user cannot DELETE from food_review_logs", async () => {
      const result = await clientA
        .from("food_review_logs")
        .delete()
        .eq("food_id", testFoodId)
        .select();

      // Should be blocked - audit logs cannot be deleted
      expectRlsBlocked(result);
    });

    it("admin cannot DELETE from food_review_logs", async () => {
      const result = await adminClient
        .from("food_review_logs")
        .delete()
        .eq("food_id", testFoodId)
        .select();

      // Should be blocked - audit logs cannot be deleted (no DELETE policy)
      expectRlsBlocked(result);
    });

    it("anonymous user cannot DELETE from food_review_logs", async () => {
      const result = await anonClient
        .from("food_review_logs")
        .delete()
        .eq("food_id", testFoodId)
        .select();

      // Should be blocked
      if (result.error) {
        expect(result.error.message).toMatch(/permission denied|insufficient_privilege/i);
      } else {
        expectRlsBlocked(result);
      }
    });
  });
});
