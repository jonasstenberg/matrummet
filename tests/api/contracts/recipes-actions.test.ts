/**
 * Contract tests for Recipe Action RPCs (toggle_recipe_like, copy_recipe, delete_all_user_recipes)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { setupTestHooks, type PostgrestClient } from "../setup";
import { createTestRecipe, uniqueId } from "../seed";
import { expectSuccess, expectError, expectValidUuid } from "../helpers";
import {
  type RecipeFromView,
  type ToggleLikeResponse,
  type RecipeTestContext,
  setupRecipeTestContext,
  teardownRecipeTestContext,
} from "./recipes-types";

describe("Recipe Actions", () => {
  setupTestHooks();

  let clientA: PostgrestClient;
  let clientB: PostgrestClient;
  let anonymousClient: PostgrestClient;
  let ctx: RecipeTestContext;

  beforeAll(async () => {
    ctx = await setupRecipeTestContext();
    clientA = ctx.clientA;
    clientB = ctx.clientB;
    anonymousClient = ctx.anonymousClient;
  });

  afterAll(async () => {
    await teardownRecipeTestContext(ctx);
  });

  describe("toggle_recipe_like", () => {
    let recipeToLike: string;

    beforeEach(async () => {
      recipeToLike = await createTestRecipe(clientB, {
        name: `Like Target ${uniqueId()}`,
      });
    });

    it("returns { liked: true } when liking a recipe", async () => {
      const result = await clientA.rpc<ToggleLikeResponse>("toggle_recipe_like", {
        p_recipe_id: recipeToLike,
      });

      expectSuccess(result, "toggle_recipe_like should succeed");
      expect(result.data).toEqual({ liked: true });
    });

    it("returns { liked: false } when unliking a recipe", async () => {
      await clientA.rpc("toggle_recipe_like", { p_recipe_id: recipeToLike });

      const result = await clientA.rpc<ToggleLikeResponse>("toggle_recipe_like", {
        p_recipe_id: recipeToLike,
      });

      expectSuccess(result, "toggle to unlike should succeed");
      expect(result.data).toEqual({ liked: false });
    });

    it("toggles correctly multiple times", async () => {
      const like1 = await clientA.rpc<ToggleLikeResponse>("toggle_recipe_like", {
        p_recipe_id: recipeToLike,
      });
      expect(like1.data).toEqual({ liked: true });

      const unlike = await clientA.rpc<ToggleLikeResponse>("toggle_recipe_like", {
        p_recipe_id: recipeToLike,
      });
      expect(unlike.data).toEqual({ liked: false });

      const like2 = await clientA.rpc<ToggleLikeResponse>("toggle_recipe_like", {
        p_recipe_id: recipeToLike,
      });
      expect(like2.data).toEqual({ liked: true });
    });

    it("fails when trying to like own recipe", async () => {
      const ownRecipe = await createTestRecipe(clientA, {
        name: `Own Recipe ${uniqueId()}`,
      });

      const result = await clientA.rpc("toggle_recipe_like", {
        p_recipe_id: ownRecipe,
      });

      expectError(result);
      expect(result.error?.message).toContain("operation-failed");
    });

    it("fails for non-existent recipe", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000";
      const result = await clientA.rpc("toggle_recipe_like", {
        p_recipe_id: fakeId,
      });

      expectError(result);
      expect(result.error?.message).toContain("operation-failed");
    });

    it("fails for unauthenticated users", async () => {
      const result = await anonymousClient.rpc("toggle_recipe_like", {
        p_recipe_id: recipeToLike,
      });

      expectError(result);
      expect(result.error?.message).toContain("permission denied");
    });

    it("updates is_liked in user_recipes view", async () => {
      const householdRecipeToLike = await createTestRecipe(clientB, {
        name: `Household Like Target ${uniqueId()}`,
      });

      const beforeLike = await clientA
        .from("user_recipes")
        .select("is_liked")
        .eq("id", householdRecipeToLike)
        .single();

      expectSuccess(beforeLike);
      expect((beforeLike.data as { is_liked: boolean }).is_liked).toBe(false);

      await clientA.rpc("toggle_recipe_like", { p_recipe_id: householdRecipeToLike });

      const afterLike = await clientA
        .from("user_recipes")
        .select("is_liked")
        .eq("id", householdRecipeToLike)
        .single();

      expectSuccess(afterLike);
      expect((afterLike.data as { is_liked: boolean }).is_liked).toBe(true);

      await clientA.rpc("toggle_recipe_like", { p_recipe_id: householdRecipeToLike });

      const afterUnlike = await clientA
        .from("user_recipes")
        .select("is_liked")
        .eq("id", householdRecipeToLike)
        .single();

      expectSuccess(afterUnlike);
      expect((afterUnlike.data as { is_liked: boolean }).is_liked).toBe(false);
    });
  });

  describe("copy_recipe", () => {
    let householdRecipeId: string;
    let householdRecipeWithContent: string;

    beforeAll(async () => {
      householdRecipeId = await createTestRecipe(clientB, {
        name: `Copy Source ${uniqueId()}`,
        description: "A household recipe to copy",
      });

      householdRecipeWithContent = await createTestRecipe(clientB, {
        name: `Full Content Recipe ${uniqueId()}`,
        description: "Recipe with all content types",
        categories: ["Middag", "Vegetariskt"],
        ingredients: [
          { name: "Lök", measurement: "st", quantity: "2" },
          { name: "Vitlök", measurement: "klyftor", quantity: "3" },
          { name: "Olivolja", measurement: "msk", quantity: "2" },
        ],
        instructions: [
          { step: "Hacka löken fint." },
          { step: "Fräs löken i olivolja." },
          { step: "Tillsätt vitlöken." },
        ],
      });
    });

    it("copies household member's recipe to own collection and returns new UUID", async () => {
      const result = await clientA.rpc<string>("copy_recipe", {
        p_source_recipe_id: householdRecipeId,
      });

      expectSuccess(result, "copy_recipe should succeed");
      expectValidUuid(result.data);
    });

    it("copied recipe has new ID different from original", async () => {
      const result = await clientA.rpc<string>("copy_recipe", {
        p_source_recipe_id: householdRecipeId,
      });

      expectSuccess(result, "copy_recipe should succeed");
      expect(result.data).not.toBe(householdRecipeId);
    });

    it("copied recipe is owned by current user", async () => {
      const result = await clientA.rpc<string>("copy_recipe", {
        p_source_recipe_id: householdRecipeId,
      });

      expectSuccess(result, "copy_recipe should succeed");

      const fetchResult = await clientA
        .from("user_recipes")
        .select("*")
        .eq("id", result.data)
        .single();

      expectSuccess(fetchResult, "Should fetch copied recipe");
      const copy = fetchResult.data as RecipeFromView;
      expect(copy.is_owner).toBe(true);
    });

    it("copied recipe has copied_from_recipe_id set to original recipe ID", async () => {
      const result = await clientA.rpc<string>("copy_recipe", {
        p_source_recipe_id: householdRecipeId,
      });

      expectSuccess(result, "copy_recipe should succeed");

      const fetchResult = await clientA
        .from("user_recipes")
        .select("*")
        .eq("id", result.data)
        .single();

      expectSuccess(fetchResult, "Should fetch copied recipe");
      const copy = fetchResult.data as RecipeFromView;
      expect(copy.copied_from_recipe_id).toBe(householdRecipeId);
      expect(copy.is_copy).toBe(true);
    });

    it("copied recipe has copied_from_author_name set to original owner name", async () => {
      const result = await clientA.rpc<string>("copy_recipe", {
        p_source_recipe_id: householdRecipeId,
      });

      expectSuccess(result, "copy_recipe should succeed");

      const fetchResult = await clientA
        .from("user_recipes")
        .select("*")
        .eq("id", result.data)
        .single();

      expectSuccess(fetchResult, "Should fetch copied recipe");
      const copy = fetchResult.data as RecipeFromView;
      expect(copy.copied_from_author_name).not.toBeNull();
      expect(typeof copy.copied_from_author_name).toBe("string");
    });

    it("copied recipe includes same ingredients, instructions, and categories", async () => {
      const result = await clientA.rpc<string>("copy_recipe", {
        p_source_recipe_id: householdRecipeWithContent,
      });

      expectSuccess(result, "copy_recipe should succeed");

      const copyResult = await clientA
        .from("user_recipes")
        .select("*")
        .eq("id", result.data)
        .single();

      const originalResult = await clientB
        .from("user_recipes")
        .select("*")
        .eq("id", householdRecipeWithContent)
        .single();

      expectSuccess(copyResult, "Should fetch copied recipe");
      expectSuccess(originalResult, "Should fetch original recipe");

      const copy = copyResult.data as RecipeFromView;
      const original = originalResult.data as RecipeFromView;

      expect(copy.categories).toEqual(expect.arrayContaining(original.categories));
      expect(copy.categories.length).toBe(original.categories.length);

      expect(copy.ingredients?.length).toBe(original.ingredients?.length);

      const copyIngredientNames = copy.ingredients?.map((i) => i.name).sort();
      const originalIngredientNames = original.ingredients?.map((i) => i.name).sort();
      expect(copyIngredientNames).toEqual(originalIngredientNames);

      expect(copy.instructions?.length).toBe(original.instructions?.length);

      const copySteps = copy.instructions?.map((i) => i.step).sort();
      const originalSteps = original.instructions?.map((i) => i.step).sort();
      expect(copySteps).toEqual(originalSteps);
    });

    it("allows copying own recipe (creates a copy)", async () => {
      const ownRecipeId = await createTestRecipe(clientA, {
        name: `Own Recipe ${uniqueId()}`,
      });

      const result = await clientA.rpc<string>("copy_recipe", {
        p_source_recipe_id: ownRecipeId,
      });

      expectSuccess(result, "copy_recipe should succeed for own recipe");
      expectValidUuid(result.data);
      expect(result.data).not.toBe(ownRecipeId);
    });

    it("returns null when copying non-existent recipe", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000";
      const result = await clientA.rpc<string | null>("copy_recipe", {
        p_source_recipe_id: fakeId,
      });

      expect(result.error).toBeNull();
      expect(result.data).toBeNull();
    });

    it("fails for anonymous user", async () => {
      const result = await anonymousClient.rpc<string>("copy_recipe", {
        p_source_recipe_id: householdRecipeId,
      });

      expectError(result);
      expect(result.error?.message).toContain("permission denied");
    });
  });

  describe("delete_all_user_recipes (admin-only since V13)", () => {
    it("authenticated user gets permission denied", async () => {
      const result = await clientA.rpc("delete_all_user_recipes", {});

      expectError(result);
      expect(result.error?.message).toContain("permission denied");
    });

    it("anonymous user gets permission denied", async () => {
      const result = await anonymousClient.rpc("delete_all_user_recipes", {});

      expectError(result);
      expect(result.error?.message).toContain("permission denied");
    });
  });
});
