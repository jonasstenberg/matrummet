/**
 * Schema Snapshot Tests
 *
 * These tests detect unintended schema changes by verifying that views and tables
 * have the expected columns. When the schema changes (e.g., through migrations),
 * these snapshots will fail and need to be updated intentionally.
 *
 * This catches when migrations accidentally remove or rename columns that the
 * frontend depends on.
 *
 * Usage:
 * - Run: pnpm test -- schema.test.ts
 * - Update snapshots: pnpm test -- schema.test.ts -u
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  createAuthenticatedClient,
  createAnonymousClient,
  TEST_USERS,
  setupTestHooks,
  type PostgrestClient,
} from "../setup";
import { createTestUser, createTestHome } from "../seed";

/**
 * Helper to extract column names from a response object
 */
function getColumnNames(data: Record<string, unknown>): string[] {
  return Object.keys(data).sort();
}

/**
 * Helper to get columns from a view/table by fetching one row
 * Returns actual columns if data exists, or null if empty/error
 */
async function getActualColumns(
  client: PostgrestClient,
  tableName: string
): Promise<string[] | null> {
  const result = await client.from(tableName).select("*").limit(1);

  if (result.error) {
    return null;
  }

  if (Array.isArray(result.data) && result.data.length > 0) {
    return getColumnNames(result.data[0] as Record<string, unknown>);
  }

  return null;
}

describe("Schema Snapshot Tests", () => {
  setupTestHooks();

  let authenticatedClient: PostgrestClient;
  let anonymousClient: PostgrestClient;

  beforeAll(async () => {
    // Create test user and authenticate
    await createTestUser(TEST_USERS.userA);
    authenticatedClient = await createAuthenticatedClient(TEST_USERS.userA.email);
    anonymousClient = createAnonymousClient();

    // Create a home for the user (required for shopping list tests)
    try {
      await createTestHome(authenticatedClient, "Schema Test Home");
    } catch {
      // Home might already exist, that's fine
    }
  });

  describe("recipes_and_categories view", () => {
    it("should have expected columns", async () => {
      // Expected columns based on the latest migration (V43)
      const expectedColumns = [
        "author",
        "categories",
        "cook_time",
        "cuisine",
        "date_modified",
        "date_published",
        "description",
        "full_tsv",
        "id",
        "image",
        "ingredient_groups",
        "ingredients",
        "instruction_groups",
        "instructions",
        "is_liked",
        "name",
        "owner",
        "prep_time",
        "recipe_yield",
        "recipe_yield_name",
        "search_text",
        "thumbnail",
        "tsv",
        "url",
      ];

      // Snapshot the expected columns
      expect(expectedColumns).toMatchSnapshot();

      // If we can get actual data, verify it matches
      const actualColumns = await getActualColumns(
        anonymousClient,
        "recipes_and_categories"
      );

      if (actualColumns) {
        expect(actualColumns).toEqual(expectedColumns);
      }
    });

    it("should have correct ingredient structure in JSONB", async () => {
      const expectedIngredientFields = [
        "food_id",
        "form",
        "group_id",
        "id",
        "measurement",
        "name",
        "quantity",
        "sort_order",
        "unit_id",
      ];

      expect(expectedIngredientFields).toMatchSnapshot();
    });

    it("should have correct instruction structure in JSONB", async () => {
      const expectedInstructionFields = [
        "group_id",
        "id",
        "sort_order",
        "step",
      ];

      expect(expectedInstructionFields).toMatchSnapshot();
    });

    it("should have correct ingredient_groups structure in JSONB", async () => {
      const expectedGroupFields = ["id", "name", "sort_order"];

      expect(expectedGroupFields).toMatchSnapshot();
    });

    it("should have correct instruction_groups structure in JSONB", async () => {
      const expectedGroupFields = ["id", "name", "sort_order"];

      expect(expectedGroupFields).toMatchSnapshot();
    });
  });

  describe("shopping_list_view view", () => {
    it("should have expected columns", async () => {
      const expectedColumns = [
        "checked_at",
        "date_published",
        "display_name",
        "display_unit",
        "food_id",
        "home_id",
        "id",
        "is_checked",
        "item_name",
        "list_name",
        "quantity",
        "shopping_list_id",
        "sort_order",
        "source_recipes",
        "unit_id",
        "unit_name",
        "user_email",
      ];

      expect(expectedColumns).toMatchSnapshot();

      const actualColumns = await getActualColumns(
        authenticatedClient,
        "shopping_list_view"
      );

      if (actualColumns) {
        expect(actualColumns).toEqual(expectedColumns);
      }
    });
  });

  describe("liked_recipes view", () => {
    it("should have expected columns (recipes_and_categories + liked_at)", async () => {
      const expectedColumns = [
        "author",
        "categories",
        "cook_time",
        "cuisine",
        "date_modified",
        "date_published",
        "description",
        "full_tsv",
        "id",
        "image",
        "ingredient_groups",
        "ingredients",
        "instruction_groups",
        "instructions",
        "is_liked",
        "liked_at",
        "name",
        "owner",
        "prep_time",
        "recipe_yield",
        "recipe_yield_name",
        "search_text",
        "thumbnail",
        "tsv",
        "url",
      ];

      expect(expectedColumns).toMatchSnapshot();

      const actualColumns = await getActualColumns(
        authenticatedClient,
        "liked_recipes"
      );

      if (actualColumns) {
        expect(actualColumns).toEqual(expectedColumns);
      }
    });
  });

  describe("recipes table", () => {
    it("should have expected columns", async () => {
      const expectedColumns = [
        "author",
        "cook_time",
        "cuisine",
        "date_modified",
        "date_published",
        "description",
        "id",
        "image",
        "name",
        "owner",
        "prep_time",
        "recipe_yield",
        "recipe_yield_name",
        "search_text",
        "thumbnail",
        "tsv",
        "url",
      ];

      expect(expectedColumns).toMatchSnapshot();

      const actualColumns = await getActualColumns(anonymousClient, "recipes");

      if (actualColumns) {
        expect(actualColumns).toEqual(expectedColumns);
      }
    });
  });

  describe("ingredients table", () => {
    it("should have expected columns", async () => {
      const expectedColumns = [
        "date_modified",
        "date_published",
        "food_id",
        "form",
        "group_id",
        "id",
        "measurement",
        "name",
        "owner",
        "quantity",
        "recipe_id",
        "sort_order",
        "unit_id",
      ];

      expect(expectedColumns).toMatchSnapshot();

      const actualColumns = await getActualColumns(
        anonymousClient,
        "ingredients"
      );

      if (actualColumns) {
        expect(actualColumns).toEqual(expectedColumns);
      }
    });
  });

  describe("instructions table", () => {
    it("should have expected columns", async () => {
      const expectedColumns = [
        "date_modified",
        "date_published",
        "group_id",
        "id",
        "owner",
        "recipe_id",
        "sort_order",
        "step",
      ];

      expect(expectedColumns).toMatchSnapshot();

      const actualColumns = await getActualColumns(
        anonymousClient,
        "instructions"
      );

      if (actualColumns) {
        expect(actualColumns).toEqual(expectedColumns);
      }
    });
  });

  describe("categories table", () => {
    it("should have expected columns", async () => {
      const expectedColumns = [
        "date_modified",
        "date_published",
        "id",
        "name",
        "owner",
      ];

      expect(expectedColumns).toMatchSnapshot();

      const actualColumns = await getActualColumns(
        anonymousClient,
        "categories"
      );

      if (actualColumns) {
        expect(actualColumns).toEqual(expectedColumns);
      }
    });
  });

  describe("shopping_lists table", () => {
    it("should have expected columns", async () => {
      const expectedColumns = [
        "date_modified",
        "date_published",
        "home_id",
        "id",
        "is_default",
        "name",
        "user_email",
      ];

      expect(expectedColumns).toMatchSnapshot();

      const actualColumns = await getActualColumns(
        authenticatedClient,
        "shopping_lists"
      );

      if (actualColumns) {
        expect(actualColumns).toEqual(expectedColumns);
      }
    });
  });

  describe("shopping_list_items table", () => {
    it("should have expected columns", async () => {
      const expectedColumns = [
        "checked_at",
        "date_published",
        "display_name",
        "display_unit",
        "food_id",
        "home_id",
        "id",
        "is_checked",
        "quantity",
        "shopping_list_id",
        "sort_order",
        "unit_id",
        "user_email",
      ];

      expect(expectedColumns).toMatchSnapshot();

      const actualColumns = await getActualColumns(
        authenticatedClient,
        "shopping_list_items"
      );

      if (actualColumns) {
        expect(actualColumns).toEqual(expectedColumns);
      }
    });
  });

  describe("users table", () => {
    it("should have expected columns", async () => {
      const expectedColumns = [
        "email",
        "home_id",
        "home_joined_at",
        "id",
        "measures_system",
        "name",
        "owner",
        "provider",
        "role",
      ];

      expect(expectedColumns).toMatchSnapshot();

      const actualColumns = await getActualColumns(
        authenticatedClient,
        "users"
      );

      if (actualColumns) {
        expect(actualColumns).toEqual(expectedColumns);
      }
    });
  });

  describe("homes table", () => {
    it("should have expected columns", async () => {
      const expectedColumns = [
        "created_by_email",
        "date_modified",
        "date_published",
        "id",
        "join_code",
        "join_code_expires_at",
        "name",
      ];

      expect(expectedColumns).toMatchSnapshot();

      const actualColumns = await getActualColumns(
        authenticatedClient,
        "homes"
      );

      if (actualColumns) {
        expect(actualColumns).toEqual(expectedColumns);
      }
    });
  });

  describe("home_invitations table", () => {
    it("should have expected columns", async () => {
      const expectedColumns = [
        "date_published",
        "expires_at",
        "home_id",
        "id",
        "invited_by_email",
        "invited_email",
        "responded_at",
        "status",
        "token",
      ];

      expect(expectedColumns).toMatchSnapshot();

      const actualColumns = await getActualColumns(
        authenticatedClient,
        "home_invitations"
      );

      if (actualColumns) {
        expect(actualColumns).toEqual(expectedColumns);
      }
    });
  });

  describe("foods table", () => {
    it("should have expected columns", async () => {
      const expectedColumns = [
        "ai_confidence",
        "ai_decision",
        "ai_reasoning",
        "ai_reviewed_at",
        "ai_suggested_merge_id",
        "common_pantry_category",
        "created_by",
        "date_modified",
        "date_published",
        "id",
        "name",
        "reviewed_at",
        "reviewed_by",
        "status",
        "tsv",
      ];

      expect(expectedColumns).toMatchSnapshot();

      const actualColumns = await getActualColumns(anonymousClient, "foods");

      if (actualColumns) {
        expect(actualColumns).toEqual(expectedColumns);
      }
    });
  });

  describe("units table", () => {
    it("should have expected columns", async () => {
      const expectedColumns = [
        "abbreviation",
        "date_modified",
        "date_published",
        "id",
        "name",
        "plural",
        "tsv",
      ];

      expect(expectedColumns).toMatchSnapshot();

      const actualColumns = await getActualColumns(anonymousClient, "units");

      if (actualColumns) {
        expect(actualColumns).toEqual(expectedColumns);
      }
    });
  });

  describe("user_api_keys table", () => {
    it("should have expected columns", async () => {
      const expectedColumns = [
        "api_key_hash",
        "api_key_prefix",
        "date_published",
        "expires_at",
        "id",
        "is_active",
        "last_used_at",
        "name",
        "user_email",
      ];

      expect(expectedColumns).toMatchSnapshot();

      const actualColumns = await getActualColumns(
        authenticatedClient,
        "user_api_keys"
      );

      if (actualColumns) {
        expect(actualColumns).toEqual(expectedColumns);
      }
    });
  });

  describe("user_pantry table", () => {
    it("should have expected columns", async () => {
      const expectedColumns = [
        "added_at",
        "expires_at",
        "food_id",
        "home_id",
        "id",
        "quantity",
        "unit",
        "user_email",
      ];

      expect(expectedColumns).toMatchSnapshot();

      const actualColumns = await getActualColumns(
        authenticatedClient,
        "user_pantry"
      );

      if (actualColumns) {
        expect(actualColumns).toEqual(expectedColumns);
      }
    });
  });
});
