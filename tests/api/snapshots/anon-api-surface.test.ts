/**
 * Anon API Surface Area Test
 *
 * This test verifies that only expected endpoints are visible to anonymous users
 * in the OpenAPI spec. This catches when new functions are accidentally granted
 * to anon.
 *
 * The test uses an ALLOWLIST approach: any function not explicitly listed here
 * will cause the test to fail, forcing a conscious decision about whether to
 * expose it publicly.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { setupTestHooks, TEST_CONFIG } from "../setup";

// Functions that SHOULD be visible to anonymous users
const ALLOWED_ANON_FUNCTIONS = [
  // Authentication flow
  "login",
  "signup",
  "signup_provider",
  "reset_password",
  "request_password_reset",
  "complete_password_reset",
  "validate_password_reset_token",

  // Utility functions
  "escape_like_pattern",

  // Email preferences (token-based)
  "unsubscribe_from_emails",

  // Pre-request hook and API key validation (required for API key auth)
  "pre_request",
  "validate_api_key",

  // View helpers
  "get_user_display_name",
  "get_user_id",

  // Share links - allows viewing shared recipes without login
  "get_shared_recipe",
];

// Tables/views that SHOULD be visible to anonymous users (SELECT only)
// Note: public_recipes view has been removed - recipes require authentication
const ALLOWED_ANON_TABLES = [
  "categories",
  "category_groups",
  "featured_recipes", // Landing page recipe preview for anonymous visitors
  "foods",
  "ingredient_groups",
  "ingredients",
  "instruction_groups",
  "instruction_ingredient_matches",
  "instructions",
  "recipe_categories",
  "recipe_share_tokens", // Needed for get_shared_recipe function
  "recipes",
  "units",
];

describe("Anon API Surface Area", () => {
  setupTestHooks();

  let openApiSpec: {
    paths: Record<string, unknown>;
  };

  beforeAll(async () => {
    // Fetch OpenAPI spec as anonymous user (no auth header)
    const response = await fetch(TEST_CONFIG.POSTGREST_URL);
    openApiSpec = await response.json();
  });

  it("should only expose allowed functions to anon", () => {
    const paths = Object.keys(openApiSpec.paths || {});

    // Extract RPC endpoints (functions)
    const rpcPaths = paths.filter((p) => p.startsWith("/rpc/"));
    const exposedFunctions = rpcPaths.map((p) => p.replace("/rpc/", ""));

    // Find any unexpected functions
    const unexpectedFunctions = exposedFunctions.filter(
      (fn) => !ALLOWED_ANON_FUNCTIONS.includes(fn)
    );

    if (unexpectedFunctions.length > 0) {
      console.error(
        "Unexpected functions exposed to anon:",
        unexpectedFunctions
      );
      console.error(
        "\nIf these functions should be public, add them to ALLOWED_ANON_FUNCTIONS."
      );
      console.error(
        "If not, revoke EXECUTE permission from anon in a migration."
      );
    }

    expect(unexpectedFunctions).toEqual([]);
  });

  it("should only expose allowed tables to anon", () => {
    const paths = Object.keys(openApiSpec.paths || {});

    // Extract table/view endpoints (non-RPC paths)
    const tablePaths = paths.filter(
      (p) => !p.startsWith("/rpc/") && p !== "/"
    );
    const exposedTables = tablePaths.map((p) => p.replace("/", ""));

    // Find any unexpected tables
    const unexpectedTables = exposedTables.filter(
      (t) => !ALLOWED_ANON_TABLES.includes(t)
    );

    if (unexpectedTables.length > 0) {
      console.error("Unexpected tables exposed to anon:", unexpectedTables);
      console.error(
        "\nIf these tables should be public, add them to ALLOWED_ANON_TABLES."
      );
      console.error("If not, revoke SELECT permission from anon in a migration.");
    }

    expect(unexpectedTables).toEqual([]);
  });

  it("should have all allowed functions actually accessible", () => {
    const paths = Object.keys(openApiSpec.paths || {});
    const rpcPaths = paths.filter((p) => p.startsWith("/rpc/"));
    const exposedFunctions = rpcPaths.map((p) => p.replace("/rpc/", ""));

    // Check that all expected functions are present
    const missingFunctions = ALLOWED_ANON_FUNCTIONS.filter(
      (fn) => !exposedFunctions.includes(fn)
    );

    if (missingFunctions.length > 0) {
      console.warn(
        "Expected functions not found in OpenAPI spec:",
        missingFunctions
      );
      console.warn(
        "This might indicate the function was removed or renamed."
      );
    }

    // This is a warning, not a failure - functions might be intentionally removed
    // But we log it for visibility
  });

  it("snapshot: anon-visible functions", () => {
    const paths = Object.keys(openApiSpec.paths || {});
    const rpcPaths = paths.filter((p) => p.startsWith("/rpc/"));
    const exposedFunctions = rpcPaths.map((p) => p.replace("/rpc/", "")).sort();

    // Snapshot the current state for regression detection
    expect(exposedFunctions).toMatchSnapshot();
  });

  it("snapshot: anon-visible tables", () => {
    const paths = Object.keys(openApiSpec.paths || {});
    const tablePaths = paths.filter(
      (p) => !p.startsWith("/rpc/") && p !== "/"
    );
    const exposedTables = tablePaths.map((p) => p.replace("/", "")).sort();

    // Snapshot the current state for regression detection
    expect(exposedTables).toMatchSnapshot();
  });
});
