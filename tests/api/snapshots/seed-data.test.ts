/**
 * Seed Data Integrity Tests
 *
 * Validates that migration consolidation preserved seed data correctly.
 * These are snapshot-style tests that verify the database has expected
 * baseline data after running migrations.
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  createAdminClient,
  setupTestHooks,
  TEST_CONFIG,
  TEST_USERS,
  signPostgrestToken,
  type PostgrestClient,
} from "../setup";
import { expectSuccess } from "../helpers";
import { createTestUser } from "../seed";

describe("Seed Data Integrity", () => {
  setupTestHooks();

  let adminClient: PostgrestClient;
  let adminToken: string;

  beforeAll(async () => {
    await createTestUser(TEST_USERS.admin);
    adminClient = await createAdminClient(TEST_USERS.admin.email);
    adminToken = await signPostgrestToken(TEST_USERS.admin.email);
  });

  describe("Email Templates", () => {
    it("should have all required email templates", async () => {
      const result = await adminClient.from("email_templates").select("name");

      expectSuccess(result);
      const names = (result.data as Array<{ name: string }>)
        .map((t) => t.name)
        .sort();
      expect(names).toEqual(["home_invitation", "password_reset", "welcome"]);
    });

    it("should have required fields on all templates", async () => {
      const result = await adminClient
        .from("email_templates")
        .select("name, subject, html_body, variables");

      expectSuccess(result);
      const templates = result.data as Array<{
        name: string;
        subject: string;
        html_body: string;
        variables: Record<string, string>;
      }>;

      expect(templates.length).toBe(3);

      for (const template of templates) {
        expect(template.subject).toBeTruthy();
        expect(template.html_body).toBeTruthy();
        // variables is a JSONB object with variable names as keys
        expect(typeof template.variables).toBe("object");
        expect(template.variables).not.toBeNull();
      }
    });

    it("welcome template should have expected variables", async () => {
      const result = await adminClient
        .from("email_templates")
        .select("variables")
        .eq("name", "welcome")
        .single();

      expectSuccess(result);
      const template = result.data as { variables: Record<string, string> };
      // variables is a JSONB object with variable names as keys
      expect(template.variables).toHaveProperty("user_name");
    });
  });

  describe("Foods", () => {
    it("should have expected base food count", async () => {
      // Use raw fetch with Prefer: count=exact to get total count without fetching all data
      const response = await fetch(
        `${TEST_CONFIG.POSTGREST_URL}/foods?status=eq.approved&created_by=is.null&select=id&limit=1`,
        {
          headers: {
            Authorization: `Bearer ${adminToken}`,
            Prefer: "count=exact",
          },
        }
      );

      expect(response.ok).toBe(true);

      // Parse Content-Range header: "0-0/2719" or "*/2719" for HEAD
      const contentRange = response.headers.get("Content-Range");
      expect(contentRange).not.toBeNull();

      // Extract total count from Content-Range (format: "start-end/total")
      const match = contentRange!.match(/\/(\d+)$/);
      expect(match).not.toBeNull();

      const totalCount = parseInt(match![1], 10);

      // Use a range to allow for minor seed data changes
      expect(totalCount).toBeGreaterThanOrEqual(2700);
      expect(totalCount).toBeLessThanOrEqual(3000);
    });

    it("should have foods with required fields", async () => {
      const result = await adminClient
        .from("foods")
        .select("id, name, status")
        .eq("status", "approved")
        .limit(10);

      expectSuccess(result);
      const foods = result.data as Array<{
        id: string;
        name: string;
        status: string;
      }>;

      for (const food of foods) {
        expect(food.id).toBeTruthy();
        expect(food.name).toBeTruthy();
        expect(food.status).toBe("approved");
      }
    });
  });

  describe("Units", () => {
    it("should have expected unit count", async () => {
      // Use raw fetch with Prefer: count=exact to get total count
      const response = await fetch(
        `${TEST_CONFIG.POSTGREST_URL}/units?select=id&limit=1`,
        {
          headers: {
            Authorization: `Bearer ${adminToken}`,
            Prefer: "count=exact",
          },
        }
      );

      expect(response.ok).toBe(true);

      const contentRange = response.headers.get("Content-Range");
      expect(contentRange).not.toBeNull();

      const match = contentRange!.match(/\/(\d+)$/);
      expect(match).not.toBeNull();

      const totalCount = parseInt(match![1], 10);
      // At least 32 seed units (tests may add more)
      expect(totalCount).toBeGreaterThanOrEqual(32);
    });

    it("should have all units with required fields", async () => {
      const result = await adminClient
        .from("units")
        .select("id, name, plural, abbreviation");

      expectSuccess(result);
      const units = result.data as Array<{
        id: string;
        name: string;
        plural: string;
        abbreviation: string;
      }>;

      // At least 32 seed units (tests may add more)
      expect(units.length).toBeGreaterThanOrEqual(32);

      for (const unit of units) {
        expect(unit.id).toBeTruthy();
        expect(typeof unit.name).toBe("string");
        expect(typeof unit.plural).toBe("string");
        expect(typeof unit.abbreviation).toBe("string");
      }
    });

    it("should have common units like 'st', 'dl', 'msk'", async () => {
      const result = await adminClient.from("units").select("abbreviation");

      expectSuccess(result);
      const abbreviations = (
        result.data as Array<{ abbreviation: string }>
      ).map((u) => u.abbreviation);

      expect(abbreviations).toContain("st");
      expect(abbreviations).toContain("dl");
      expect(abbreviations).toContain("msk");
      expect(abbreviations).toContain("tsk");
      expect(abbreviations).toContain("g");
      expect(abbreviations).toContain("kg");
      expect(abbreviations).toContain("l");
      expect(abbreviations).toContain("ml");
    });
  });
});
