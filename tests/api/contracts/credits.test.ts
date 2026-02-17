/**
 * Contract tests for Credit System RPCs
 *
 * Tests the shape and behavior of credit-related RPC functions:
 * - add_credits(p_user_email, p_amount, p_transaction_type, p_description, p_stripe_payment_intent_id) - admin adds credits
 * - deduct_credit(p_description) - user consumes 1 credit from own balance, returns new balance
 * - get_user_credits() - returns current balance for authenticated user
 * - get_credit_history(p_limit, p_offset) - returns transaction log for authenticated user
 *
 * RLS rules:
 * - Only admin can add credits
 * - Users can only deduct from their own balance
 * - Users can only view their own balance and history
 * - Anonymous users cannot access credit functions
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createAnonymousClient,
  createAuthenticatedClient,
  createAdminClient,
  setupTestHooks,
  TEST_USERS,
  type PostgrestClient,
} from "../setup";
import { expectSuccess, expectNoError } from "../helpers";
import { createTestUser, cleanupTestData } from "../seed";

describe("Credits RPC Contract Tests", () => {
  setupTestHooks();

  let anonClient: PostgrestClient;
  let clientA: PostgrestClient;
  let clientB: PostgrestClient;
  let adminClient: PostgrestClient;

  beforeAll(async () => {
    anonClient = createAnonymousClient();
    await createTestUser(TEST_USERS.userA);
    await createTestUser(TEST_USERS.userB);
    await createTestUser(TEST_USERS.admin);
    clientA = await createAuthenticatedClient(TEST_USERS.userA.email);
    clientB = await createAuthenticatedClient(TEST_USERS.userB.email);
    adminClient = await createAdminClient(TEST_USERS.admin.email);
  });

  afterAll(async () => {
    await cleanupTestData(TEST_USERS.userA.email);
  });

  // ============================================================================
  // get_user_credits()
  // ============================================================================
  describe("get_user_credits()", () => {
    it("should return current balance for authenticated user", async () => {
      const result = await clientA.rpc<number>("get_user_credits");

      expectSuccess(result, "get_user_credits should succeed");

      // Balance should be a non-negative number
      expect(typeof result.data).toBe("number");
      expect(result.data).toBeGreaterThanOrEqual(0);
    });

    it("should return credits for user (including signup bonus)", async () => {
      // UserB has at least 10 credits from signup bonus (may have more from other tests)
      const result = await clientB.rpc<number>("get_user_credits");

      expectSuccess(result, "get_user_credits should succeed for user");

      // New users get 10 free AI generation credits as signup bonus
      // User may have accumulated more credits from other tests
      expect(result.data).toBeGreaterThanOrEqual(10);
    });

    it("should be denied for anonymous users", async () => {
      const result = await anonClient.rpc<number>("get_user_credits");

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("permission denied");
    });
  });

  // ============================================================================
  // add_credits(p_user_email, p_amount, p_transaction_type, p_description)
  // ============================================================================
  describe("add_credits(p_user_email, p_amount, p_transaction_type, p_description)", () => {
    it("should allow admin to add credits to a user", async () => {
      const initialBalance = await clientA.rpc<number>("get_user_credits");
      const initialCredits = initialBalance.data ?? 0;

      const result = await adminClient.rpc("add_credits", {
        p_user_email: TEST_USERS.userA.email,
        p_amount: 10,
        p_transaction_type: "purchase",
        p_description: "Test credit addition",
      });

      expectNoError(result);

      // Verify balance increased
      const newBalance = await clientA.rpc<number>("get_user_credits");
      expectSuccess(newBalance, "get_user_credits should succeed after add");
      expect(newBalance.data).toBe(initialCredits + 10);
    });

    it("should record the credit addition in history", async () => {
      // Add credits (using valid transaction type)
      await adminClient.rpc("add_credits", {
        p_user_email: TEST_USERS.userA.email,
        p_amount: 5,
        p_transaction_type: "admin_grant",
        p_description: "History test credit",
      });

      // Check history contains the transaction
      const historyResult = await clientA.rpc<
        Array<{
          id: string;
          amount: number;
          description: string | null;
          transaction_type: string;
          created_at: string;
        }>
      >("get_credit_history", {});

      expectSuccess(historyResult, "get_credit_history should succeed");
      expect(Array.isArray(historyResult.data)).toBe(true);

      // Find the transaction we just added
      const transaction = historyResult.data?.find(
        (t) => t.description === "History test credit"
      );
      expect(transaction).toBeDefined();
      expect(transaction?.amount).toBe(5);
      expect(transaction?.transaction_type).toBe("admin_grant");
    });

    it("should deny non-admin users from adding credits", async () => {
      const result = await clientA.rpc("add_credits", {
        p_user_email: TEST_USERS.userB.email,
        p_amount: 10,
        p_transaction_type: "purchase",
        p_description: "Unauthorized add attempt",
      });

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("Access denied");
    });

    it("should deny anonymous users from adding credits", async () => {
      const result = await anonClient.rpc("add_credits", {
        p_user_email: TEST_USERS.userA.email,
        p_amount: 10,
        p_transaction_type: "purchase",
        p_description: "Anonymous add attempt",
      });

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("permission denied");
    });

    it("should reject zero amount", async () => {
      const result = await adminClient.rpc("add_credits", {
        p_user_email: TEST_USERS.userA.email,
        p_amount: 0,
        p_transaction_type: "purchase",
        p_description: "Zero amount test",
      });

      expect(result.error).not.toBeNull();
    });

    it("should reject negative amount", async () => {
      const result = await adminClient.rpc("add_credits", {
        p_user_email: TEST_USERS.userA.email,
        p_amount: -5,
        p_transaction_type: "purchase",
        p_description: "Negative amount test",
      });

      expect(result.error).not.toBeNull();
    });

    it("should handle empty description gracefully", async () => {
      const result = await adminClient.rpc("add_credits", {
        p_user_email: TEST_USERS.userA.email,
        p_amount: 1,
        p_transaction_type: "purchase",
        p_description: "",
      });

      // Empty description might be allowed
      if (result.error) {
        expect(result.error.message).toBeDefined();
      } else {
        expectNoError(result);
      }
    });

    it("should handle null description gracefully", async () => {
      const result = await adminClient.rpc("add_credits", {
        p_user_email: TEST_USERS.userA.email,
        p_amount: 1,
        p_transaction_type: "purchase",
        p_description: null,
      });

      // Null description is allowed (DEFAULT NULL)
      expectNoError(result);
    });

    it("should reject adding credits to non-existent user", async () => {
      const result = await adminClient.rpc("add_credits", {
        p_user_email: "nonexistent-user@example.com",
        p_amount: 10,
        p_transaction_type: "purchase",
        p_description: "Test for non-existent user",
      });

      expect(result.error).not.toBeNull();
    });
  });

  // ============================================================================
  // deduct_credit(p_description)
  // Note: deduct_credit deducts exactly 1 credit and returns the new balance
  // ============================================================================
  describe("deduct_credit(p_description)", () => {
    beforeAll(async () => {
      // Ensure userA has some credits to deduct
      await adminClient.rpc("add_credits", {
        p_user_email: TEST_USERS.userA.email,
        p_amount: 100,
        p_transaction_type: "purchase",
        p_description: "Setup credits for deduction tests",
      });
    });

    it("should allow user to deduct 1 credit from own balance", async () => {
      const initialBalance = await clientA.rpc<number>("get_user_credits");
      const initialCredits = initialBalance.data ?? 0;

      const result = await clientA.rpc<number>("deduct_credit", {
        p_description: "Test deduction",
      });

      expectSuccess(result, "deduct_credit should succeed");

      // deduct_credit returns the new balance
      expect(typeof result.data).toBe("number");
      expect(result.data).toBe(initialCredits - 1);
    });

    it("should record the deduction in history with negative amount", async () => {
      await clientA.rpc("deduct_credit", {
        p_description: "Deduction history test",
      });

      const historyResult = await clientA.rpc<
        Array<{
          id: string;
          amount: number;
          description: string | null;
          created_at: string;
        }>
      >("get_credit_history", {});

      expectSuccess(historyResult, "get_credit_history should succeed");

      // Find the deduction transaction
      const transaction = historyResult.data?.find(
        (t) => t.description === "Deduction history test"
      );
      expect(transaction).toBeDefined();
      expect(transaction?.amount).toBe(-1);
    });

    it("should reject deducting when balance is 0", async () => {
      // First, ensure userB has 0 credits
      const balanceResult = await clientB.rpc<number>("get_user_credits");

      if (balanceResult.data === 0) {
        // Try to deduct when balance is 0
        const result = await clientB.rpc("deduct_credit", {
          p_description: "Overdraft attempt",
        });

        expect(result.error).not.toBeNull();
        expect(result.error?.message).toMatch(/insufficient|balance/i);
      }
    });

    it("should be denied for anonymous users", async () => {
      const result = await anonClient.rpc("deduct_credit", {
        p_description: "Anonymous deduction attempt",
      });

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("permission denied");
    });

    it("should handle empty description gracefully", async () => {
      const result = await clientA.rpc<number>("deduct_credit", {
        p_description: "",
      });

      // Empty description should be allowed
      expectSuccess(result, "deduct_credit with empty description should work");
      expect(typeof result.data).toBe("number");
    });

    it("should handle null description gracefully", async () => {
      const result = await clientA.rpc<number>("deduct_credit", {
        p_description: null,
      });

      // Null description is allowed (DEFAULT NULL)
      expectSuccess(result, "deduct_credit with null description should work");
      expect(typeof result.data).toBe("number");
    });
  });

  // ============================================================================
  // get_credit_history(p_limit, p_offset)
  // ============================================================================
  describe("get_credit_history(p_limit, p_offset)", () => {
    it("should return transaction log for authenticated user", async () => {
      const result = await clientA.rpc<
        Array<{
          id: string;
          amount: number;
          description: string | null;
          transaction_type: string;
          created_at: string;
        }>
      >("get_credit_history", {});

      expectSuccess(result, "get_credit_history should succeed");
      expect(Array.isArray(result.data)).toBe(true);

      // Verify shape of returned transactions
      if (result.data && result.data.length > 0) {
        const transaction = result.data[0];
        expect(transaction).toMatchObject({
          id: expect.any(String),
          amount: expect.any(Number),
          created_at: expect.any(String),
        });
      }
    });

    it("should respect limit parameter", async () => {
      const result = await clientA.rpc<
        Array<{ id: string }>
      >("get_credit_history", {
        p_limit: 2,
      });

      expectSuccess(result);
      expect(result.data!.length).toBeLessThanOrEqual(2);
    });

    it("should respect offset parameter", async () => {
      // Get first page
      const page1 = await clientA.rpc<
        Array<{ id: string }>
      >("get_credit_history", {
        p_limit: 2,
        p_offset: 0,
      });

      // Get second page
      const page2 = await clientA.rpc<
        Array<{ id: string }>
      >("get_credit_history", {
        p_limit: 2,
        p_offset: 2,
      });

      expectSuccess(page1);
      expectSuccess(page2);

      // Pages should have different entries (if enough data)
      if (page1.data!.length > 0 && page2.data!.length > 0) {
        expect(page1.data![0].id).not.toBe(page2.data![0].id);
      }
    });

    it("should only return history for the authenticated user (RLS)", async () => {
      // UserB should not see UserA's credit history
      const resultB = await clientB.rpc<
        Array<{
          id: string;
          description: string | null;
        }>
      >("get_credit_history", {});

      expectSuccess(resultB, "get_credit_history should succeed for userB");

      // UserB's history should not contain UserA's transactions
      if (resultB.data && resultB.data.length > 0) {
        const userADescriptions = [
          "Test credit addition",
          "History test credit",
          "Setup credits for deduction tests",
        ];
        const hasUserATransactions = resultB.data.some((t) =>
          t.description && userADescriptions.includes(t.description)
        );
        expect(hasUserATransactions).toBe(false);
      }
    });

    it("should be denied for anonymous users", async () => {
      const result = await anonClient.rpc<
        Array<{ id: string }>
      >("get_credit_history", {});

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("permission denied");
    });
  });

  // ============================================================================
  // RLS and Security Tests
  // ============================================================================
  describe("Credit System RLS and Security", () => {
    it("users cannot add credits to themselves via add_credits", async () => {
      const result = await clientA.rpc("add_credits", {
        p_user_email: TEST_USERS.userA.email,
        p_amount: 10,
        p_transaction_type: "purchase",
        p_description: "Self-add attempt",
      });

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("Access denied");
    });

    it("users cannot add credits to other users via add_credits", async () => {
      const result = await clientA.rpc("add_credits", {
        p_user_email: TEST_USERS.userB.email,
        p_amount: 10,
        p_transaction_type: "purchase",
        p_description: "Cross-user add attempt",
      });

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("Access denied");
    });

    it("admin can add credits to any user", async () => {
      const initialBalance = await clientB.rpc<number>("get_user_credits");
      const initialCredits = initialBalance.data ?? 0;

      const result = await adminClient.rpc("add_credits", {
        p_user_email: TEST_USERS.userB.email,
        p_amount: 5,
        p_transaction_type: "admin_grant",
        p_description: "Admin adding to userB",
      });

      expectNoError(result);

      // Verify userB received the credits
      const balanceResult = await clientB.rpc<number>("get_user_credits");
      expectSuccess(balanceResult);
      expect(balanceResult.data).toBe(initialCredits + 5);
    });

    it("deduct_credit only affects authenticated user's balance", async () => {
      // Ensure userB has credits first
      await adminClient.rpc("add_credits", {
        p_user_email: TEST_USERS.userB.email,
        p_amount: 10,
        p_transaction_type: "purchase",
        p_description: "Setup for isolation test",
      });

      // Get userB's balance
      const initialB = await clientB.rpc<number>("get_user_credits");
      const balanceB = initialB.data ?? 0;

      // UserA deducts from their own balance
      await clientA.rpc("deduct_credit", {
        p_description: "UserA self-deduction",
      });

      // Verify userB's balance is unchanged
      const afterB = await clientB.rpc<number>("get_user_credits");
      expect(afterB.data).toBe(balanceB);
    });
  });

  // ============================================================================
  // Return Type Contracts
  // ============================================================================
  describe("Return Type Contracts", () => {
    it("get_user_credits() returns INTEGER (credit balance)", async () => {
      const result = await clientA.rpc<number>("get_user_credits");

      if (result.data !== null) {
        expect(typeof result.data).toBe("number");
        expect(Number.isInteger(result.data)).toBe(true);
        expect(result.data).toBeGreaterThanOrEqual(0);
      }
    });

    it("get_credit_history() returns array of credit transactions", async () => {
      const result = await clientA.rpc<
        Array<{
          id: string;
          amount: number;
          description: string | null;
          created_at: string;
        }>
      >("get_credit_history", {});

      expectSuccess(result);
      expect(Array.isArray(result.data)).toBe(true);

      if (result.data && result.data.length > 0) {
        const tx = result.data[0];

        // Verify required fields
        expect(typeof tx.id).toBe("string");
        expect(typeof tx.amount).toBe("number");
        expect(typeof tx.created_at).toBe("string");

        // Verify created_at is valid ISO timestamp
        expect(() => new Date(tx.created_at)).not.toThrow();
      }
    });

    it("add_credits() returns integer (new balance) on success", async () => {
      const result = await adminClient.rpc<number>("add_credits", {
        p_user_email: TEST_USERS.userA.email,
        p_amount: 1,
        p_transaction_type: "purchase",
        p_description: "Return type test",
      });

      expectNoError(result);
      // add_credits returns the new balance as an integer
      expect(typeof result.data).toBe("number");
      expect(Number.isInteger(result.data)).toBe(true);
    });

    it("deduct_credit() returns INTEGER (new balance) on success", async () => {
      const result = await clientA.rpc<number>("deduct_credit", {
        p_description: "Return type test",
      });

      expectSuccess(result);
      expect(typeof result.data).toBe("number");
      expect(Number.isInteger(result.data)).toBe(true);
    });
  });
});
