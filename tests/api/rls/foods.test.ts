/**
 * RLS Security Tests for Foods and Units
 *
 * Tests Row-Level Security policies for:
 * - foods table: status-based visibility, admin approval/rejection, ownership
 * - units table: public read access, admin-only modifications
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
  getOrCreateFood,
  uniqueId,
} from "../seed";
import {
  expectSuccess,
  expectRlsBlocked,
  expectFoodShape,
  expectUnitShape,
} from "../helpers";

// Type guards for database records
function isFoodRecord(data: unknown): data is {
  id: string;
  name: string;
  status: "approved" | "pending" | "rejected";
  created_by: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
} {
  return (
    typeof data === "object" &&
    data !== null &&
    "id" in data &&
    "name" in data &&
    "status" in data
  );
}

function isUnitRecord(data: unknown): data is {
  id: string;
  name: string;
  plural: string;
  abbreviation: string;
} {
  return (
    typeof data === "object" &&
    data !== null &&
    "id" in data &&
    "name" in data &&
    "plural" in data
  );
}

function isUnitArray(data: unknown): data is Array<{
  id: string;
  name: string;
  plural: string;
  abbreviation: string;
}> {
  return Array.isArray(data) && data.every(isUnitRecord);
}

describe("RLS: foods table", () => {
  setupTestHooks();

  let clientA: PostgrestClient;
  let clientB: PostgrestClient;
  let adminClient: PostgrestClient;
  let anonClient: PostgrestClient;

  beforeAll(async () => {
    await createTestUser(TEST_USERS.userA);
    await createTestUser(TEST_USERS.userB);
    await createTestUser(TEST_USERS.admin);

    clientA = await createAuthenticatedClient(TEST_USERS.userA.email);
    clientB = await createAuthenticatedClient(TEST_USERS.userB.email);
    adminClient = await createAdminClient(TEST_USERS.admin.email);
    anonClient = createAnonymousClient();
  });

  beforeEach(() => {
    resetCreatedResources();
  });

  afterAll(() => {
    resetCreatedResources();
  });

  describe("SELECT policy", () => {
    it("anonymous can read approved foods", async () => {
      const foodName = uniqueId("ApprovedFood");
      const insertResult = await adminClient
        .from("foods")
        .insert({
          name: foodName,
          status: "approved",
          created_by: TEST_USERS.admin.email,
        })
        .select()
        .single();

      expectSuccess(insertResult);
      expect(isFoodRecord(insertResult.data)).toBe(true);
      if (!isFoodRecord(insertResult.data)) return;

      const result = await anonClient
        .from("foods")
        .select("*")
        .eq("id", insertResult.data.id)
        .single();

      expectSuccess(result);
      expect(isFoodRecord(result.data)).toBe(true);
      if (isFoodRecord(result.data)) {
        expect(result.data.id).toBe(insertResult.data.id);
        expect(result.data.status).toBe("approved");
      }
    });

    it("anonymous CANNOT read pending foods", async () => {
      const foodName = uniqueId("PendingFood");
      const foodData = await getOrCreateFood(clientA, foodName);

      await adminClient
        .from("foods")
        .update({ status: "pending" })
        .eq("id", foodData.id);

      const result = await anonClient
        .from("foods")
        .select("*")
        .eq("id", foodData.id);

      expectRlsBlocked(result);
    });

    it("anonymous CANNOT read rejected foods", async () => {
      const foodName = uniqueId("RejectedFood");
      const insertResult = await adminClient
        .from("foods")
        .insert({
          name: foodName,
          status: "rejected",
          created_by: TEST_USERS.admin.email,
          reviewed_by: TEST_USERS.admin.email,
          reviewed_at: new Date().toISOString(),
        })
        .select()
        .single();

      expectSuccess(insertResult);
      expect(isFoodRecord(insertResult.data)).toBe(true);
      if (!isFoodRecord(insertResult.data)) return;

      const result = await anonClient
        .from("foods")
        .select("*")
        .eq("id", insertResult.data.id);

      expectRlsBlocked(result);
    });

    it("authenticated user can read approved foods", async () => {
      const foodName = uniqueId("ApprovedForAuth");
      const insertResult = await adminClient
        .from("foods")
        .insert({
          name: foodName,
          status: "approved",
          created_by: TEST_USERS.admin.email,
        })
        .select()
        .single();

      expectSuccess(insertResult);
      expect(isFoodRecord(insertResult.data)).toBe(true);
      if (!isFoodRecord(insertResult.data)) return;

      const result = await clientA
        .from("foods")
        .select("*")
        .eq("id", insertResult.data.id)
        .single();

      expectSuccess(result);
      expect(isFoodRecord(result.data)).toBe(true);
      if (isFoodRecord(result.data)) {
        expect(result.data.id).toBe(insertResult.data.id);
        expect(result.data.status).toBe("approved");
      }
    });

    it("authenticated user can read own pending foods", async () => {
      const foodName = uniqueId("OwnPending");
      const foodData = await getOrCreateFood(clientA, foodName);

      await adminClient
        .from("foods")
        .update({
          status: "pending",
          created_by: TEST_USERS.userA.email,
        })
        .eq("id", foodData.id);

      const result = await clientA
        .from("foods")
        .select("*")
        .eq("id", foodData.id)
        .single();

      expectSuccess(result);
      expect(isFoodRecord(result.data)).toBe(true);
      if (isFoodRecord(result.data)) {
        expect(result.data.id).toBe(foodData.id);
        expect(result.data.status).toBe("pending");
        expect(result.data.created_by).toBe(TEST_USERS.userA.email);
      }
    });

    it("authenticated user CANNOT read other users pending foods", async () => {
      const foodName = uniqueId("OtherPending");
      const foodData = await getOrCreateFood(clientA, foodName);

      await adminClient
        .from("foods")
        .update({
          status: "pending",
          created_by: TEST_USERS.userA.email,
        })
        .eq("id", foodData.id);

      const result = await clientB
        .from("foods")
        .select("*")
        .eq("id", foodData.id);

      expectRlsBlocked(result);
    });

    it("admin can read all food statuses", async () => {
      const approvedName = uniqueId("AdminApproved");
      const pendingName = uniqueId("AdminPending");
      const rejectedName = uniqueId("AdminRejected");

      const approvedResult = await adminClient
        .from("foods")
        .insert({
          name: approvedName,
          status: "approved",
          created_by: TEST_USERS.admin.email,
        })
        .select()
        .single();

      const pendingResult = await adminClient
        .from("foods")
        .insert({
          name: pendingName,
          status: "pending",
          created_by: TEST_USERS.userA.email,
        })
        .select()
        .single();

      const rejectedResult = await adminClient
        .from("foods")
        .insert({
          name: rejectedName,
          status: "rejected",
          created_by: TEST_USERS.userB.email,
          reviewed_by: TEST_USERS.admin.email,
          reviewed_at: new Date().toISOString(),
        })
        .select()
        .single();

      expectSuccess(approvedResult);
      expectSuccess(pendingResult);
      expectSuccess(rejectedResult);

      expect(isFoodRecord(approvedResult.data)).toBe(true);
      expect(isFoodRecord(pendingResult.data)).toBe(true);
      expect(isFoodRecord(rejectedResult.data)).toBe(true);

      if (!isFoodRecord(approvedResult.data)) return;
      if (!isFoodRecord(pendingResult.data)) return;
      if (!isFoodRecord(rejectedResult.data)) return;

      const approvedCheck = await adminClient
        .from("foods")
        .select("*")
        .eq("id", approvedResult.data.id)
        .single();

      const pendingCheck = await adminClient
        .from("foods")
        .select("*")
        .eq("id", pendingResult.data.id)
        .single();

      const rejectedCheck = await adminClient
        .from("foods")
        .select("*")
        .eq("id", rejectedResult.data.id)
        .single();

      expectSuccess(approvedCheck);
      expectSuccess(pendingCheck);
      expectSuccess(rejectedCheck);

      expect(isFoodRecord(approvedCheck.data)).toBe(true);
      expect(isFoodRecord(pendingCheck.data)).toBe(true);
      expect(isFoodRecord(rejectedCheck.data)).toBe(true);

      if (isFoodRecord(approvedCheck.data)) {
        expect(approvedCheck.data.status).toBe("approved");
      }
      if (isFoodRecord(pendingCheck.data)) {
        expect(pendingCheck.data.status).toBe("pending");
      }
      if (isFoodRecord(rejectedCheck.data)) {
        expect(rejectedCheck.data.status).toBe("rejected");
      }
    });
  });

  describe("UPDATE policy (approve/reject)", () => {
    it("only admin can change food status", async () => {
      const foodName = uniqueId("ToApprove");
      const insertResult = await adminClient
        .from("foods")
        .insert({
          name: foodName,
          status: "pending",
          created_by: TEST_USERS.userA.email,
        })
        .select()
        .single();

      expectSuccess(insertResult);
      expect(isFoodRecord(insertResult.data)).toBe(true);
      if (!isFoodRecord(insertResult.data)) return;

      const updateResult = await adminClient
        .from("foods")
        .update({
          status: "approved",
          reviewed_by: TEST_USERS.admin.email,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", insertResult.data.id)
        .select()
        .single();

      expectSuccess(updateResult);
      expect(isFoodRecord(updateResult.data)).toBe(true);
      if (isFoodRecord(updateResult.data)) {
        expect(updateResult.data.status).toBe("approved");
        expect(updateResult.data.reviewed_by).toBe(TEST_USERS.admin.email);
      }
    });

    it("regular user CANNOT approve foods", async () => {
      const foodName = uniqueId("UserCannotApprove");
      const insertResult = await adminClient
        .from("foods")
        .insert({
          name: foodName,
          status: "pending",
          created_by: TEST_USERS.userA.email,
        })
        .select()
        .single();

      expectSuccess(insertResult);
      expect(isFoodRecord(insertResult.data)).toBe(true);
      if (!isFoodRecord(insertResult.data)) return;

      const updateResult = await clientA
        .from("foods")
        .update({
          status: "approved",
          reviewed_by: TEST_USERS.userA.email,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", insertResult.data.id);

      expectRlsBlocked(updateResult);

      const checkResult = await adminClient
        .from("foods")
        .select("*")
        .eq("id", insertResult.data.id)
        .single();

      expectSuccess(checkResult);
      expect(isFoodRecord(checkResult.data)).toBe(true);
      if (isFoodRecord(checkResult.data)) {
        expect(checkResult.data.status).toBe("pending");
      }
    });

    it("regular user CANNOT reject foods", async () => {
      const foodName = uniqueId("UserCannotReject");
      const insertResult = await adminClient
        .from("foods")
        .insert({
          name: foodName,
          status: "pending",
          created_by: TEST_USERS.userB.email,
        })
        .select()
        .single();

      expectSuccess(insertResult);
      expect(isFoodRecord(insertResult.data)).toBe(true);
      if (!isFoodRecord(insertResult.data)) return;

      const updateResult = await clientA
        .from("foods")
        .update({
          status: "rejected",
          reviewed_by: TEST_USERS.userA.email,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", insertResult.data.id);

      expectRlsBlocked(updateResult);

      const checkResult = await adminClient
        .from("foods")
        .select("*")
        .eq("id", insertResult.data.id)
        .single();

      expectSuccess(checkResult);
      expect(isFoodRecord(checkResult.data)).toBe(true);
      if (isFoodRecord(checkResult.data)) {
        expect(checkResult.data.status).toBe("pending");
      }
    });
  });

  describe("INSERT policy", () => {
    it("authenticated user can create pending foods via direct INSERT", async () => {
      const foodName = uniqueId("UserCreated");

      // Direct table INSERT — authenticated still has INSERT grant (V12 only revoked UPDATE/DELETE)
      // RLS INSERT policy requires created_by to match the JWT email
      const insertResult = await clientA
        .from("foods")
        .insert({ name: foodName, status: "pending", created_by: TEST_USERS.userA.email })
        .select()
        .single();

      expectSuccess(insertResult);
      expect(isFoodRecord(insertResult.data)).toBe(true);
      if (isFoodRecord(insertResult.data)) {
        expectFoodShape(insertResult.data);
        expect(insertResult.data.name).toBe(foodName);
        expect(insertResult.data.status).toBe("pending");
        expect(insertResult.data.created_by).toBe(TEST_USERS.userA.email);
      }
    });

    it("anonymous CANNOT create foods", async () => {
      const foodName = uniqueId("AnonFood");
      const insertResult = await anonClient.from("foods").insert({
        name: foodName,
        status: "pending",
      });

      expect(insertResult.error).not.toBeNull();
    });
  });

  describe("DELETE policy", () => {
    it("only admin can delete foods", async () => {
      const foodName = uniqueId("ToDelete");
      const insertResult = await adminClient
        .from("foods")
        .insert({
          name: foodName,
          status: "pending",
          created_by: TEST_USERS.userA.email,
        })
        .select()
        .single();

      expectSuccess(insertResult);
      expect(isFoodRecord(insertResult.data)).toBe(true);
      if (!isFoodRecord(insertResult.data)) return;

      const deleteResult = await adminClient
        .from("foods")
        .delete()
        .eq("id", insertResult.data.id);

      expectSuccess(deleteResult);

      const checkResult = await adminClient
        .from("foods")
        .select("*")
        .eq("id", insertResult.data.id);

      expectRlsBlocked(checkResult);
    });

    it("regular user CANNOT delete foods", async () => {
      const foodName = uniqueId("CannotDelete");
      const insertResult = await adminClient
        .from("foods")
        .insert({
          name: foodName,
          status: "pending",
          created_by: TEST_USERS.userA.email,
        })
        .select()
        .single();

      expectSuccess(insertResult);
      expect(isFoodRecord(insertResult.data)).toBe(true);
      if (!isFoodRecord(insertResult.data)) return;

      const deleteResult = await clientA
        .from("foods")
        .delete()
        .eq("id", insertResult.data.id);

      expectRlsBlocked(deleteResult);

      const checkResult = await adminClient
        .from("foods")
        .select("*")
        .eq("id", insertResult.data.id)
        .single();

      expectSuccess(checkResult);
    });
  });
});

describe("RLS: units table", () => {
  setupTestHooks();

  let clientA: PostgrestClient;
  let adminClient: PostgrestClient;
  let anonClient: PostgrestClient;

  beforeAll(async () => {
    await createTestUser(TEST_USERS.userA);
    await createTestUser(TEST_USERS.admin);

    clientA = await createAuthenticatedClient(TEST_USERS.userA.email);
    adminClient = await createAdminClient(TEST_USERS.admin.email);
    anonClient = createAnonymousClient();
  });

  beforeEach(() => {
    resetCreatedResources();
  });

  afterAll(() => {
    resetCreatedResources();
  });

  describe("SELECT policy", () => {
    it("anonymous can read all units", async () => {
      const result = await anonClient
        .from("units")
        .select("*")
        .limit(5);

      expectSuccess(result);
      expect(isUnitArray(result.data)).toBe(true);
      if (isUnitArray(result.data)) {
        expect(result.data.length).toBeGreaterThan(0);
        if (result.data.length > 0) {
          expectUnitShape(result.data[0]);
        }
      }
    });

    it("authenticated user can read all units", async () => {
      const result = await clientA
        .from("units")
        .select("*")
        .limit(5);

      expectSuccess(result);
      expect(isUnitArray(result.data)).toBe(true);
      if (isUnitArray(result.data)) {
        expect(result.data.length).toBeGreaterThan(0);
        if (result.data.length > 0) {
          expectUnitShape(result.data[0]);
        }
      }
    });

    it("admin can read all units", async () => {
      const result = await adminClient
        .from("units")
        .select("*")
        .limit(5);

      expectSuccess(result);
      expect(isUnitArray(result.data)).toBe(true);
      if (isUnitArray(result.data)) {
        expect(result.data.length).toBeGreaterThan(0);
      }
    });
  });

  describe("INSERT policy", () => {
    it("only admin can insert units", async () => {
      const unitName = uniqueId("AdminUnit");

      const insertResult = await adminClient
        .from("units")
        .insert({
          name: unitName,
          plural: `${unitName}s`,
          abbreviation: unitName.slice(0, 3),
        })
        .select()
        .single();

      expectSuccess(insertResult);
      expect(isUnitRecord(insertResult.data)).toBe(true);
      if (isUnitRecord(insertResult.data)) {
        expect(insertResult.data.name).toBe(unitName);
        // Cleanup
        await adminClient.from("units").delete().eq("id", insertResult.data.id);
      }
    });

    it("regular user CANNOT insert units", async () => {
      const unitName = uniqueId("UserUnit");

      const insertResult = await clientA.from("units").insert({
        name: unitName,
        plural: `${unitName}s`,
        abbreviation: unitName.slice(0, 3),
      });

      expect(insertResult.error).not.toBeNull();
    });

    it("anonymous CANNOT insert units", async () => {
      const unitName = uniqueId("AnonUnit");

      const insertResult = await anonClient.from("units").insert({
        name: unitName,
        plural: `${unitName}s`,
        abbreviation: unitName.slice(0, 3),
      });

      expect(insertResult.error).not.toBeNull();
    });
  });

  describe("UPDATE policy", () => {
    it("only admin can update units", async () => {
      const unitName = uniqueId("UpdateTest");
      const insertResult = await adminClient
        .from("units")
        .insert({
          name: unitName,
          plural: `${unitName}s`,
          abbreviation: unitName.slice(0, 3),
        })
        .select()
        .single();

      expectSuccess(insertResult);
      expect(isUnitRecord(insertResult.data)).toBe(true);
      if (!isUnitRecord(insertResult.data)) return;

      const newName = `${unitName}-Updated`;
      const updateResult = await adminClient
        .from("units")
        .update({ name: newName })
        .eq("id", insertResult.data.id)
        .select()
        .single();

      expectSuccess(updateResult);
      expect(isUnitRecord(updateResult.data)).toBe(true);
      if (isUnitRecord(updateResult.data)) {
        expect(updateResult.data.name).toBe(newName);
      }

      // Cleanup
      await adminClient.from("units").delete().eq("id", insertResult.data.id);
    });

    it("regular user CANNOT update units", async () => {
      const unitName = uniqueId("UserCannotUpdate");
      const insertResult = await adminClient
        .from("units")
        .insert({
          name: unitName,
          plural: `${unitName}s`,
          abbreviation: unitName.slice(0, 3),
        })
        .select()
        .single();

      expectSuccess(insertResult);
      expect(isUnitRecord(insertResult.data)).toBe(true);
      if (!isUnitRecord(insertResult.data)) return;
      const unitId = insertResult.data.id;

      try {
        const updateResult = await clientA
          .from("units")
          .update({ name: "Hacked" })
          .eq("id", unitId);

        expectRlsBlocked(updateResult);

        // Verify name unchanged
        const checkResult = await adminClient
          .from("units")
          .select("*")
          .eq("id", unitId)
          .single();

        expectSuccess(checkResult);
        expect(isUnitRecord(checkResult.data)).toBe(true);
        if (isUnitRecord(checkResult.data)) {
          expect(checkResult.data.name).toBe(unitName);
        }
      } finally {
        // Cleanup
        await adminClient.from("units").delete().eq("id", unitId);
      }
    });

    it("anonymous CANNOT update units", async () => {
      const unitName = uniqueId("AnonCannotUpdate");
      const insertResult = await adminClient
        .from("units")
        .insert({
          name: unitName,
          plural: `${unitName}s`,
          abbreviation: unitName.slice(0, 3),
        })
        .select()
        .single();

      expectSuccess(insertResult);
      expect(isUnitRecord(insertResult.data)).toBe(true);
      if (!isUnitRecord(insertResult.data)) return;
      const unitId = insertResult.data.id;

      try {
        const updateResult = await anonClient
          .from("units")
          .update({ name: "Hacked" })
          .eq("id", unitId);

        if (updateResult.error) {
          expect(updateResult.error).not.toBeNull();
        } else {
          expectRlsBlocked(updateResult);
        }

        // Verify name unchanged via admin
        const checkResult = await adminClient
          .from("units")
          .select("*")
          .eq("id", unitId)
          .single();

        expectSuccess(checkResult);
        expect(isUnitRecord(checkResult.data)).toBe(true);
        if (isUnitRecord(checkResult.data)) {
          expect(checkResult.data.name).toBe(unitName);
        }
      } finally {
        // Cleanup
        await adminClient.from("units").delete().eq("id", unitId);
      }
    });
  });

  describe("DELETE policy", () => {
    it("only admin can delete units", async () => {
      const unitName = uniqueId("DeleteTest");
      const insertResult = await adminClient
        .from("units")
        .insert({
          name: unitName,
          plural: `${unitName}s`,
          abbreviation: unitName.slice(0, 3),
        })
        .select()
        .single();

      expectSuccess(insertResult);
      expect(isUnitRecord(insertResult.data)).toBe(true);
      if (!isUnitRecord(insertResult.data)) return;

      const deleteResult = await adminClient
        .from("units")
        .delete()
        .eq("id", insertResult.data.id);

      expectSuccess(deleteResult);

      const checkResult = await anonClient
        .from("units")
        .select("*")
        .eq("id", insertResult.data.id);

      expectRlsBlocked(checkResult);
    });

    it("regular user CANNOT delete units", async () => {
      const unitName = uniqueId("UserCannotDelete");
      const insertResult = await adminClient
        .from("units")
        .insert({
          name: unitName,
          plural: `${unitName}s`,
          abbreviation: unitName.slice(0, 3),
        })
        .select()
        .single();

      expectSuccess(insertResult);
      expect(isUnitRecord(insertResult.data)).toBe(true);
      if (!isUnitRecord(insertResult.data)) return;
      const unitId = insertResult.data.id;

      try {
        const deleteResult = await clientA
          .from("units")
          .delete()
          .eq("id", unitId);

        expectRlsBlocked(deleteResult);

        // Verify unit still exists via admin
        const checkResult = await adminClient
          .from("units")
          .select("*")
          .eq("id", unitId)
          .single();

        expectSuccess(checkResult);
      } finally {
        // Cleanup
        await adminClient.from("units").delete().eq("id", unitId);
      }
    });

    it("anonymous CANNOT delete units", async () => {
      const unitName = uniqueId("AnonCannotDelete");
      const insertResult = await adminClient
        .from("units")
        .insert({
          name: unitName,
          plural: `${unitName}s`,
          abbreviation: unitName.slice(0, 3),
        })
        .select()
        .single();

      expectSuccess(insertResult);
      expect(isUnitRecord(insertResult.data)).toBe(true);
      if (!isUnitRecord(insertResult.data)) return;
      const unitId = insertResult.data.id;

      try {
        const deleteResult = await anonClient
          .from("units")
          .delete()
          .eq("id", unitId);

        if (deleteResult.error) {
          expect(deleteResult.error).not.toBeNull();
        } else {
          expectRlsBlocked(deleteResult);
        }

        // Verify unit still exists via admin
        const checkResult = await adminClient
          .from("units")
          .select("*")
          .eq("id", unitId)
          .single();

        expectSuccess(checkResult);
      } finally {
        // Cleanup
        await adminClient.from("units").delete().eq("id", unitId);
      }
    });
  });
});
