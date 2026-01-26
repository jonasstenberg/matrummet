/**
 * RLS Security Tests for Recipes, Ingredients, Instructions, Categories, and Recipe Likes
 *
 * These tests verify that Row Level Security policies are correctly enforced:
 * - Recipes: Public read, owner-only write
 * - Ingredients/Instructions: Linked to recipes, owner-only write
 * - Categories: Public read, owner-only write
 * - Recipe Likes: Private (users can only see their own), cannot like own recipes
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  createAuthenticatedClient,
  createAnonymousClient,
  setupTestHooks,
  TEST_USERS,
  type PostgrestClient,
} from "../setup";
import {
  createTestUser,
  createTestRecipe,
  cleanupTestData,
  resetCreatedResources,
  uniqueId,
} from "../seed";
import { expectSuccess, expectRlsBlocked } from "../helpers";

// =============================================================================
// Test Setup
// =============================================================================

setupTestHooks();

describe("RLS Security Tests", () => {
  let clientA: PostgrestClient;
  let clientB: PostgrestClient;
  let anonClient: PostgrestClient;

  beforeAll(async () => {
    // Create test users
    await createTestUser(TEST_USERS.userA);
    await createTestUser(TEST_USERS.userB);

    // Create authenticated clients
    clientA = await createAuthenticatedClient(TEST_USERS.userA.email);
    clientB = await createAuthenticatedClient(TEST_USERS.userB.email);
    anonClient = createAnonymousClient();
  });

  beforeEach(() => {
    resetCreatedResources();
  });

  afterAll(async () => {
    await cleanupTestData(TEST_USERS.userA.email);
    await cleanupTestData(TEST_USERS.userB.email);
  });

  // ===========================================================================
  // RECIPES TABLE RLS TESTS
  // ===========================================================================

  describe("Recipes Table RLS", () => {
    describe("Owner Operations", () => {
      it("owner can SELECT their own recipes", async () => {
        // Create a recipe as userA
        const recipeId = await createTestRecipe(clientA, {
          name: `Owner Select Test ${uniqueId()}`,
        });

        // UserA should be able to read their own recipe
        const result = await clientA
          .from("recipes")
          .select("*")
          .eq("id", recipeId)
          .single();

        expectSuccess(result, "Owner should be able to SELECT their own recipe");
        expect(result.data.id).toBe(recipeId);
        expect(result.data.owner).toBe(TEST_USERS.userA.email);
      });

      it("owner can UPDATE their own recipes", async () => {
        const recipeId = await createTestRecipe(clientA, {
          name: `Owner Update Test ${uniqueId()}`,
          description: "Original description",
        });

        const newDescription = "Updated description by owner";

        const updateResult = await clientA
          .from("recipes")
          .update({ description: newDescription })
          .eq("id", recipeId)
          .select()
          .single();

        expectSuccess(updateResult, "Owner should be able to UPDATE their own recipe");
        expect(updateResult.data.description).toBe(newDescription);
      });

      it("owner can DELETE their own recipes", async () => {
        const recipeId = await createTestRecipe(clientA, {
          name: `Owner Delete Test ${uniqueId()}`,
        });

        const deleteResult = await clientA
          .from("recipes")
          .delete()
          .eq("id", recipeId)
          .select()
          .single();

        expectSuccess(deleteResult, "Owner should be able to DELETE their own recipe");
        expect(deleteResult.data.id).toBe(recipeId);

        // Verify recipe is actually deleted
        const verifyResult = await clientA
          .from("recipes")
          .select("*")
          .eq("id", recipeId)
          .maybeSingle();

        expect(verifyResult.data).toBeNull();
      });
    });

    describe("Other Authenticated User Operations", () => {
      it("other authenticated users CAN SELECT recipes (public read)", async () => {
        const recipeId = await createTestRecipe(clientA, {
          name: `Public Read Test ${uniqueId()}`,
        });

        // UserB should be able to read userA's recipe
        const result = await clientB
          .from("recipes")
          .select("*")
          .eq("id", recipeId)
          .single();

        expectSuccess(result, "Other users should be able to SELECT any recipe");
        expect(result.data.id).toBe(recipeId);
        expect(result.data.owner).toBe(TEST_USERS.userA.email);
      });

      it("other authenticated users CANNOT UPDATE other's recipes (0 rows affected)", async () => {
        const originalDescription = "Original description - should not change";
        const recipeId = await createTestRecipe(clientA, {
          name: `No Update Test ${uniqueId()}`,
          description: originalDescription,
        });

        // UserB attempts to update userA's recipe
        const updateResult = await clientB
          .from("recipes")
          .update({ description: "Malicious update attempt" })
          .eq("id", recipeId)
          .select();

        // RLS should block - returns empty array (0 rows affected)
        expectRlsBlocked(updateResult);

        // Verify original data unchanged
        const verifyResult = await clientA
          .from("recipes")
          .select("*")
          .eq("id", recipeId)
          .single();

        expectSuccess(verifyResult);
        expect(verifyResult.data.description).toBe(originalDescription);
      });

      it("other authenticated users CANNOT DELETE other's recipes", async () => {
        const recipeId = await createTestRecipe(clientA, {
          name: `No Delete Test ${uniqueId()}`,
        });

        // UserB attempts to delete userA's recipe
        const deleteResult = await clientB
          .from("recipes")
          .delete()
          .eq("id", recipeId)
          .select();

        // RLS should block - returns empty array (0 rows affected)
        expectRlsBlocked(deleteResult);

        // Verify recipe still exists
        const verifyResult = await clientA
          .from("recipes")
          .select("*")
          .eq("id", recipeId)
          .single();

        expectSuccess(verifyResult);
        expect(verifyResult.data.id).toBe(recipeId);
      });
    });

    describe("Anonymous User Operations", () => {
      it("anonymous users CAN SELECT recipes", async () => {
        const recipeId = await createTestRecipe(clientA, {
          name: `Anon Read Test ${uniqueId()}`,
        });

        const result = await anonClient
          .from("recipes")
          .select("*")
          .eq("id", recipeId)
          .single();

        expectSuccess(result, "Anonymous users should be able to SELECT recipes");
        expect(result.data.id).toBe(recipeId);
      });

      it("anonymous users CANNOT INSERT recipes", async () => {
        const result = await anonClient.from("recipes").insert({
          name: "Unauthorized Recipe",
          description: "This should fail",
          author: "Anonymous",
        });

        // Should fail - anonymous users cannot insert
        expect(result.error).not.toBeNull();
      });

      it("anonymous users CANNOT UPDATE recipes", async () => {
        const recipeId = await createTestRecipe(clientA, {
          name: `Anon No Update Test ${uniqueId()}`,
        });

        const updateResult = await anonClient
          .from("recipes")
          .update({ description: "Anonymous update attempt" })
          .eq("id", recipeId)
          .select();

        expectRlsBlocked(updateResult);
      });

      it("anonymous users CANNOT DELETE recipes", async () => {
        const recipeId = await createTestRecipe(clientA, {
          name: `Anon No Delete Test ${uniqueId()}`,
        });

        const deleteResult = await anonClient
          .from("recipes")
          .delete()
          .eq("id", recipeId)
          .select();

        expectRlsBlocked(deleteResult);

        // Verify recipe still exists
        const verifyResult = await anonClient
          .from("recipes")
          .select("*")
          .eq("id", recipeId)
          .single();

        expectSuccess(verifyResult);
      });
    });
  });

  // ===========================================================================
  // INGREDIENTS TABLE RLS TESTS
  // ===========================================================================

  describe("Ingredients Table RLS", () => {
    describe("Owner Operations", () => {
      it("owner can SELECT ingredients for their recipes", async () => {
        const recipeId = await createTestRecipe(clientA, {
          name: `Ingredient Select Test ${uniqueId()}`,
          ingredients: [
            { name: "Test Ingredient", measurement: "g", quantity: "100" },
          ],
        });

        const result = await clientA
          .from("ingredients")
          .select("*")
          .eq("recipe_id", recipeId);

        expectSuccess(result);
        expect(result.data).toHaveLength(1);
        expect(result.data[0].name).toBe("Test Ingredient");
      });

      it("owner can INSERT ingredients for their recipes", async () => {
        const recipeId = await createTestRecipe(clientA, {
          name: `Ingredient Insert Test ${uniqueId()}`,
          ingredients: [],
        });

        const insertResult = await clientA
          .from("ingredients")
          .insert({
            recipe_id: recipeId,
            name: "New Ingredient",
            measurement: "dl",
            quantity: "2",
          })
          .select()
          .single();

        expectSuccess(insertResult, "Owner should be able to INSERT ingredients");
        expect(insertResult.data.name).toBe("New Ingredient");
      });

      it("owner can UPDATE ingredients for their recipes", async () => {
        const recipeId = await createTestRecipe(clientA, {
          name: `Ingredient Update Test ${uniqueId()}`,
          ingredients: [
            { name: "Original Ingredient", measurement: "g", quantity: "100" },
          ],
        });

        // Get the ingredient ID
        const ingredientsResult = await clientA
          .from("ingredients")
          .select("id")
          .eq("recipe_id", recipeId)
          .single();

        expectSuccess(ingredientsResult);

        const updateResult = await clientA
          .from("ingredients")
          .update({ name: "Updated Ingredient" })
          .eq("id", ingredientsResult.data.id)
          .select()
          .single();

        expectSuccess(updateResult, "Owner should be able to UPDATE ingredients");
        expect(updateResult.data.name).toBe("Updated Ingredient");
      });

      it("owner can DELETE ingredients for their recipes", async () => {
        const recipeId = await createTestRecipe(clientA, {
          name: `Ingredient Delete Test ${uniqueId()}`,
          ingredients: [
            { name: "To Delete", measurement: "g", quantity: "100" },
          ],
        });

        const ingredientsResult = await clientA
          .from("ingredients")
          .select("id")
          .eq("recipe_id", recipeId)
          .single();

        expectSuccess(ingredientsResult);

        const deleteResult = await clientA
          .from("ingredients")
          .delete()
          .eq("id", ingredientsResult.data.id)
          .select();

        expectSuccess(deleteResult, "Owner should be able to DELETE ingredients");
      });
    });

    describe("Other User Operations", () => {
      it("other users CAN SELECT ingredients (public read)", async () => {
        const recipeId = await createTestRecipe(clientA, {
          name: `Ingredient Public Read ${uniqueId()}`,
          ingredients: [
            { name: "Public Ingredient", measurement: "st", quantity: "1" },
          ],
        });

        const result = await clientB
          .from("ingredients")
          .select("*")
          .eq("recipe_id", recipeId);

        expectSuccess(result, "Other users should be able to SELECT ingredients");
        expect(result.data).toHaveLength(1);
      });

      it("other users CANNOT INSERT ingredients for other's recipes", async () => {
        const recipeId = await createTestRecipe(clientA, {
          name: `Ingredient No Insert ${uniqueId()}`,
        });

        // UserB attempts to insert ingredient for userA's recipe
        const insertResult = await clientB.from("ingredients").insert({
          recipe_id: recipeId,
          name: "Unauthorized Ingredient",
          measurement: "g",
          quantity: "100",
        });

        // Should fail - RLS blocks insert
        expect(insertResult.error).not.toBeNull();
      });

      it("other users CANNOT UPDATE ingredients for other's recipes", async () => {
        const recipeId = await createTestRecipe(clientA, {
          name: `Ingredient No Update ${uniqueId()}`,
          ingredients: [
            { name: "Protected Ingredient", measurement: "g", quantity: "100" },
          ],
        });

        const ingredientsResult = await clientA
          .from("ingredients")
          .select("id")
          .eq("recipe_id", recipeId)
          .single();

        expectSuccess(ingredientsResult);

        const updateResult = await clientB
          .from("ingredients")
          .update({ name: "Malicious Update" })
          .eq("id", ingredientsResult.data.id)
          .select();

        expectRlsBlocked(updateResult);
      });

      it("other users CANNOT DELETE ingredients for other's recipes", async () => {
        const recipeId = await createTestRecipe(clientA, {
          name: `Ingredient No Delete ${uniqueId()}`,
          ingredients: [
            { name: "Cannot Delete", measurement: "g", quantity: "100" },
          ],
        });

        const ingredientsResult = await clientA
          .from("ingredients")
          .select("id")
          .eq("recipe_id", recipeId)
          .single();

        expectSuccess(ingredientsResult);

        const deleteResult = await clientB
          .from("ingredients")
          .delete()
          .eq("id", ingredientsResult.data.id)
          .select();

        expectRlsBlocked(deleteResult);
      });
    });

    describe("Anonymous User Operations", () => {
      it("anonymous users CAN SELECT ingredients", async () => {
        const recipeId = await createTestRecipe(clientA, {
          name: `Anon Ingredient Read ${uniqueId()}`,
          ingredients: [{ name: "Anon Readable", measurement: "g", quantity: "50" }],
        });

        const result = await anonClient
          .from("ingredients")
          .select("*")
          .eq("recipe_id", recipeId);

        expectSuccess(result);
        expect(result.data).toHaveLength(1);
      });

      it("anonymous users CANNOT INSERT/UPDATE/DELETE ingredients", async () => {
        const recipeId = await createTestRecipe(clientA, {
          name: `Anon Ingredient Block ${uniqueId()}`,
          ingredients: [{ name: "Protected", measurement: "g", quantity: "100" }],
        });

        // Insert attempt
        const insertResult = await anonClient.from("ingredients").insert({
          recipe_id: recipeId,
          name: "Anon Insert",
          measurement: "g",
          quantity: "1",
        });
        expect(insertResult.error).not.toBeNull();

        // Get ingredient ID for update/delete attempts
        const ingredientsResult = await anonClient
          .from("ingredients")
          .select("id")
          .eq("recipe_id", recipeId)
          .single();

        expectSuccess(ingredientsResult);

        // Update attempt
        const updateResult = await anonClient
          .from("ingredients")
          .update({ name: "Anon Update" })
          .eq("id", ingredientsResult.data.id)
          .select();
        expectRlsBlocked(updateResult);

        // Delete attempt
        const deleteResult = await anonClient
          .from("ingredients")
          .delete()
          .eq("id", ingredientsResult.data.id)
          .select();
        expectRlsBlocked(deleteResult);
      });
    });
  });

  // ===========================================================================
  // INSTRUCTIONS TABLE RLS TESTS
  // ===========================================================================

  describe("Instructions Table RLS", () => {
    describe("Owner Operations", () => {
      it("owner can SELECT instructions for their recipes", async () => {
        const recipeId = await createTestRecipe(clientA, {
          name: `Instruction Select Test ${uniqueId()}`,
          instructions: [{ step: "Test step 1" }],
        });

        const result = await clientA
          .from("instructions")
          .select("*")
          .eq("recipe_id", recipeId);

        expectSuccess(result);
        expect(result.data).toHaveLength(1);
        expect(result.data[0].step).toBe("Test step 1");
      });

      it("owner can INSERT instructions for their recipes", async () => {
        const recipeId = await createTestRecipe(clientA, {
          name: `Instruction Insert Test ${uniqueId()}`,
          instructions: [],
        });

        const insertResult = await clientA
          .from("instructions")
          .insert({
            recipe_id: recipeId,
            step: "New instruction step",
          })
          .select()
          .single();

        expectSuccess(insertResult, "Owner should be able to INSERT instructions");
        expect(insertResult.data.step).toBe("New instruction step");
      });

      it("owner can UPDATE instructions for their recipes", async () => {
        const recipeId = await createTestRecipe(clientA, {
          name: `Instruction Update Test ${uniqueId()}`,
          instructions: [{ step: "Original step" }],
        });

        const instructionsResult = await clientA
          .from("instructions")
          .select("id")
          .eq("recipe_id", recipeId)
          .single();

        expectSuccess(instructionsResult);

        const updateResult = await clientA
          .from("instructions")
          .update({ step: "Updated step" })
          .eq("id", instructionsResult.data.id)
          .select()
          .single();

        expectSuccess(updateResult, "Owner should be able to UPDATE instructions");
        expect(updateResult.data.step).toBe("Updated step");
      });

      it("owner can DELETE instructions for their recipes", async () => {
        const recipeId = await createTestRecipe(clientA, {
          name: `Instruction Delete Test ${uniqueId()}`,
          instructions: [{ step: "To delete" }],
        });

        const instructionsResult = await clientA
          .from("instructions")
          .select("id")
          .eq("recipe_id", recipeId)
          .single();

        expectSuccess(instructionsResult);

        const deleteResult = await clientA
          .from("instructions")
          .delete()
          .eq("id", instructionsResult.data.id)
          .select();

        expectSuccess(deleteResult, "Owner should be able to DELETE instructions");
      });
    });

    describe("Other User Operations", () => {
      it("other users CAN SELECT instructions (public read)", async () => {
        const recipeId = await createTestRecipe(clientA, {
          name: `Instruction Public Read ${uniqueId()}`,
          instructions: [{ step: "Public step" }],
        });

        const result = await clientB
          .from("instructions")
          .select("*")
          .eq("recipe_id", recipeId);

        expectSuccess(result);
        expect(result.data).toHaveLength(1);
      });

      it("other users CANNOT INSERT instructions for other's recipes", async () => {
        const recipeId = await createTestRecipe(clientA, {
          name: `Instruction No Insert ${uniqueId()}`,
        });

        const insertResult = await clientB.from("instructions").insert({
          recipe_id: recipeId,
          step: "Unauthorized step",
        });

        expect(insertResult.error).not.toBeNull();
      });

      it("other users CANNOT UPDATE instructions for other's recipes", async () => {
        const recipeId = await createTestRecipe(clientA, {
          name: `Instruction No Update ${uniqueId()}`,
          instructions: [{ step: "Protected step" }],
        });

        const instructionsResult = await clientA
          .from("instructions")
          .select("id")
          .eq("recipe_id", recipeId)
          .single();

        expectSuccess(instructionsResult);

        const updateResult = await clientB
          .from("instructions")
          .update({ step: "Malicious update" })
          .eq("id", instructionsResult.data.id)
          .select();

        expectRlsBlocked(updateResult);
      });

      it("other users CANNOT DELETE instructions for other's recipes", async () => {
        const recipeId = await createTestRecipe(clientA, {
          name: `Instruction No Delete ${uniqueId()}`,
          instructions: [{ step: "Cannot delete" }],
        });

        const instructionsResult = await clientA
          .from("instructions")
          .select("id")
          .eq("recipe_id", recipeId)
          .single();

        expectSuccess(instructionsResult);

        const deleteResult = await clientB
          .from("instructions")
          .delete()
          .eq("id", instructionsResult.data.id)
          .select();

        expectRlsBlocked(deleteResult);
      });
    });

    describe("Anonymous User Operations", () => {
      it("anonymous users CAN SELECT instructions", async () => {
        const recipeId = await createTestRecipe(clientA, {
          name: `Anon Instruction Read ${uniqueId()}`,
          instructions: [{ step: "Anon readable step" }],
        });

        const result = await anonClient
          .from("instructions")
          .select("*")
          .eq("recipe_id", recipeId);

        expectSuccess(result);
        expect(result.data).toHaveLength(1);
      });

      it("anonymous users CANNOT INSERT/UPDATE/DELETE instructions", async () => {
        const recipeId = await createTestRecipe(clientA, {
          name: `Anon Instruction Block ${uniqueId()}`,
          instructions: [{ step: "Protected step" }],
        });

        // Insert attempt
        const insertResult = await anonClient.from("instructions").insert({
          recipe_id: recipeId,
          step: "Anon insert",
        });
        expect(insertResult.error).not.toBeNull();

        // Get instruction ID for update/delete attempts
        const instructionsResult = await anonClient
          .from("instructions")
          .select("id")
          .eq("recipe_id", recipeId)
          .single();

        expectSuccess(instructionsResult);

        // Update attempt
        const updateResult = await anonClient
          .from("instructions")
          .update({ step: "Anon update" })
          .eq("id", instructionsResult.data.id)
          .select();
        expectRlsBlocked(updateResult);

        // Delete attempt
        const deleteResult = await anonClient
          .from("instructions")
          .delete()
          .eq("id", instructionsResult.data.id)
          .select();
        expectRlsBlocked(deleteResult);
      });
    });
  });

  // ===========================================================================
  // CATEGORIES TABLE RLS TESTS
  // ===========================================================================
  // NOTE: Categories have special RLS policies:
  // - SELECT: Public (anyone can view)
  // - INSERT: Admin only (regular users create via insert_recipe RPC)
  // - UPDATE: Admin only
  // - DELETE: Admin only

  describe("Categories Table RLS", () => {
    describe("Regular User Operations", () => {
      // Regular users cannot directly INSERT categories - this is admin-only
      it("regular users CANNOT directly INSERT categories (admin only)", async () => {
        const insertResult = await clientA.from("categories").insert({
          name: `Test Category ${uniqueId()}`,
        });

        expect(insertResult.error).not.toBeNull();
        expect(insertResult.error?.message).toContain("row-level security");
      });

      it("regular users CAN SELECT categories (public read)", async () => {
        // Use an existing category created via recipes
        // First create a recipe with a category to ensure one exists
        await createTestRecipe(clientA, {
          name: `Category Test Recipe ${uniqueId()}`,
          categories: ["Middag"], // This creates the category if it doesn't exist
        });

        const result = await clientA
          .from("categories")
          .select("*")
          .limit(1);

        expectSuccess(result);
        expect(result.data.length).toBeGreaterThan(0);
      });

      it("regular users CANNOT UPDATE categories (admin only)", async () => {
        // Get an existing category
        const categoriesResult = await clientA
          .from("categories")
          .select("*")
          .limit(1)
          .single();

        if (categoriesResult.data) {
          const updateResult = await clientA
            .from("categories")
            .update({ name: `Updated ${uniqueId()}` })
            .eq("id", categoriesResult.data.id)
            .select();

          expectRlsBlocked(updateResult);
        }
      });

      it("regular users CANNOT DELETE categories (admin only)", async () => {
        // Get an existing category
        const categoriesResult = await clientA
          .from("categories")
          .select("*")
          .limit(1)
          .single();

        if (categoriesResult.data) {
          const deleteResult = await clientA
            .from("categories")
            .delete()
            .eq("id", categoriesResult.data.id)
            .select();

          expectRlsBlocked(deleteResult);
        }
      });
    });

    describe("Other User Operations", () => {
      it("other users CAN SELECT categories (public read)", async () => {
        // Categories created via recipes are readable by anyone
        const result = await clientB
          .from("categories")
          .select("*")
          .limit(1);

        expectSuccess(result);
      });

      it("other users CANNOT UPDATE categories", async () => {
        const categoriesResult = await clientA
          .from("categories")
          .select("*")
          .limit(1)
          .single();

        if (categoriesResult.data) {
          const updateResult = await clientB
            .from("categories")
            .update({ name: "Malicious Name Change" })
            .eq("id", categoriesResult.data.id)
            .select();

          expectRlsBlocked(updateResult);
        }
      });

      it("other users CANNOT DELETE categories", async () => {
        const categoriesResult = await clientA
          .from("categories")
          .select("*")
          .limit(1)
          .single();

        if (categoriesResult.data) {
          const deleteResult = await clientB
            .from("categories")
            .delete()
            .eq("id", categoriesResult.data.id)
            .select();

          expectRlsBlocked(deleteResult);
        }
      });
    });

    describe("Anonymous User Operations", () => {
      it("anonymous users CAN SELECT categories", async () => {
        const result = await anonClient
          .from("categories")
          .select("*")
          .limit(1);

        expectSuccess(result);
      });

      it("anonymous users CANNOT INSERT categories", async () => {
        const result = await anonClient.from("categories").insert({
          name: `Anon Category ${uniqueId()}`,
        });

        expect(result.error).not.toBeNull();
      });

      it("anonymous users CANNOT UPDATE categories", async () => {
        const categoriesResult = await anonClient
          .from("categories")
          .select("*")
          .limit(1)
          .single();

        if (categoriesResult.data) {
          const updateResult = await anonClient
            .from("categories")
            .update({ name: "Anon Update Attempt" })
            .eq("id", categoriesResult.data.id)
            .select();

          expectRlsBlocked(updateResult);
        }
      });

      it("anonymous users CANNOT DELETE categories", async () => {
        const categoriesResult = await anonClient
          .from("categories")
          .select("*")
          .limit(1)
          .single();

        if (categoriesResult.data) {
          const deleteResult = await anonClient
            .from("categories")
            .delete()
            .eq("id", categoriesResult.data.id)
            .select();

          expectRlsBlocked(deleteResult);
        }
      });
    });
  });

  // ===========================================================================
  // RECIPE LIKES TABLE RLS TESTS
  // ===========================================================================

  describe("Recipe Likes Table RLS", () => {
    describe("Basic Like Operations", () => {
      it("authenticated users can like other users' recipes", async () => {
        // UserA creates a recipe
        const recipeId = await createTestRecipe(clientA, {
          name: `Likeable Recipe ${uniqueId()}`,
        });

        // UserB likes the recipe
        const insertResult = await clientB
          .from("recipe_likes")
          .insert({
            recipe_id: recipeId,
            user_email: TEST_USERS.userB.email,
          })
          .select()
          .single();

        expectSuccess(insertResult, "User should be able to like other's recipe");
        expect(insertResult.data.recipe_id).toBe(recipeId);
        expect(insertResult.data.user_email).toBe(TEST_USERS.userB.email);
      });

      it("authenticated users can unlike (delete) their likes", async () => {
        const recipeId = await createTestRecipe(clientA, {
          name: `Unlikeable Recipe ${uniqueId()}`,
        });

        // UserB likes the recipe
        await clientB.from("recipe_likes").insert({
          recipe_id: recipeId,
          user_email: TEST_USERS.userB.email,
        });

        // UserB unlikes the recipe
        const deleteResult = await clientB
          .from("recipe_likes")
          .delete()
          .eq("recipe_id", recipeId)
          .eq("user_email", TEST_USERS.userB.email)
          .select();

        expectSuccess(deleteResult, "User should be able to unlike a recipe");
      });
    });

    describe("Like Privacy (Users Cannot See Others' Likes)", () => {
      it("users can only see their own likes", async () => {
        const recipeId = await createTestRecipe(clientA, {
          name: `Private Likes Recipe ${uniqueId()}`,
        });

        // UserB likes the recipe
        await clientB.from("recipe_likes").insert({
          recipe_id: recipeId,
          user_email: TEST_USERS.userB.email,
        });

        // UserB should see their own like
        const userBLikes = await clientB
          .from("recipe_likes")
          .select("*")
          .eq("recipe_id", recipeId);

        expectSuccess(userBLikes);
        expect(userBLikes.data).toHaveLength(1);
        expect(userBLikes.data[0].user_email).toBe(TEST_USERS.userB.email);

        // UserA should NOT see userB's like (empty result)
        const userALikes = await clientA
          .from("recipe_likes")
          .select("*")
          .eq("recipe_id", recipeId);

        expect(userALikes.data).toHaveLength(0);
      });

      it("users CANNOT see other users' likes", async () => {
        const recipeId = await createTestRecipe(clientA, {
          name: `Hidden Likes Recipe ${uniqueId()}`,
        });

        // UserB likes the recipe
        await clientB.from("recipe_likes").insert({
          recipe_id: recipeId,
          user_email: TEST_USERS.userB.email,
        });

        // UserA queries all likes - should not see userB's like
        const allLikesFromA = await clientA.from("recipe_likes").select("*");

        // Filter for the specific recipe's likes
        const recipeLikes = (allLikesFromA.data as Array<{ recipe_id: string; user_email: string }>)
          .filter((like) => like.recipe_id === recipeId);

        expect(recipeLikes).toHaveLength(0);
      });
    });

    describe("Cannot Like Own Recipes", () => {
      it("users CANNOT like their own recipes via direct insert", async () => {
        const recipeId = await createTestRecipe(clientA, {
          name: `Own Recipe No Like ${uniqueId()}`,
        });

        // UserA attempts to like their own recipe
        const insertResult = await clientA.from("recipe_likes").insert({
          recipe_id: recipeId,
          user_email: TEST_USERS.userA.email,
        });

        // Should fail due to RLS policy
        expect(insertResult.error).not.toBeNull();
      });

      it("users CANNOT like their own recipes via toggle function", async () => {
        const recipeId = await createTestRecipe(clientA, {
          name: `Toggle Own Recipe ${uniqueId()}`,
        });

        // UserA attempts to like their own recipe via toggle
        const toggleResult = await clientA.rpc("toggle_recipe_like", {
          p_recipe_id: recipeId,
        });

        // Should fail - error message may be 'cannot-like-own-recipe' or 'operation-failed'
        // depending on security hardening settings
        expect(toggleResult.error).not.toBeNull();
        const errorMessage = toggleResult.error?.message || "";
        expect(
          errorMessage.includes("cannot-like-own-recipe") ||
          errorMessage.includes("operation-failed")
        ).toBe(true);
      });
    });

    describe("Cannot Modify Other Users' Likes", () => {
      it("users CANNOT delete other users' likes", async () => {
        const recipeId = await createTestRecipe(clientA, {
          name: `Protected Likes Recipe ${uniqueId()}`,
        });

        // UserB likes the recipe
        await clientB.from("recipe_likes").insert({
          recipe_id: recipeId,
          user_email: TEST_USERS.userB.email,
        });

        // UserA attempts to delete userB's like
        const deleteResult = await clientA
          .from("recipe_likes")
          .delete()
          .eq("recipe_id", recipeId)
          .eq("user_email", TEST_USERS.userB.email)
          .select();

        // Should be blocked by RLS (empty result)
        expectRlsBlocked(deleteResult);

        // Verify the like still exists (check as userB)
        const verifyResult = await clientB
          .from("recipe_likes")
          .select("*")
          .eq("recipe_id", recipeId);

        expectSuccess(verifyResult);
        expect(verifyResult.data).toHaveLength(1);
      });

      it("users CANNOT insert likes on behalf of other users", async () => {
        const recipeId = await createTestRecipe(clientB, {
          name: `Impersonate Like Recipe ${uniqueId()}`,
        });

        // UserA attempts to insert a like pretending to be userB
        const insertResult = await clientA.from("recipe_likes").insert({
          recipe_id: recipeId,
          user_email: TEST_USERS.userB.email, // Trying to impersonate userB
        });

        // Should fail due to RLS policy
        expect(insertResult.error).not.toBeNull();
      });
    });

    describe("Anonymous User Operations", () => {
      it("anonymous users CANNOT view any likes", async () => {
        const recipeId = await createTestRecipe(clientA, {
          name: `Anon No View Likes ${uniqueId()}`,
        });

        // UserB likes the recipe
        await clientB.from("recipe_likes").insert({
          recipe_id: recipeId,
          user_email: TEST_USERS.userB.email,
        });

        // Anonymous user tries to view likes — table access revoked (V50)
        const result = await anonClient
          .from("recipe_likes")
          .select("*")
          .eq("recipe_id", recipeId);

        expect(result.error).not.toBeNull();
        expect(result.error?.message).toContain("permission denied");
      });

      it("anonymous users CANNOT insert likes", async () => {
        const recipeId = await createTestRecipe(clientA, {
          name: `Anon No Insert Like ${uniqueId()}`,
        });

        const insertResult = await anonClient.from("recipe_likes").insert({
          recipe_id: recipeId,
          user_email: "anon@example.com",
        });

        expect(insertResult.error).not.toBeNull();
      });

      it("anonymous users CANNOT delete likes", async () => {
        const recipeId = await createTestRecipe(clientA, {
          name: `Anon No Delete Like ${uniqueId()}`,
        });

        // UserB likes the recipe
        await clientB.from("recipe_likes").insert({
          recipe_id: recipeId,
          user_email: TEST_USERS.userB.email,
        });

        // Anonymous user tries to delete the like
        const deleteResult = await anonClient
          .from("recipe_likes")
          .delete()
          .eq("recipe_id", recipeId)
          .select();

        expectRlsBlocked(deleteResult);
      });
    });
  });

  // ===========================================================================
  // RECIPE_CATEGORIES JUNCTION TABLE RLS TESTS
  // ===========================================================================

  describe("Recipe Categories Junction Table RLS", () => {
    describe("Owner Operations", () => {
      it("owner can manage recipe-category associations", async () => {
        const recipeId = await createTestRecipe(clientA, {
          name: `RC Junction Test ${uniqueId()}`,
          categories: ["Test Category A"],
        });

        // Verify the association exists
        const result = await clientA
          .from("recipe_categories")
          .select("*")
          .eq("recipe", recipeId);

        expectSuccess(result);
        expect(result.data).toHaveLength(1);
      });
    });

    describe("Other User Operations", () => {
      it("other users CAN SELECT recipe-category associations (public read)", async () => {
        const recipeId = await createTestRecipe(clientA, {
          name: `RC Public Read ${uniqueId()}`,
          categories: ["Public Category"],
        });

        const result = await clientB
          .from("recipe_categories")
          .select("*")
          .eq("recipe", recipeId);

        expectSuccess(result);
        expect(result.data).toHaveLength(1);
      });

      it("other users CANNOT modify recipe-category associations", async () => {
        const recipeId = await createTestRecipe(clientA, {
          name: `RC No Modify ${uniqueId()}`,
          categories: ["Protected Category"],
        });

        // Get the association
        const rcResult = await clientA
          .from("recipe_categories")
          .select("*")
          .eq("recipe", recipeId)
          .single();

        expectSuccess(rcResult);

        // UserB attempts to delete the association
        const deleteResult = await clientB
          .from("recipe_categories")
          .delete()
          .eq("recipe", recipeId)
          .eq("category", rcResult.data.category)
          .select();

        expectRlsBlocked(deleteResult);
      });
    });
  });
});
