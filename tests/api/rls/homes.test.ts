/**
 * RLS Security Tests for Homes and Home Invitations
 *
 * Tests Row-Level Security policies for:
 * - homes table: membership-based access, creator-only updates
 * - home_invitations table: inviter/invitee visibility, cancellation permissions
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
  resetCreatedResources,
  leaveAllHomes,
  uniqueId,
} from "../seed";
import {
  expectSuccess,
  expectNoError,
  expectRlsBlocked,
  expectHomeShape,
  expectInvitationShape,
} from "../helpers";

// Type definitions for database records
interface HomeRecord {
  id: string;
  name: string;
  join_code: string | null;
  join_code_expires_at: string | null;
  created_by_email: string;
  date_published: string;
  date_modified: string;
}

interface InvitationRecord {
  id: string;
  home_id: string;
  invited_email: string;
  invited_by_email: string;
  token: string;
  status: string;
  expires_at: string;
  responded_at: string | null;
  date_published: string;
}

interface PendingInvitation {
  id: string;
  home_id: string;
  home_name: string;
  invited_by_email: string;
  invited_by_name: string;
  token: string;
  expires_at: string;
  date_published: string;
}

describe("RLS: homes table", () => {
  setupTestHooks();

  let clientA: PostgrestClient;
  let clientB: PostgrestClient;
  let anonClient: PostgrestClient;
  let homeIdA: string;

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

    // Ensure users have no home before each test
    // Leave ALL existing homes (multi-home support)
    await leaveAllHomes(clientA);
    await leaveAllHomes(clientB);
  });

  afterAll(async () => {
    // Cleanup: leave all homes
    await leaveAllHomes(clientA);
    await leaveAllHomes(clientB);
    resetCreatedResources();
  });

  describe("SELECT policy", () => {
    it("home member can SELECT their home", async () => {
      // Create a home for user A
      homeIdA = await createTestHome(clientA, uniqueId("Home-A"));

      // User A should be able to see their home
      const result = await clientA.from("homes").select("*").eq("id", homeIdA);

      expectSuccess(result);
      const homes = result.data as HomeRecord[];
      expect(Array.isArray(homes)).toBe(true);
      expect(homes).toHaveLength(1);
      expectHomeShape(homes[0]);
      expect(homes[0].id).toBe(homeIdA);
    });

    it("non-member CANNOT see home details", async () => {
      // Create a home for user A
      homeIdA = await createTestHome(clientA, uniqueId("Home-A-Private"));

      // User B (not a member) should NOT see the home
      const result = await clientB.from("homes").select("*").eq("id", homeIdA);

      // RLS should block - empty result
      expectRlsBlocked(result);
    });

    it("anonymous user CANNOT access homes", async () => {
      // Create a home for user A
      homeIdA = await createTestHome(clientA, uniqueId("Home-A-Anon"));

      // Anonymous client should not see any homes
      const result = await anonClient
        .from("homes")
        .select("*")
        .eq("id", homeIdA);

      // Anonymous should get empty result due to RLS
      expectRlsBlocked(result);
    });

    it("member can see home after joining via code", async () => {
      // User A creates a home
      homeIdA = await createTestHome(clientA, uniqueId("Home-A-Join"));

      // Generate a join code
      const codeResult = await clientA.rpc<string>("generate_join_code", {
        p_expires_hours: 24,
      });
      expectSuccess(codeResult);
      const joinCode = codeResult.data;

      // User B joins using the code
      const joinResult = await clientB.rpc<string>("join_home_by_code", {
        p_code: joinCode,
      });
      expectSuccess(joinResult);

      // Now user B should see the home
      const selectResult = await clientB
        .from("homes")
        .select("*")
        .eq("id", homeIdA);

      expectSuccess(selectResult);
      const homes = selectResult.data as HomeRecord[];
      expect(homes).toHaveLength(1);
      expect(homes[0].id).toBe(homeIdA);
    });
  });

  describe("UPDATE policy", () => {
    it("home member can UPDATE their home", async () => {
      // Create a home for user A
      homeIdA = await createTestHome(clientA, uniqueId("Home-Update"));

      // Update home name via RPC (the proper way)
      const updateResult = await clientA.rpc("update_home_name", {
        p_name: "Updated Home Name",
      });

      expectNoError(updateResult);

      // Verify the update
      const selectResult = await clientA
        .from("homes")
        .select("name")
        .eq("id", homeIdA)
        .single();

      expectSuccess(selectResult);
      const home = selectResult.data as HomeRecord;
      expect(home.name).toBe("Updated Home Name");
    });

    it("non-member CANNOT UPDATE home they do not belong to", async () => {
      // Create a home for user A
      homeIdA = await createTestHome(clientA, uniqueId("Home-Update-Deny"));

      // User B tries to update via direct table access (should be blocked by RLS)
      const updateResult = await clientB
        .from("homes")
        .update({ name: "Hacked Name" })
        .eq("id", homeIdA);

      // RLS should block - no rows affected
      expectRlsBlocked(updateResult);

      // Verify the name was not changed
      const selectResult = await clientA
        .from("homes")
        .select("name")
        .eq("id", homeIdA)
        .single();

      expectSuccess(selectResult);
      const home = selectResult.data as HomeRecord;
      expect(home.name).not.toBe("Hacked Name");
    });
  });

  describe("INSERT policy", () => {
    it("authenticated user can INSERT a home they create", async () => {
      // Use the create_home RPC (the proper way to create homes)
      const result = await clientA.rpc<string>("create_home", {
        p_name: uniqueId("Home-Insert"),
      });

      expectSuccess(result);
      expect(typeof result.data).toBe("string");
      homeIdA = result.data!;

      // Verify it exists
      const selectResult = await clientA
        .from("homes")
        .select("*")
        .eq("id", homeIdA)
        .single();

      expectSuccess(selectResult);
    });

    it("user CANNOT insert home for another user as creator", async () => {
      // Attempt to directly insert with a different created_by_email
      // This should be blocked by the WITH CHECK policy
      const result = await clientA.from("homes").insert({
        name: uniqueId("Home-Fake-Creator"),
        created_by_email: TEST_USERS.userB.email, // Trying to impersonate
      });

      // Should fail due to RLS WITH CHECK
      expect(result.error).not.toBeNull();
    });
  });

  describe("DELETE policy", () => {
    it("home creator can DELETE their home (via leave_home when last member)", async () => {
      // Create a home for user A
      homeIdA = await createTestHome(clientA, uniqueId("Home-Delete"));

      // Store the ID before leaving
      const originalHomeId = homeIdA;

      // Leave the home (which should delete it since A is the only member)
      const leaveResult = await clientA.rpc("leave_home", {
        p_home_id: originalHomeId,
      });
      expectNoError(leaveResult);

      // Verify the home no longer exists
      // Need to check as a superuser or via a fresh query
      // Since user A left, they can't see it anymore anyway
      const selectResult = await clientA
        .from("homes")
        .select("*")
        .eq("id", originalHomeId);

      // Should be empty (home deleted)
      expectRlsBlocked(selectResult);
    });

    it("non-creator member CANNOT DELETE home directly", async () => {
      // Create a home for user A
      homeIdA = await createTestHome(clientA, uniqueId("Home-Delete-Deny"));

      // Generate join code and have B join
      const codeResult = await clientA.rpc<string>("generate_join_code", {
        p_expires_hours: 24,
      });
      expectSuccess(codeResult);

      await clientB.rpc("join_home_by_code", { p_code: codeResult.data });

      // User B tries to delete the home directly (not via leave_home)
      const deleteResult = await clientB
        .from("homes")
        .delete()
        .eq("id", homeIdA);

      // Should be blocked by RLS (only creator can delete)
      expectRlsBlocked(deleteResult);

      // Verify home still exists
      const selectResult = await clientA
        .from("homes")
        .select("*")
        .eq("id", homeIdA);

      expectSuccess(selectResult);
      expect(selectResult.data).toHaveLength(1);

      // Cleanup: B leaves the specific home
      await clientB.rpc("leave_home", { p_home_id: homeIdA });
    });
  });
});

describe("RLS: home_invitations table", () => {
  setupTestHooks();

  let clientA: PostgrestClient;
  let clientB: PostgrestClient;
  let clientC: PostgrestClient;
  let anonClient: PostgrestClient;
  let homeIdA: string;

  beforeAll(async () => {
    // Create test users
    await createTestUser(TEST_USERS.userA);
    await createTestUser(TEST_USERS.userB);
    // Create a third user for testing "unrelated" scenarios
    await createTestUser({
      email: "test-user-c@example.com",
      name: "Test User C",
      password: "TestPassword789!",
    });

    // Create authenticated clients
    clientA = await createAuthenticatedClient(TEST_USERS.userA.email);
    clientB = await createAuthenticatedClient(TEST_USERS.userB.email);
    clientC = await createAuthenticatedClient("test-user-c@example.com");
    anonClient = createAnonymousClient();
  });

  beforeEach(async () => {
    resetCreatedResources();

    // Ensure users have no home before each test
    // Leave ALL existing homes (multi-home support)
    for (const client of [clientA, clientB, clientC]) {
      await leaveAllHomes(client);
    }
  });

  afterAll(async () => {
    // Cleanup: leave all homes
    for (const client of [clientA, clientB, clientC]) {
      await leaveAllHomes(client);
    }
    resetCreatedResources();
  });

  describe("SELECT policy", () => {
    it("inviter can see invitations they sent", async () => {
      // User A creates a home and invites User B
      homeIdA = await createTestHome(clientA, uniqueId("Home-Invite-A"));

      const inviteResult = await clientA.rpc<string>("invite_to_home", {
        p_email: TEST_USERS.userB.email,
      });
      expectSuccess(inviteResult);
      const invitationId = inviteResult.data;

      // User A (inviter) should see the invitation
      const selectResult = await clientA
        .from("home_invitations")
        .select("*")
        .eq("id", invitationId);

      expectSuccess(selectResult);
      const invitations = selectResult.data as InvitationRecord[];
      expect(invitations).toHaveLength(1);
      expectInvitationShape(invitations[0]);
      expect(invitations[0].invited_by_email).toBe(TEST_USERS.userA.email);
    });

    it("invitee can see invitations sent to them", async () => {
      // User A creates a home and invites User B
      homeIdA = await createTestHome(clientA, uniqueId("Home-Invite-B"));

      const inviteResult = await clientA.rpc<string>("invite_to_home", {
        p_email: TEST_USERS.userB.email,
      });
      expectSuccess(inviteResult);
      const invitationId = inviteResult.data;

      // User B (invitee) should see the invitation
      const selectResult = await clientB
        .from("home_invitations")
        .select("*")
        .eq("id", invitationId);

      expectSuccess(selectResult);
      const invitations = selectResult.data as InvitationRecord[];
      expect(invitations).toHaveLength(1);
      expect(invitations[0].invited_email).toBe(TEST_USERS.userB.email);
    });

    it("unrelated user CANNOT see invitations not involving them", async () => {
      // User A creates a home and invites User B
      homeIdA = await createTestHome(clientA, uniqueId("Home-Invite-C"));

      const inviteResult = await clientA.rpc<string>("invite_to_home", {
        p_email: TEST_USERS.userB.email,
      });
      expectSuccess(inviteResult);
      const invitationId = inviteResult.data;

      // User C (unrelated) should NOT see the invitation
      const selectResult = await clientC
        .from("home_invitations")
        .select("*")
        .eq("id", invitationId);

      expectRlsBlocked(selectResult);
    });

    it("anonymous user CANNOT see any invitations", async () => {
      // User A creates a home and invites User B
      homeIdA = await createTestHome(clientA, uniqueId("Home-Invite-Anon"));

      const inviteResult = await clientA.rpc<string>("invite_to_home", {
        p_email: TEST_USERS.userB.email,
      });
      expectSuccess(inviteResult);
      const invitationId = inviteResult.data;

      // Anonymous client should not see any invitations
      const selectResult = await anonClient
        .from("home_invitations")
        .select("*")
        .eq("id", invitationId);

      expectRlsBlocked(selectResult);
    });
  });

  describe("INSERT policy", () => {
    it("home member can create invitations for their home", async () => {
      // User A creates a home
      homeIdA = await createTestHome(clientA, uniqueId("Home-Invite-Insert"));

      // User A invites User B (via RPC - the proper way)
      const inviteResult = await clientA.rpc<string>("invite_to_home", {
        p_email: TEST_USERS.userB.email,
      });

      expectSuccess(inviteResult);
      expect(typeof inviteResult.data).toBe("string");
    });

    it("non-member CANNOT create invitations for a home they do not belong to", async () => {
      // User A creates a home
      homeIdA = await createTestHome(clientA, uniqueId("Home-Invite-Insert-Deny"));

      // User C (not a member) tries to insert an invitation directly
      const insertResult = await clientC.from("home_invitations").insert({
        home_id: homeIdA,
        invited_email: TEST_USERS.userB.email,
        invited_by_email: "test-user-c@example.com",
        token: "a".repeat(64), // Fake token
      });

      // Should fail due to RLS WITH CHECK (is_home_member check)
      expect(insertResult.error).not.toBeNull();
    });
  });

  describe("UPDATE policy", () => {
    it("inviter can update invitations they sent", async () => {
      // User A creates a home and invites User B
      homeIdA = await createTestHome(clientA, uniqueId("Home-Invite-Update-A"));

      const inviteResult = await clientA.rpc<string>("invite_to_home", {
        p_email: TEST_USERS.userB.email,
      });
      expectSuccess(inviteResult);
      const invitationId = inviteResult.data;

      // User A (inviter) can update (e.g., cancel via RPC)
      const cancelResult = await clientA.rpc("cancel_invitation", {
        p_invitation_id: invitationId,
      });

      expectNoError(cancelResult);

      // Verify status changed
      const selectResult = await clientA
        .from("home_invitations")
        .select("status")
        .eq("id", invitationId)
        .single();

      expectSuccess(selectResult);
      const invitation = selectResult.data as InvitationRecord;
      expect(invitation.status).toBe("cancelled");
    });

    it("invitee can update invitations sent to them (accept/decline)", async () => {
      // User A creates a home and invites User B
      homeIdA = await createTestHome(clientA, uniqueId("Home-Invite-Update-B"));

      const inviteResult = await clientA.rpc<string>("invite_to_home", {
        p_email: TEST_USERS.userB.email,
      });
      expectSuccess(inviteResult);

      // Get the token for User B to accept
      const tokenResult = await clientB.rpc<PendingInvitation[]>("get_pending_invitations");
      expectSuccess(tokenResult);
      const pendingInvitations = tokenResult.data as PendingInvitation[];
      expect(pendingInvitations.length).toBeGreaterThan(0);

      const token = pendingInvitations[0].token;

      // User B declines the invitation
      const declineResult = await clientB.rpc("decline_invitation", {
        p_token: token,
      });

      expectNoError(declineResult);
    });

    it("unrelated user CANNOT update invitations not involving them", async () => {
      // User A creates a home and invites User B
      homeIdA = await createTestHome(clientA, uniqueId("Home-Invite-Update-C"));

      const inviteResult = await clientA.rpc<string>("invite_to_home", {
        p_email: TEST_USERS.userB.email,
      });
      expectSuccess(inviteResult);
      const invitationId = inviteResult.data;

      // User C tries to update the invitation directly
      const updateResult = await clientC
        .from("home_invitations")
        .update({ status: "cancelled" })
        .eq("id", invitationId);

      // Should be blocked by RLS
      expectRlsBlocked(updateResult);

      // Verify status unchanged
      const selectResult = await clientA
        .from("home_invitations")
        .select("status")
        .eq("id", invitationId)
        .single();

      expectSuccess(selectResult);
      const invitation = selectResult.data as InvitationRecord;
      expect(invitation.status).toBe("pending");
    });
  });

  describe("DELETE policy", () => {
    it("inviter can DELETE/cancel invitations they sent", async () => {
      // User A creates a home and invites User B
      homeIdA = await createTestHome(clientA, uniqueId("Home-Invite-Delete-A"));

      const inviteResult = await clientA.rpc<string>("invite_to_home", {
        p_email: TEST_USERS.userB.email,
      });
      expectSuccess(inviteResult);
      const invitationId = inviteResult.data;

      // User A can delete the invitation directly
      const deleteResult = await clientA
        .from("home_invitations")
        .delete()
        .eq("id", invitationId);

      expectSuccess(deleteResult);

      // Verify invitation is gone
      const selectResult = await clientA
        .from("home_invitations")
        .select("*")
        .eq("id", invitationId);

      expectRlsBlocked(selectResult);
    });

    it("invitee CANNOT DELETE invitations (only inviter can)", async () => {
      // User A creates a home and invites User B
      homeIdA = await createTestHome(clientA, uniqueId("Home-Invite-Delete-B"));

      const inviteResult = await clientA.rpc<string>("invite_to_home", {
        p_email: TEST_USERS.userB.email,
      });
      expectSuccess(inviteResult);
      const invitationId = inviteResult.data;

      // User B (invitee) tries to delete the invitation
      const deleteResult = await clientB
        .from("home_invitations")
        .delete()
        .eq("id", invitationId);

      // Should be blocked by RLS (only inviter can delete)
      expectRlsBlocked(deleteResult);

      // Verify invitation still exists
      const selectResult = await clientA
        .from("home_invitations")
        .select("*")
        .eq("id", invitationId);

      expectSuccess(selectResult);
      const invitations = selectResult.data as InvitationRecord[];
      expect(invitations).toHaveLength(1);
    });

    it("unrelated user CANNOT DELETE invitations not involving them", async () => {
      // User A creates a home and invites User B
      homeIdA = await createTestHome(clientA, uniqueId("Home-Invite-Delete-C"));

      const inviteResult = await clientA.rpc<string>("invite_to_home", {
        p_email: TEST_USERS.userB.email,
      });
      expectSuccess(inviteResult);
      const invitationId = inviteResult.data;

      // User C (unrelated) tries to delete the invitation
      const deleteResult = await clientC
        .from("home_invitations")
        .delete()
        .eq("id", invitationId);

      // Should be blocked by RLS
      expectRlsBlocked(deleteResult);

      // Verify invitation still exists
      const selectResult = await clientA
        .from("home_invitations")
        .select("*")
        .eq("id", invitationId);

      expectSuccess(selectResult);
      const invitations = selectResult.data as InvitationRecord[];
      expect(invitations).toHaveLength(1);
    });
  });
});
