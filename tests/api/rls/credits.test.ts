/**
 * RLS Security Tests for Credits System
 *
 * Tests Row-Level Security policies for:
 * - user_credits table: balance visibility, modification restrictions
 * - credit_transactions table: transaction history visibility, modification restrictions
 *
 * Per Phase 4.1 requirements:
 * - Users can only read their own credit balance
 * - Users cannot modify credits directly (function-only via add_credits)
 * - Users can only read their own transaction history
 * - No direct insert/update/delete on credit_transactions
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  createAuthenticatedClient,
  createAdminClient,
  createAnonymousClient,
  TEST_USERS,
  setupTestHooks,
  type PostgrestClient,
} from "../setup";
import {
  createTestUser,
  resetCreatedResources,
} from "../seed";
import {
  expectSuccess,
  expectRlsBlocked,
} from "../helpers";


describe("RLS: user_credits table", () => {
  setupTestHooks();

  let clientA: PostgrestClient;
  let anonClient: PostgrestClient;
  let adminClient: PostgrestClient;

  beforeAll(async () => {
    await createTestUser(TEST_USERS.userA);
    await createTestUser(TEST_USERS.userB);

    clientA = await createAuthenticatedClient(TEST_USERS.userA.email);
    anonClient = createAnonymousClient();
    adminClient = await createAdminClient(TEST_USERS.admin.email);

    // Add credits to userA via admin for testing reads
    await adminClient.rpc("add_credits", {
      p_user_email: TEST_USERS.userA.email,
      p_amount: 10,
      p_transaction_type: "admin_grant",
      p_description: "Test credits for userA",
    });

    // Add credits to userB via admin for testing isolation
    await adminClient.rpc("add_credits", {
      p_user_email: TEST_USERS.userB.email,
      p_amount: 20,
      p_transaction_type: "admin_grant",
      p_description: "Test credits for userB",
    });
  });

  beforeEach(() => {
    resetCreatedResources();
  });

  afterAll(() => {
    resetCreatedResources();
  });

  describe("SELECT policy", () => {
    it("user CANNOT directly read user_credits table (revoked in V12)", async () => {
      const result = await clientA
        .from("user_credits")
        .select("*")
        .eq("user_email", TEST_USERS.userA.email);

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("permission denied");
    });

    it("user CANNOT read other users credit balance", async () => {
      const result = await clientA
        .from("user_credits")
        .select("*")
        .eq("user_email", TEST_USERS.userB.email);

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("permission denied");
    });

    it("anonymous user CANNOT read any credit balance", async () => {
      const result = await anonClient
        .from("user_credits")
        .select("*")
        .eq("user_email", TEST_USERS.userA.email);

      expectRlsBlocked(result);
    });

    it("user CANNOT directly select all credits (revoked in V12)", async () => {
      const result = await clientA.from("user_credits").select("*");

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("permission denied");
    });

    it("admin can read user_credits directly", async () => {
      const result = await adminClient
        .from("user_credits")
        .select("*")
        .eq("user_email", TEST_USERS.userA.email);

      expectSuccess(result);
    });
  });

  describe("INSERT policy", () => {
    it("user CANNOT directly insert credits", async () => {
      const insertResult = await clientA.from("user_credits").insert({
        user_email: TEST_USERS.userA.email,
        balance: 999,
      });

      expect(insertResult.error).not.toBeNull();
    });

    it("user CANNOT insert credits for other users", async () => {
      const insertResult = await clientA.from("user_credits").insert({
        user_email: TEST_USERS.userB.email,
        balance: 999,
      });

      expect(insertResult.error).not.toBeNull();
    });

    it("anonymous user CANNOT insert credits", async () => {
      const insertResult = await anonClient.from("user_credits").insert({
        user_email: TEST_USERS.userA.email,
        balance: 999,
      });

      expect(insertResult.error).not.toBeNull();
    });

    it("admin CANNOT directly insert credits via table", async () => {
      const insertResult = await adminClient.from("user_credits").insert({
        user_email: TEST_USERS.userA.email,
        balance: 999,
      });

      expect(insertResult.error).not.toBeNull();
    });
  });

  describe("UPDATE policy", () => {
    it("user CANNOT directly update own credits", async () => {
      const updateResult = await clientA
        .from("user_credits")
        .update({ balance: 999 })
        .eq("user_email", TEST_USERS.userA.email);

      expect(updateResult.error).not.toBeNull();
    });

    it("user CANNOT update other users credits", async () => {
      const updateResult = await clientA
        .from("user_credits")
        .update({ balance: 999 })
        .eq("user_email", TEST_USERS.userB.email);

      expect(updateResult.error).not.toBeNull();
    });

    it("anonymous user CANNOT update credits", async () => {
      const updateResult = await anonClient
        .from("user_credits")
        .update({ balance: 999 })
        .eq("user_email", TEST_USERS.userA.email);

      expect(updateResult.error).not.toBeNull();
    });

    it("admin CANNOT directly update credits via table", async () => {
      const updateResult = await adminClient
        .from("user_credits")
        .update({ balance: 999 })
        .eq("user_email", TEST_USERS.userA.email);

      expect(updateResult.error).not.toBeNull();
    });
  });

  describe("DELETE policy", () => {
    it("user CANNOT delete own credit records", async () => {
      const deleteResult = await clientA
        .from("user_credits")
        .delete()
        .eq("user_email", TEST_USERS.userA.email);

      expect(deleteResult.error).not.toBeNull();
    });

    it("user CANNOT delete other users credit records", async () => {
      const deleteResult = await clientA
        .from("user_credits")
        .delete()
        .eq("user_email", TEST_USERS.userB.email);

      expect(deleteResult.error).not.toBeNull();
    });

    it("anonymous user CANNOT delete credit records", async () => {
      const deleteResult = await anonClient
        .from("user_credits")
        .delete()
        .eq("user_email", TEST_USERS.userA.email);

      expect(deleteResult.error).not.toBeNull();
    });

    it("admin CANNOT directly delete credit records via table", async () => {
      const deleteResult = await adminClient
        .from("user_credits")
        .delete()
        .eq("user_email", TEST_USERS.userA.email);

      expect(deleteResult.error).not.toBeNull();
    });
  });

  describe("Function-based credit management", () => {
    it("admin can add credits via add_credits function", async () => {
      // Use get_user_credits RPC (accessible to authenticated) to check balance
      const balanceBeforeResult = await clientA.rpc<number>("get_user_credits");
      expectSuccess(balanceBeforeResult);
      const balanceBefore = balanceBeforeResult.data!;

      const result = await adminClient.rpc<number>("add_credits", {
        p_user_email: TEST_USERS.userA.email,
        p_amount: 5,
        p_transaction_type: "admin_grant",
        p_description: "Bonus credits",
      });

      expectSuccess(result);
      expect(result.data).toBe(balanceBefore + 5);

      // Verify via user's RPC
      const balanceAfterResult = await clientA.rpc<number>("get_user_credits");
      expectSuccess(balanceAfterResult);
      expect(balanceAfterResult.data).toBe(balanceBefore + 5);
    });

    it("regular user CANNOT add credits via add_credits function", async () => {
      const result = await clientA.rpc<number>("add_credits", {
        p_user_email: TEST_USERS.userA.email,
        p_amount: 100,
        p_transaction_type: "admin_grant",
        p_description: "Trying to hack credits",
      });

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("admin");
    });

    it("anonymous user CANNOT add credits via add_credits function", async () => {
      const result = await anonClient.rpc<number>("add_credits", {
        p_user_email: TEST_USERS.userA.email,
        p_amount: 100,
        p_transaction_type: "admin_grant",
        p_description: "Anonymous hack attempt",
      });

      expect(result.error).not.toBeNull();
    });
  });
});

describe("RLS: credit_transactions table", () => {
  setupTestHooks();

  let clientA: PostgrestClient;
  let anonClient: PostgrestClient;
  let adminClient: PostgrestClient;

  beforeAll(async () => {
    await createTestUser(TEST_USERS.userA);
    await createTestUser(TEST_USERS.userB);

    clientA = await createAuthenticatedClient(TEST_USERS.userA.email);
    anonClient = createAnonymousClient();
    adminClient = await createAdminClient(TEST_USERS.admin.email);

    // Create test transactions via admin
    await adminClient.rpc("add_credits", {
      p_user_email: TEST_USERS.userA.email,
      p_amount: 10,
      p_transaction_type: "admin_grant",
      p_description: "Test transaction for userA",
    });

    await adminClient.rpc("add_credits", {
      p_user_email: TEST_USERS.userB.email,
      p_amount: 15,
      p_transaction_type: "admin_grant",
      p_description: "Test transaction for userB",
    });
  });

  beforeEach(() => {
    resetCreatedResources();
  });

  afterAll(() => {
    resetCreatedResources();
  });

  describe("SELECT policy", () => {
    // V12 revoked SELECT on credit_transactions from authenticated.
    // Regular users must use get_credit_history() RPC instead.
    it("user CANNOT directly read credit_transactions table (revoked in V12)", async () => {
      const result = await clientA
        .from("credit_transactions")
        .select("*")
        .eq("user_email", TEST_USERS.userA.email);

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("permission denied");
    });

    it("user CANNOT read other users transactions", async () => {
      const result = await clientA
        .from("credit_transactions")
        .select("*")
        .eq("user_email", TEST_USERS.userB.email);

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("permission denied");
    });

    it("anonymous user CANNOT read transactions", async () => {
      const result = await anonClient
        .from("credit_transactions")
        .select("*")
        .eq("user_email", TEST_USERS.userA.email);

      expect(result.error).not.toBeNull();
    });

    it("user CANNOT directly select all credit_transactions (revoked in V12)", async () => {
      const result = await clientA.from("credit_transactions").select("*");

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("permission denied");
    });

    it("admin can read credit_transactions directly", async () => {
      const result = await adminClient
        .from("credit_transactions")
        .select("*")
        .eq("user_email", TEST_USERS.userA.email);

      expectSuccess(result);
    });
  });

  describe("INSERT policy", () => {
    it("user CANNOT directly insert transactions", async () => {
      const insertResult = await clientA.from("credit_transactions").insert({
        user_email: TEST_USERS.userA.email,
        amount: 100,
        balance_after: 100,
        transaction_type: "admin_grant",
        description: "Fake transaction",
      });

      expect(insertResult.error).not.toBeNull();
    });

    it("user CANNOT insert transactions for other users", async () => {
      const insertResult = await clientA.from("credit_transactions").insert({
        user_email: TEST_USERS.userB.email,
        amount: 100,
        balance_after: 100,
        transaction_type: "admin_grant",
        description: "Fake transaction for other user",
      });

      expect(insertResult.error).not.toBeNull();
    });

    it("anonymous user CANNOT insert transactions", async () => {
      const insertResult = await anonClient.from("credit_transactions").insert({
        user_email: TEST_USERS.userA.email,
        amount: 100,
        balance_after: 100,
        transaction_type: "admin_grant",
        description: "Anonymous fake transaction",
      });

      expect(insertResult.error).not.toBeNull();
    });

    it("admin CANNOT directly insert transactions via table", async () => {
      const insertResult = await adminClient.from("credit_transactions").insert({
        user_email: TEST_USERS.userA.email,
        amount: 100,
        balance_after: 100,
        transaction_type: "admin_grant",
        description: "Admin trying direct insert",
      });

      expect(insertResult.error).not.toBeNull();
    });
  });

  describe("UPDATE policy", () => {
    it("user CANNOT update own transactions", async () => {
      // RLS should block update attempts
      const updateResult = await clientA
        .from("credit_transactions")
        .update({ amount: 999 })
        .eq("user_email", TEST_USERS.userA.email);

      expect(updateResult.error).not.toBeNull();
    });

    it("user CANNOT update other users transactions", async () => {
      const updateResult = await clientA
        .from("credit_transactions")
        .update({ amount: 999 })
        .eq("user_email", TEST_USERS.userB.email);

      expect(updateResult.error).not.toBeNull();
    });

    it("anonymous user CANNOT update transactions", async () => {
      const updateResult = await anonClient
        .from("credit_transactions")
        .update({ amount: 999 })
        .eq("user_email", TEST_USERS.userA.email);

      expect(updateResult.error).not.toBeNull();
    });

    it("admin CANNOT directly update transactions via table", async () => {
      const updateResult = await adminClient
        .from("credit_transactions")
        .update({ amount: 999 })
        .eq("user_email", TEST_USERS.userA.email);

      expect(updateResult.error).not.toBeNull();
    });
  });

  describe("DELETE policy", () => {
    it("user CANNOT delete own transactions", async () => {
      // RLS should block delete attempts
      const deleteResult = await clientA
        .from("credit_transactions")
        .delete()
        .eq("user_email", TEST_USERS.userA.email);

      expect(deleteResult.error).not.toBeNull();
    });

    it("user CANNOT delete other users transactions", async () => {
      const deleteResult = await clientA
        .from("credit_transactions")
        .delete()
        .eq("user_email", TEST_USERS.userB.email);

      expect(deleteResult.error).not.toBeNull();
    });

    it("anonymous user CANNOT delete transactions", async () => {
      const deleteResult = await anonClient
        .from("credit_transactions")
        .delete()
        .eq("user_email", TEST_USERS.userA.email);

      expect(deleteResult.error).not.toBeNull();
    });

    it("admin CANNOT directly delete transactions via table", async () => {
      const deleteResult = await adminClient
        .from("credit_transactions")
        .delete()
        .eq("user_email", TEST_USERS.userA.email);

      expect(deleteResult.error).not.toBeNull();
    });
  });

  describe("Transaction integrity", () => {
    it("transactions correctly record balance changes", async () => {
      // V12 revoked direct table SELECT from authenticated — use RPC functions
      const balanceBeforeResult = await clientA.rpc<number>("get_user_credits");
      expectSuccess(balanceBeforeResult);
      const balanceBefore = balanceBeforeResult.data!;

      const addAmount = 7;
      await adminClient.rpc("add_credits", {
        p_user_email: TEST_USERS.userA.email,
        p_amount: addAmount,
        p_transaction_type: "admin_grant",
        p_description: "Test balance tracking",
      });

      // Use get_credit_history (SECURITY DEFINER) to read transactions
      const transactionsResult = await clientA.rpc<
        Array<{
          id: string;
          amount: number;
          balance_after: number;
          transaction_type: string;
          description: string;
          created_at: string;
        }>
      >("get_credit_history", { p_limit: 1, p_offset: 0 });

      expectSuccess(transactionsResult);
      const transactions = transactionsResult.data as unknown as Array<{
        id: string;
        amount: number;
        balance_after: number;
        transaction_type: string;
        description: string;
      }>;
      expect(transactions.length).toBeGreaterThanOrEqual(1);
      const latest = transactions[0];
      expect(latest.amount).toBe(addAmount);
      expect(latest.balance_after).toBe(balanceBefore + addAmount);
      expect(latest.transaction_type).toBe("admin_grant");
      expect(latest.description).toBe("Test balance tracking");
    });

    it("transaction history persists even after balance changes", async () => {
      // Use get_credit_history (SECURITY DEFINER) instead of direct table SELECT
      const txBefore = await clientA.rpc<
        Array<{ id: string }>
      >("get_credit_history", { p_limit: 100, p_offset: 0 });
      expectSuccess(txBefore);
      const countBefore = (txBefore.data as unknown as Array<{ id: string }>).length;

      await adminClient.rpc("add_credits", {
        p_user_email: TEST_USERS.userA.email,
        p_amount: 3,
        p_transaction_type: "admin_grant",
        p_description: "Persistence test",
      });

      const txAfter = await clientA.rpc<
        Array<{ id: string }>
      >("get_credit_history", { p_limit: 100, p_offset: 0 });
      expectSuccess(txAfter);
      const countAfter = (txAfter.data as unknown as Array<{ id: string }>).length;
      expect(countAfter).toBe(countBefore + 1);
    });
  });

  describe("Cross-user isolation", () => {
    it("userA cannot see any data about userB credits (permission denied)", async () => {
      // V12 revoked SELECT from authenticated — both get permission denied
      const creditsResult = await clientA
        .from("user_credits")
        .select("*")
        .eq("user_email", TEST_USERS.userB.email);

      expect(creditsResult.error).not.toBeNull();
      expect(creditsResult.error?.message).toContain("permission denied");

      const transactionsResult = await clientA
        .from("credit_transactions")
        .select("*")
        .eq("user_email", TEST_USERS.userB.email);

      expect(transactionsResult.error).not.toBeNull();
      expect(transactionsResult.error?.message).toContain("permission denied");
    });

    it("authenticated user CANNOT list credits directly (revoked in V12)", async () => {
      const creditsResult = await clientA.from("user_credits").select("*");

      expect(creditsResult.error).not.toBeNull();
      expect(creditsResult.error?.message).toContain("permission denied");
    });

    it("authenticated user CANNOT list transactions directly (revoked in V12)", async () => {
      const transactionsResult = await clientA.from("credit_transactions").select("*");

      expect(transactionsResult.error).not.toBeNull();
      expect(transactionsResult.error?.message).toContain("permission denied");
    });
  });
});
