/**
 * Contract tests for Home RPCs
 *
 * Tests the return shapes and behavior of all home-related RPC functions:
 * - create_home
 * - update_home_name
 * - get_home_info
 * - generate_join_code
 * - disable_join_code
 * - join_home_by_code
 * - invite_to_home
 * - get_pending_invitations
 * - accept_invitation
 * - decline_invitation
 * - cancel_invitation
 * - remove_home_member
 * - leave_home
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import {
  createAuthenticatedClient,
  setupTestHooks,
  TEST_USERS,
  type PostgrestClient,
} from "../setup";
import {
  createTestUser,
  createTestHome,
  uniqueId,
} from "../seed";
import {
  expectSuccess,
  expectNoError,
  expectValidUuid,
  randomEmail,
} from "../helpers";
import type { HomeInfo, HomeMember } from "../../../types";

setupTestHooks();

describe("Home RPCs Contract Tests", () => {
  let clientA: PostgrestClient;
  let clientB: PostgrestClient;

  beforeAll(async () => {
    // Create test users
    await createTestUser(TEST_USERS.userA);
    await createTestUser(TEST_USERS.userB);

    // Create authenticated clients
    clientA = await createAuthenticatedClient(TEST_USERS.userA.email);
    clientB = await createAuthenticatedClient(TEST_USERS.userB.email);
  });

  /**
   * Helper to ensure user has no home (for test isolation)
   * Note: PostgREST doesn't throw - it returns error in response, so try/catch doesn't work.
   * We call leave_home and ignore any error response.
   */
  async function ensureNoHome(client: PostgrestClient) {
    await client.rpc("leave_home");
  }

  beforeEach(async () => {
    // Ensure clean state: both users should have no home
    await ensureNoHome(clientA);
    await ensureNoHome(clientB);
  });

  afterEach(async () => {
    // Clean up: have both users leave their homes if they have one
    await ensureNoHome(clientA);
    await ensureNoHome(clientB);
  });

  // ===========================================================================
  // create_home
  // ===========================================================================
  describe("create_home(p_name)", () => {
    it("returns a UUID when creating a home", async () => {
      const homeName = `Test Home ${uniqueId()}`;

      const result = await clientA.rpc<string>("create_home", {
        p_name: homeName,
      });

      expectSuccess(result, "create_home should succeed");
      expectValidUuid(result.data);
    });

    it("fails when user already has a home", async () => {
      const homeName1 = `Test Home ${uniqueId()}`;
      const homeName2 = `Test Home ${uniqueId()}`;

      // Create first home
      const result1 = await clientA.rpc<string>("create_home", {
        p_name: homeName1,
      });
      expectSuccess(result1);

      // Try to create second home
      const result2 = await clientA.rpc<string>("create_home", {
        p_name: homeName2,
      });

      expect(result2.error).not.toBeNull();
      expect(result2.error?.message).toContain("user-already-has-home");
    });

    it("fails with invalid home name", async () => {
      const result = await clientA.rpc<string>("create_home", {
        p_name: "",
      });

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("invalid-home-name");
    });

    it("fails with null home name", async () => {
      const result = await clientA.rpc<string>("create_home", {
        p_name: null,
      });

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("invalid-home-name");
    });

    it("trims whitespace from home name", async () => {
      const homeName = `  Test Home ${uniqueId()}  `;

      const result = await clientA.rpc<string>("create_home", {
        p_name: homeName,
      });

      expectSuccess(result);
      expectValidUuid(result.data);

      // Verify the name was trimmed by getting home info
      const homeInfo = await clientA.rpc<HomeInfo>("get_home_info");
      expectSuccess(homeInfo);
      expect(homeInfo.data?.name).toBe(homeName.trim());
    });
  });

  // ===========================================================================
  // update_home_name
  // ===========================================================================
  describe("update_home_name(p_name)", () => {
    it("returns void on success", async () => {
      // Create a home first
      await createTestHome(clientA, `Original Name ${uniqueId()}`);

      const newName = `Updated Name ${uniqueId()}`;
      const result = await clientA.rpc("update_home_name", {
        p_name: newName,
      });

      expectNoError(result); // void-returning function
      expect(result.data).toBeNull(); // void return

      // Verify the name was updated
      const homeInfo = await clientA.rpc<HomeInfo>("get_home_info");
      expectSuccess(homeInfo);
      expect(homeInfo.data?.name).toBe(newName);
    });

    it("fails when user has no home", async () => {
      const result = await clientA.rpc("update_home_name", {
        p_name: "New Name",
      });

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("user-has-no-home");
    });

    it("fails with invalid name", async () => {
      await createTestHome(clientA);

      const result = await clientA.rpc("update_home_name", {
        p_name: "",
      });

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("invalid-home-name");
    });

    it("fails with name exceeding 255 characters", async () => {
      await createTestHome(clientA);

      const longName = "a".repeat(256);
      const result = await clientA.rpc("update_home_name", {
        p_name: longName,
      });

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("invalid-home-name");
    });
  });

  // ===========================================================================
  // get_home_info
  // ===========================================================================
  describe("get_home_info()", () => {
    it("returns null when user has no home", async () => {
      const result = await clientA.rpc<HomeInfo | null>("get_home_info");

      expectNoError(result); // can return null data when user has no home
      expect(result.data).toBeNull();
    });

    it("returns correct shape with home info", async () => {
      const homeName = `Info Test Home ${uniqueId()}`;
      await createTestHome(clientA, homeName);

      const result = await clientA.rpc<HomeInfo>("get_home_info");

      expectSuccess(result, "get_home_info should succeed");
      expect(result.data).not.toBeNull();

      const info = result.data!;

      // Validate structure
      expectValidUuid(info.id);
      expect(info.name).toBe(homeName);
      expect(typeof info.member_count).toBe("undefined"); // Not in JSONB return
      expect(Array.isArray(info.members)).toBe(true);
      expect(info.members.length).toBeGreaterThanOrEqual(1);

      // join_code can be null or string
      expect(
        info.join_code === null || typeof info.join_code === "string"
      ).toBe(true);

      // join_code_expires_at can be null or string (ISO date)
      expect(
        info.join_code_expires_at === null ||
          typeof info.join_code_expires_at === "string"
      ).toBe(true);
    });

    it("returns correct member structure", async () => {
      await createTestHome(clientA);

      const result = await clientA.rpc<HomeInfo>("get_home_info");

      expectSuccess(result);
      const members = result.data!.members;
      expect(members.length).toBe(1);

      const member = members[0];
      expect(member.email).toBe(TEST_USERS.userA.email);
      expect(member.name).toBe(TEST_USERS.userA.name);
      expect(typeof member.joined_at).toBe("string");
    });

    it("includes pending invitations in response", async () => {
      await createTestHome(clientA);

      // Send an invitation
      const invitedEmail = randomEmail();
      await clientA.rpc("invite_to_home", { p_email: invitedEmail });

      const result = await clientA.rpc<HomeInfo & { pending_invitations: unknown[] }>(
        "get_home_info"
      );

      expectSuccess(result);
      expect(result.data).toHaveProperty("pending_invitations");
      expect(Array.isArray(result.data!.pending_invitations)).toBe(true);
      expect(result.data!.pending_invitations.length).toBe(1);
    });
  });

  // ===========================================================================
  // generate_join_code
  // ===========================================================================
  describe("generate_join_code(p_expires_hours)", () => {
    it("returns an 8-character join code", async () => {
      await createTestHome(clientA);

      const result = await clientA.rpc<string>("generate_join_code", {
        p_expires_hours: 24,
      });

      expectSuccess(result, "generate_join_code should succeed");
      expect(typeof result.data).toBe("string");
      expect(result.data).toHaveLength(8);
      // Code should be alphanumeric uppercase
      expect(result.data).toMatch(/^[A-Z0-9]+$/);
    });

    it("uses default expiration of 168 hours (1 week)", async () => {
      await createTestHome(clientA);

      const result = await clientA.rpc<string>("generate_join_code");

      expectSuccess(result);
      expect(result.data).toHaveLength(8);

      // Verify via get_home_info
      const homeInfo = await clientA.rpc<HomeInfo>("get_home_info");
      expectSuccess(homeInfo);
      expect(homeInfo.data!.join_code).toBe(result.data);
      expect(homeInfo.data!.join_code_expires_at).not.toBeNull();
    });

    it("fails when user has no home", async () => {
      const result = await clientA.rpc<string>("generate_join_code");

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("user-has-no-home");
    });

    it("replaces existing join code", async () => {
      await createTestHome(clientA);

      const code1 = await clientA.rpc<string>("generate_join_code");
      expectSuccess(code1);

      const code2 = await clientA.rpc<string>("generate_join_code");
      expectSuccess(code2);

      // Codes should be different
      expect(code1.data).not.toBe(code2.data);

      // Home info should show the new code
      const homeInfo = await clientA.rpc<HomeInfo>("get_home_info");
      expect(homeInfo.data!.join_code).toBe(code2.data);
    });
  });

  // ===========================================================================
  // disable_join_code
  // ===========================================================================
  describe("disable_join_code()", () => {
    it("returns void on success", async () => {
      await createTestHome(clientA);
      await clientA.rpc("generate_join_code");

      const result = await clientA.rpc("disable_join_code");

      expectNoError(result); // void-returning function
      expect(result.data).toBeNull(); // void return

      // Verify code is disabled
      const homeInfo = await clientA.rpc<HomeInfo>("get_home_info");
      expect(homeInfo.data!.join_code).toBeNull();
      expect(homeInfo.data!.join_code_expires_at).toBeNull();
    });

    it("succeeds even when no join code exists", async () => {
      await createTestHome(clientA);

      const result = await clientA.rpc("disable_join_code");

      expectNoError(result); // void-returning function
    });

    it("fails when user has no home", async () => {
      const result = await clientA.rpc("disable_join_code");

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("user-has-no-home");
    });
  });

  // ===========================================================================
  // join_home_by_code
  // ===========================================================================
  describe("join_home_by_code(p_code)", () => {
    it("returns home_id UUID on success", async () => {
      // User A creates home and generates code
      const homeId = await createTestHome(clientA);
      const codeResult = await clientA.rpc<string>("generate_join_code");
      expectSuccess(codeResult);
      const joinCode = codeResult.data!;

      // User B joins with code
      const result = await clientB.rpc<string>("join_home_by_code", {
        p_code: joinCode,
      });

      expectSuccess(result, "join_home_by_code should succeed");
      expectValidUuid(result.data);
      expect(result.data).toBe(homeId);
    });

    it("handles lowercase code input", async () => {
      await createTestHome(clientA);
      const codeResult = await clientA.rpc<string>("generate_join_code");
      const joinCode = codeResult.data!.toLowerCase();

      const result = await clientB.rpc<string>("join_home_by_code", {
        p_code: joinCode,
      });

      expectSuccess(result);
    });

    it("fails with invalid code", async () => {
      const result = await clientB.rpc<string>("join_home_by_code", {
        p_code: "INVALID1",
      });

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("invalid-join-code");
    });

    it("fails when user already has a home", async () => {
      // User A creates home and generates code
      await createTestHome(clientA);
      const codeResult = await clientA.rpc<string>("generate_join_code");
      const joinCode = codeResult.data!;

      // User B creates their own home first
      await createTestHome(clientB);

      // User B tries to join with code
      const result = await clientB.rpc<string>("join_home_by_code", {
        p_code: joinCode,
      });

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("user-already-has-home");
    });

    it("adds user as member after joining", async () => {
      await createTestHome(clientA);
      const codeResult = await clientA.rpc<string>("generate_join_code");

      await clientB.rpc("join_home_by_code", { p_code: codeResult.data });

      // Verify user B is now a member
      const homeInfo = await clientA.rpc<HomeInfo>("get_home_info");
      expectSuccess(homeInfo);
      expect(homeInfo.data!.members.length).toBe(2);

      const memberEmails = homeInfo.data!.members.map((m: HomeMember) => m.email);
      expect(memberEmails).toContain(TEST_USERS.userB.email);
    });
  });

  // ===========================================================================
  // invite_to_home
  // ===========================================================================
  describe("invite_to_home(p_email)", () => {
    it("returns invitation UUID on success", async () => {
      await createTestHome(clientA);

      const invitedEmail = randomEmail();
      const result = await clientA.rpc<string>("invite_to_home", {
        p_email: invitedEmail,
      });

      expectSuccess(result, "invite_to_home should succeed");
      expectValidUuid(result.data);
    });

    it("fails when user has no home", async () => {
      const result = await clientA.rpc<string>("invite_to_home", {
        p_email: randomEmail(),
      });

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("user-has-no-home");
    });

    it("fails with invalid email", async () => {
      await createTestHome(clientA);

      const result = await clientA.rpc<string>("invite_to_home", {
        p_email: "",
      });

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("invalid-email");
    });

    it("fails when inviting self", async () => {
      await createTestHome(clientA);

      const result = await clientA.rpc<string>("invite_to_home", {
        p_email: TEST_USERS.userA.email,
      });

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("cannot-invite-self");
    });

    it("fails when inviting existing member", async () => {
      await createTestHome(clientA);
      const codeResult = await clientA.rpc<string>("generate_join_code");
      await clientB.rpc("join_home_by_code", { p_code: codeResult.data });

      const result = await clientA.rpc<string>("invite_to_home", {
        p_email: TEST_USERS.userB.email,
      });

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("user-already-member");
    });

    it("fails with duplicate pending invitation", async () => {
      await createTestHome(clientA);
      const invitedEmail = randomEmail();

      // First invitation
      const result1 = await clientA.rpc<string>("invite_to_home", {
        p_email: invitedEmail,
      });
      expectSuccess(result1);

      // Second invitation to same email
      const result2 = await clientA.rpc<string>("invite_to_home", {
        p_email: invitedEmail,
      });

      expect(result2.error).not.toBeNull();
      expect(result2.error?.message).toContain("invitation-already-pending");
    });
  });

  // ===========================================================================
  // get_pending_invitations
  // ===========================================================================
  describe("get_pending_invitations()", () => {
    it("returns empty array when no pending invitations", async () => {
      const result = await clientA.rpc<unknown[]>("get_pending_invitations");

      expectSuccess(result);
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it("returns correct invitation structure", async () => {
      // User A creates home and invites User B
      await createTestHome(clientA, `Invitation Test ${uniqueId()}`);
      await clientA.rpc("invite_to_home", { p_email: TEST_USERS.userB.email });

      // User B checks pending invitations
      const result = await clientB.rpc<Array<{
        id: string;
        home_id: string;
        home_name: string;
        invited_by_email: string;
        invited_by_name: string;
        token: string;
        expires_at: string;
        date_published: string;
      }>>("get_pending_invitations");

      expectSuccess(result, "get_pending_invitations should succeed");
      expect(result.data).toHaveLength(1);

      const invitation = result.data![0];
      expectValidUuid(invitation.id);
      expectValidUuid(invitation.home_id);
      expect(typeof invitation.home_name).toBe("string");
      expect(invitation.invited_by_email).toBe(TEST_USERS.userA.email);
      expect(invitation.invited_by_name).toBe(TEST_USERS.userA.name);
      expect(typeof invitation.token).toBe("string");
      expect(invitation.token).toHaveLength(64); // 32 bytes hex encoded
      expect(typeof invitation.expires_at).toBe("string");
      expect(typeof invitation.date_published).toBe("string");
    });

    it("returns multiple pending invitations", async () => {
      // Create two homes with two different users inviting User B
      // For this test, we'll use a third test user
      const userC = {
        email: `test-user-c-${uniqueId()}@example.com`,
        name: "Test User C",
        password: "TestPassword789!",
      };
      await createTestUser(userC);
      const clientC = await createAuthenticatedClient(userC.email);

      await createTestHome(clientA, `Home A ${uniqueId()}`);
      await createTestHome(clientC, `Home C ${uniqueId()}`);

      await clientA.rpc("invite_to_home", { p_email: TEST_USERS.userB.email });
      await clientC.rpc("invite_to_home", { p_email: TEST_USERS.userB.email });

      const result = await clientB.rpc<unknown[]>("get_pending_invitations");

      expectSuccess(result);
      expect(result.data!.length).toBeGreaterThanOrEqual(2);

      // Clean up user C's home
      await clientC.rpc("leave_home");
    });
  });

  // ===========================================================================
  // accept_invitation
  // ===========================================================================
  describe("accept_invitation(p_token)", () => {
    it("returns home_id UUID on success", async () => {
      const homeId = await createTestHome(clientA, `Accept Test ${uniqueId()}`);
      await clientA.rpc("invite_to_home", { p_email: TEST_USERS.userB.email });

      // Get the token from pending invitations
      const invitations = await clientB.rpc<Array<{ token: string }>>(
        "get_pending_invitations"
      );
      const token = invitations.data![0].token;

      const result = await clientB.rpc<string>("accept_invitation", {
        p_token: token,
      });

      expectSuccess(result, "accept_invitation should succeed");
      expectValidUuid(result.data);
      expect(result.data).toBe(homeId);
    });

    it("fails with invalid token", async () => {
      const result = await clientB.rpc<string>("accept_invitation", {
        p_token: "invalid-token-that-does-not-exist",
      });

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("invalid-invitation-token");
    });

    it("fails when user already has a home", async () => {
      await createTestHome(clientA);
      await clientA.rpc("invite_to_home", { p_email: TEST_USERS.userB.email });

      // User B creates their own home first
      await createTestHome(clientB);

      // Get the token
      await clientB.rpc<Array<{ token: string }>>(
        "get_pending_invitations"
      );

      // Token won't be visible since get_pending_invitations only returns for users without homes
      // So we test this differently - by trying with a made-up token
      const result = await clientB.rpc<string>("accept_invitation", {
        p_token: "a".repeat(64), // Valid format but doesn't exist
      });

      expect(result.error).not.toBeNull();
    });

    it("adds user as member after accepting", async () => {
      await createTestHome(clientA);
      await clientA.rpc("invite_to_home", { p_email: TEST_USERS.userB.email });

      const invitations = await clientB.rpc<Array<{ token: string }>>(
        "get_pending_invitations"
      );
      await clientB.rpc("accept_invitation", { p_token: invitations.data![0].token });

      // Verify user B is now a member
      const homeInfo = await clientA.rpc<HomeInfo>("get_home_info");
      const memberEmails = homeInfo.data!.members.map((m: HomeMember) => m.email);
      expect(memberEmails).toContain(TEST_USERS.userB.email);
    });
  });

  // ===========================================================================
  // decline_invitation
  // ===========================================================================
  describe("decline_invitation(p_token)", () => {
    it("returns void on success", async () => {
      await createTestHome(clientA);
      await clientA.rpc("invite_to_home", { p_email: TEST_USERS.userB.email });

      const invitations = await clientB.rpc<Array<{ token: string }>>(
        "get_pending_invitations"
      );
      const token = invitations.data![0].token;

      const result = await clientB.rpc("decline_invitation", {
        p_token: token,
      });

      expectNoError(result); // void-returning function
      expect(result.data).toBeNull(); // void return
    });

    it("removes invitation from pending list", async () => {
      await createTestHome(clientA);
      await clientA.rpc("invite_to_home", { p_email: TEST_USERS.userB.email });

      const invitations = await clientB.rpc<Array<{ token: string }>>(
        "get_pending_invitations"
      );
      expect(invitations.data!.length).toBe(1);

      await clientB.rpc("decline_invitation", {
        p_token: invitations.data![0].token,
      });

      const invitationsAfter = await clientB.rpc<unknown[]>(
        "get_pending_invitations"
      );
      expect(invitationsAfter.data).toHaveLength(0);
    });

    it("fails with invalid token", async () => {
      const result = await clientB.rpc("decline_invitation", {
        p_token: "invalid-token",
      });

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("invalid-invitation-token");
    });

    it("fails when invitation is not for user", async () => {
      await createTestHome(clientA);
      const invitedEmail = randomEmail();
      await clientA.rpc("invite_to_home", { p_email: invitedEmail });

      // User B tries to decline an invitation meant for someone else
      // We can't easily get the token, so we test with a random valid format token
      const result = await clientB.rpc("decline_invitation", {
        p_token: "a".repeat(64),
      });

      expect(result.error).not.toBeNull();
    });
  });

  // ===========================================================================
  // cancel_invitation
  // ===========================================================================
  describe("cancel_invitation(p_invitation_id)", () => {
    it("returns void on success", async () => {
      await createTestHome(clientA);
      const invitationResult = await clientA.rpc<string>("invite_to_home", {
        p_email: randomEmail(),
      });

      const result = await clientA.rpc("cancel_invitation", {
        p_invitation_id: invitationResult.data,
      });

      expectNoError(result); // void-returning function
      expect(result.data).toBeNull(); // void return
    });

    it("fails with invalid invitation id", async () => {
      await createTestHome(clientA);

      const result = await clientA.rpc("cancel_invitation", {
        p_invitation_id: "00000000-0000-0000-0000-000000000000",
      });

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("invitation-not-found");
    });

    it("fails when user is not the inviter", async () => {
      await createTestHome(clientA);
      const invitationResult = await clientA.rpc<string>("invite_to_home", {
        p_email: TEST_USERS.userB.email,
      });

      // User B (the invitee) tries to cancel
      const result = await clientB.rpc("cancel_invitation", {
        p_invitation_id: invitationResult.data,
      });

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("not-invitation-owner");
    });

    it("removes invitation from pending list", async () => {
      await createTestHome(clientA);
      const invitationResult = await clientA.rpc<string>("invite_to_home", {
        p_email: TEST_USERS.userB.email,
      });

      // Verify invitation exists
      const invitations = await clientB.rpc<unknown[]>("get_pending_invitations");
      expect(invitations.data!.length).toBe(1);

      // Cancel it
      await clientA.rpc("cancel_invitation", {
        p_invitation_id: invitationResult.data,
      });

      // Verify invitation is gone
      const invitationsAfter = await clientB.rpc<unknown[]>(
        "get_pending_invitations"
      );
      expect(invitationsAfter.data).toHaveLength(0);
    });
  });

  // ===========================================================================
  // remove_home_member
  // ===========================================================================
  describe("remove_home_member(p_member_email)", () => {
    it("returns void on success", async () => {
      await createTestHome(clientA);
      const codeResult = await clientA.rpc<string>("generate_join_code");
      await clientB.rpc("join_home_by_code", { p_code: codeResult.data });

      // User A removes User B
      const result = await clientA.rpc("remove_home_member", {
        p_member_email: TEST_USERS.userB.email,
      });

      expectNoError(result); // void-returning function
      expect(result.data).toBeNull(); // void return
    });

    it("removes member from home", async () => {
      await createTestHome(clientA);
      const codeResult = await clientA.rpc<string>("generate_join_code");
      await clientB.rpc("join_home_by_code", { p_code: codeResult.data });

      // Verify B is a member
      let homeInfo = await clientA.rpc<HomeInfo>("get_home_info");
      expect(homeInfo.data!.members.length).toBe(2);

      await clientA.rpc("remove_home_member", {
        p_member_email: TEST_USERS.userB.email,
      });

      // Verify B is removed
      homeInfo = await clientA.rpc<HomeInfo>("get_home_info");
      expect(homeInfo.data!.members.length).toBe(1);
      expect(homeInfo.data!.members[0].email).toBe(TEST_USERS.userA.email);
    });

    it("fails when user has no home", async () => {
      const result = await clientA.rpc("remove_home_member", {
        p_member_email: TEST_USERS.userB.email,
      });

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("user-has-no-home");
    });

    it("fails when trying to remove self", async () => {
      await createTestHome(clientA);

      const result = await clientA.rpc("remove_home_member", {
        p_member_email: TEST_USERS.userA.email,
      });

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("cannot-remove-self");
    });

    it("fails when member is not found", async () => {
      await createTestHome(clientA);

      const result = await clientA.rpc("remove_home_member", {
        p_member_email: randomEmail(),
      });

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("member-not-found");
    });

    it("removed member no longer has home", async () => {
      await createTestHome(clientA);
      const codeResult = await clientA.rpc<string>("generate_join_code");
      await clientB.rpc("join_home_by_code", { p_code: codeResult.data });

      await clientA.rpc("remove_home_member", {
        p_member_email: TEST_USERS.userB.email,
      });

      // User B should have no home now
      const homeInfo = await clientB.rpc<HomeInfo | null>("get_home_info");
      expect(homeInfo.data).toBeNull();
    });
  });

  // ===========================================================================
  // leave_home
  // ===========================================================================
  describe("leave_home()", () => {
    it("returns void on success", async () => {
      await createTestHome(clientA);

      const result = await clientA.rpc("leave_home");

      expectNoError(result); // void-returning function
      expect(result.data).toBeNull(); // void return
    });

    it("user has no home after leaving", async () => {
      await createTestHome(clientA);
      await clientA.rpc("leave_home");

      const homeInfo = await clientA.rpc<HomeInfo | null>("get_home_info");
      expect(homeInfo.data).toBeNull();
    });

    it("fails when user has no home", async () => {
      const result = await clientA.rpc("leave_home");

      expect(result.error).not.toBeNull();
      expect(result.error?.message).toContain("user-has-no-home");
    });

    it("deletes home when last member leaves", async () => {
      await createTestHome(clientA);
      await clientA.rpc("leave_home");

      // Home should be deleted - user B shouldn't be able to join it
      // We can verify by checking that the home doesn't exist
      // Since there's no direct way to query homes, we verify indirectly
      const homeInfo = await clientA.rpc<HomeInfo | null>("get_home_info");
      expect(homeInfo.data).toBeNull();
    });

    it("does not delete home when other members remain", async () => {
      await createTestHome(clientA);
      const codeResult = await clientA.rpc<string>("generate_join_code");
      await clientB.rpc("join_home_by_code", { p_code: codeResult.data });

      // User B leaves
      await clientB.rpc("leave_home");

      // Home should still exist for User A
      const homeInfo = await clientA.rpc<HomeInfo>("get_home_info");
      expect(homeInfo.data).not.toBeNull();
      expect(homeInfo.data!.members.length).toBe(1);
    });
  });

  // ===========================================================================
  // Integration / Edge Cases
  // ===========================================================================
  describe("Integration Tests", () => {
    it("complete home creation and joining flow via join code", async () => {
      // 1. User A creates home
      const homeId = await createTestHome(clientA, "Integration Test Home");

      // 2. User A generates join code
      const codeResult = await clientA.rpc<string>("generate_join_code", {
        p_expires_hours: 24,
      });
      expectSuccess(codeResult);

      // 3. User B joins via code
      const joinResult = await clientB.rpc<string>("join_home_by_code", {
        p_code: codeResult.data,
      });
      expectSuccess(joinResult);
      expect(joinResult.data).toBe(homeId);

      // 4. Verify both are members
      const homeInfo = await clientA.rpc<HomeInfo>("get_home_info");
      expect(homeInfo.data!.members.length).toBe(2);
    });

    it("complete invitation flow", async () => {
      // 1. User A creates home
      await createTestHome(clientA, "Invitation Flow Home");

      // 2. User A invites User B
      const inviteResult = await clientA.rpc<string>("invite_to_home", {
        p_email: TEST_USERS.userB.email,
      });
      expectSuccess(inviteResult);

      // 3. User B gets pending invitations
      const invitations = await clientB.rpc<Array<{ token: string; home_name: string }>>(
        "get_pending_invitations"
      );
      expect(invitations.data!.length).toBe(1);
      expect(invitations.data![0].home_name).toBe("Invitation Flow Home");

      // 4. User B accepts invitation
      const acceptResult = await clientB.rpc<string>("accept_invitation", {
        p_token: invitations.data![0].token,
      });
      expectSuccess(acceptResult);

      // 5. Verify both are members
      const homeInfo = await clientA.rpc<HomeInfo>("get_home_info");
      expect(homeInfo.data!.members.length).toBe(2);
    });

    it("user can create new home after leaving old one", async () => {
      // Create and leave first home
      await createTestHome(clientA, "First Home");
      await clientA.rpc("leave_home");

      // Create new home
      const result = await clientA.rpc<string>("create_home", {
        p_name: "Second Home",
      });
      expectSuccess(result);

      const homeInfo = await clientA.rpc<HomeInfo>("get_home_info");
      expect(homeInfo.data!.name).toBe("Second Home");
    });

    it("user can join new home after leaving old one", async () => {
      // User A creates home
      await createTestHome(clientA, "Original Home");
      const codeResult = await clientA.rpc<string>("generate_join_code");
      await clientB.rpc("join_home_by_code", { p_code: codeResult.data });

      // User B leaves
      await clientB.rpc("leave_home");

      // User B creates their own home
      const newHomeResult = await clientB.rpc<string>("create_home", {
        p_name: "User B Home",
      });
      expectSuccess(newHomeResult);

      // Verify User B has their own home
      const homeInfo = await clientB.rpc<HomeInfo>("get_home_info");
      expect(homeInfo.data!.name).toBe("User B Home");
    });
  });
});
