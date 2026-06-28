/**
 * Contract tests for searching recipes that live in collections (samlingar).
 *
 * Regression guard for V63: recipes in a curated collection must be findable via
 * search_recipes by anyone who can ACCESS the collection (owner, admin, or a share
 * recipient) — not only the collection owner (the V62 behaviour). A recipe reachable
 * solely through a shared curated collection (e.g. "Refritos" in "Recetas Mexas")
 * previously returned nothing in web search for the recipient even though RLS let
 * them open it.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  setupTestHooks,
  createAdminClient,
  createAuthenticatedClient,
  TEST_USERS,
  type PostgrestClient,
} from "../setup";
import { createTestUser, createTestRecipe, leaveAllHomes, uniqueId } from "../seed";
import { expectSuccess, expectNoError } from "../helpers";
import type { RecipeFromView } from "./recipes-types";

describe("Collection recipe search", () => {
  setupTestHooks();

  let adminClient: PostgrestClient; // collection owner + admin
  let recipientClient: PostgrestClient; // user B — no relation to admin
  let collectionId: string;
  let recipeId: string;
  const searchTerm = `Refritos${uniqueId("Col")}`.replace(/-/g, "");
  let searchWorks = true;

  beforeAll(async () => {
    await createTestUser(TEST_USERS.admin); // also ensured admin role via seed-admin.sql
    await createTestUser(TEST_USERS.userB);

    adminClient = await createAdminClient(TEST_USERS.admin.email);
    recipientClient = await createAuthenticatedClient(TEST_USERS.userB.email);

    // Isolate: no shared household between the two (would leak visibility via household RLS).
    await leaveAllHomes(adminClient);
    await leaveAllHomes(recipientClient);

    // Admin owns a curated collection containing one of their (private) recipes.
    const coll = await adminClient.rpc<{ id: string }>("create_collection", {
      p_name: `Recetas Test ${uniqueId()}`,
      p_description: "Curated test collection",
      p_kind: "curated",
    });
    expectSuccess(coll, "create_collection (curated) should succeed for admin");
    collectionId = coll.data!.id;

    recipeId = await createTestRecipe(adminClient, {
      name: `${searchTerm} (frijoles refritos)`,
      description: "Mexikanska refried beans",
      categories: ["Mexikanskt"],
    });

    const add = await adminClient.rpc("add_recipe_to_collection", {
      p_collection_id: collectionId,
      p_recipe_id: recipeId,
    });
    expectNoError(add); // returns void → null data on success

    // Detect the known word_similarity permission gap (mirrors recipes-search.test.ts).
    const probe = await adminClient.rpc<RecipeFromView[]>("search_recipes", {
      p_query: searchTerm,
      p_limit: 1,
      p_offset: 0,
    });
    if (probe.error?.message?.includes("word_similarity")) {
      searchWorks = false;
      console.warn("collection search tests skipped: word_similarity permission not granted");
    }
  });

  afterAll(async () => {
    // Owner cascade on delete_account (globalTeardown) removes the collection, but be tidy.
    try {
      await adminClient.rpc("delete_collection", { p_id: collectionId });
      await adminClient.from("recipes").delete().eq("id", recipeId);
    } catch {
      // ignore cleanup errors
    }
  });

  it("the owner/admin finds their curated-collection recipe via search", async () => {
    if (!searchWorks) return;

    const res = await adminClient.rpc<RecipeFromView[]>("search_recipes", {
      p_query: searchTerm,
      p_limit: 50,
      p_offset: 0,
    });
    expectSuccess(res, "owner search should succeed");
    expect(res.data!.some((r) => r.id === recipeId)).toBe(true);
  });

  it("a user with no access does NOT find the curated-collection recipe", async () => {
    if (!searchWorks) return;

    const res = await recipientClient.rpc<RecipeFromView[]>("search_recipes", {
      p_query: searchTerm,
      p_limit: 50,
      p_offset: 0,
    });
    expectSuccess(res, "non-member search should succeed");
    expect(res.data!.some((r) => r.id === recipeId)).toBe(false);
  });

  it("a share recipient finds the curated-collection recipe via search (V63 fix)", async () => {
    if (!searchWorks) return;

    // Admin shares the collection; recipient accepts.
    const tokenRes = await adminClient.rpc<Array<{ token: string }>>(
      "create_collection_share_token",
      { p_collection_id: collectionId, p_expires_days: null }
    );
    expectSuccess(tokenRes, "create_collection_share_token should succeed");
    const token = tokenRes.data![0].token;

    const accept = await recipientClient.rpc("accept_collection_share", { p_token: token });
    expectSuccess(accept, "accept_collection_share should succeed");

    const res = await recipientClient.rpc<RecipeFromView[]>("search_recipes", {
      p_query: searchTerm,
      p_limit: 50,
      p_offset: 0,
    });
    expectSuccess(res, "recipient search should succeed");
    expect(res.data!.some((r) => r.id === recipeId)).toBe(true);
  });

  it("curated-collection recipes stay OUT of the browse list (list_recipes)", async () => {
    if (!searchWorks) return;

    // Even the owner's plain browse list must not be flooded by the curated library.
    const res = await adminClient.rpc<RecipeFromView[]>("list_recipes", {
      p_owner_only: true,
      p_categories: null,
      p_limit: 200,
      p_offset: 0,
    });
    expectSuccess(res, "list_recipes should succeed");
    expect(res.data!.some((r) => r.id === recipeId)).toBe(false);
  });
});
