/**
 * Contract tests for Recipe CRUD RPCs (insert_recipe, update_recipe)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { setupTestHooks, type PostgrestClient } from "../setup";
import { createTestRecipe, uniqueId } from "../seed";
import { expectSuccess, expectError, expectValidUuid } from "../helpers";
import {
  type RecipeFromView,
  type RecipeTestContext,
  setupRecipeTestContext,
  teardownRecipeTestContext,
} from "./recipes-types";

describe("Recipe CRUD", () => {
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

  describe("insert_recipe", () => {
    it("returns a valid UUID on successful creation", async () => {
      const recipeName = `Test Insert ${uniqueId()}`;

      const result = await clientA.rpc<string>("insert_recipe", {
        p_name: recipeName,
        p_description: "Test description for contract test",
        p_author: "Test Author",
        p_url: "https://example.com/recipe",
        p_recipe_yield: 4,
        p_recipe_yield_name: null,
        p_prep_time: 15,
        p_cook_time: 30,
        p_cuisine: "Swedish",
        p_image: null,

        p_categories: ["Middag"],
        p_ingredients: [
          { name: "Salt", measurement: "tsk", quantity: "1" },
          { name: "Vatten", measurement: "dl", quantity: "2" },
        ],
        p_instructions: [
          { step: "Blanda ingredienserna." },
          { step: "Servera." },
        ],
      });

      expectSuccess(result, "insert_recipe should succeed");
      expectValidUuid(result.data);
    });

    it("handles ingredient groups correctly", async () => {
      const recipeName = `Test Groups ${uniqueId()}`;

      const result = await clientA.rpc<string>("insert_recipe", {
        p_name: recipeName,
        p_description: "Recipe with ingredient groups",
        p_author: "Test Author",
        p_url: null,
        p_recipe_yield: 4,
        p_recipe_yield_name: null,
        p_prep_time: 20,
        p_cook_time: 40,
        p_cuisine: "Swedish",
        p_image: null,

        p_categories: ["Middag"],
        p_ingredients: [
          { group: "Sås" },
          { name: "Grädde", measurement: "dl", quantity: "2" },
          { name: "Smör", measurement: "msk", quantity: "1" },
          { group: "Kött" },
          { name: "Köttfärs", measurement: "g", quantity: "500" },
        ],
        p_instructions: [
          { group: "Förberedelser" },
          { step: "Förbered alla ingredienser." },
          { group: "Tillagning" },
          { step: "Stek köttfärsen." },
          { step: "Lägg till såsen." },
        ],
      });

      expectSuccess(result, "insert_recipe with groups should succeed");
      expectValidUuid(result.data);

      // Verify the recipe has groups by fetching it
      const fetchResult = await clientA
        .from("user_recipes")
        .select("*")
        .eq("id", result.data!)
        .single();

      expectSuccess(fetchResult, "Should fetch created recipe");
      const recipe = fetchResult.data as RecipeFromView;

      // Verify ingredient groups
      expect(recipe.ingredient_groups).not.toBeNull();
      expect(recipe.ingredient_groups).toHaveLength(2);
      expect(recipe.ingredient_groups![0].name).toBe("Sås");
      expect(recipe.ingredient_groups![1].name).toBe("Kött");

      // Verify instruction groups
      expect(recipe.instruction_groups).not.toBeNull();
      expect(recipe.instruction_groups).toHaveLength(2);
      expect(recipe.instruction_groups![0].name).toBe("Förberedelser");
      expect(recipe.instruction_groups![1].name).toBe("Tillagning");
    });

    it("orders ingredients and instructions by group sort_order", async () => {
      const recipeName = `Test Group Ordering ${uniqueId()}`;

      const result = await clientA.rpc<string>("insert_recipe", {
        p_name: recipeName,
        p_description: "Recipe to test group ordering",
        p_author: null,
        p_url: null,
        p_recipe_yield: 4,
        p_recipe_yield_name: null,
        p_prep_time: 10,
        p_cook_time: 20,
        p_cuisine: null,
        p_image: null,

        p_categories: [],
        p_ingredients: [
          { group: "Första gruppen" },
          { name: "Ingrediens A", measurement: "st", quantity: "1" },
          { group: "Andra gruppen" },
          { name: "Ingrediens B", measurement: "st", quantity: "2" },
          { group: "Tredje gruppen" },
          { name: "Ingrediens C", measurement: "st", quantity: "3" },
        ],
        p_instructions: [
          { group: "Steg ett" },
          { step: "Gör detta först." },
          { group: "Steg två" },
          { step: "Gör detta sedan." },
          { group: "Steg tre" },
          { step: "Gör detta sist." },
        ],
      });

      expectSuccess(result, "insert_recipe should succeed");

      const fetchResult = await clientA
        .from("user_recipes")
        .select("*")
        .eq("id", result.data!)
        .single();

      expectSuccess(fetchResult, "Should fetch created recipe");
      const recipe = fetchResult.data as RecipeFromView;

      expect(recipe.ingredient_groups).toHaveLength(3);
      expect(recipe.ingredient_groups![0].name).toBe("Första gruppen");
      expect(recipe.ingredient_groups![0].sort_order).toBe(0);
      expect(recipe.ingredient_groups![1].name).toBe("Andra gruppen");
      expect(recipe.ingredient_groups![1].sort_order).toBe(1);
      expect(recipe.ingredient_groups![2].name).toBe("Tredje gruppen");
      expect(recipe.ingredient_groups![2].sort_order).toBe(2);

      expect(recipe.ingredients).toHaveLength(3);
      expect(recipe.ingredients![0].name).toBe("Ingrediens A");
      expect(recipe.ingredients![1].name).toBe("Ingrediens B");
      expect(recipe.ingredients![2].name).toBe("Ingrediens C");

      const groupAId = recipe.ingredient_groups![0].id;
      const groupBId = recipe.ingredient_groups![1].id;
      const groupCId = recipe.ingredient_groups![2].id;
      expect(recipe.ingredients![0].group_id).toBe(groupAId);
      expect(recipe.ingredients![1].group_id).toBe(groupBId);
      expect(recipe.ingredients![2].group_id).toBe(groupCId);

      expect(recipe.instruction_groups).toHaveLength(3);
      expect(recipe.instruction_groups![0].name).toBe("Steg ett");
      expect(recipe.instruction_groups![0].sort_order).toBe(0);
      expect(recipe.instruction_groups![1].name).toBe("Steg två");
      expect(recipe.instruction_groups![1].sort_order).toBe(1);
      expect(recipe.instruction_groups![2].name).toBe("Steg tre");
      expect(recipe.instruction_groups![2].sort_order).toBe(2);

      expect(recipe.instructions).toHaveLength(3);
      expect(recipe.instructions![0].step).toBe("Gör detta först.");
      expect(recipe.instructions![1].step).toBe("Gör detta sedan.");
      expect(recipe.instructions![2].step).toBe("Gör detta sist.");
    });

    it("orders ungrouped items before grouped items", async () => {
      const recipeName = `Test Ungrouped Order ${uniqueId()}`;

      const result = await clientA.rpc<string>("insert_recipe", {
        p_name: recipeName,
        p_description: "Recipe with mixed grouped and ungrouped items",
        p_author: null,
        p_url: null,
        p_recipe_yield: 4,
        p_recipe_yield_name: null,
        p_prep_time: 10,
        p_cook_time: 20,
        p_cuisine: null,
        p_image: null,

        p_categories: [],
        p_ingredients: [
          { name: "Ungrouped First", measurement: "st", quantity: "1" },
          { name: "Ungrouped Second", measurement: "st", quantity: "2" },
          { group: "En grupp" },
          { name: "Grouped Item", measurement: "st", quantity: "3" },
        ],
        p_instructions: [
          { step: "Ungrouped instruction first." },
          { group: "Instruktionsgrupp" },
          { step: "Grouped instruction." },
        ],
      });

      expectSuccess(result, "insert_recipe should succeed");

      const fetchResult = await clientA
        .from("user_recipes")
        .select("*")
        .eq("id", result.data!)
        .single();

      expectSuccess(fetchResult, "Should fetch created recipe");
      const recipe = fetchResult.data as RecipeFromView;

      expect(recipe.ingredients).toHaveLength(3);
      expect(recipe.ingredients![0].name).toBe("Ungrouped First");
      expect(recipe.ingredients![0].group_id).toBeNull();
      expect(recipe.ingredients![1].name).toBe("Ungrouped Second");
      expect(recipe.ingredients![1].group_id).toBeNull();
      expect(recipe.ingredients![2].name).toBe("Grouped Item");
      expect(recipe.ingredients![2].group_id).not.toBeNull();

      expect(recipe.instructions).toHaveLength(2);
      expect(recipe.instructions![0].step).toBe("Ungrouped instruction first.");
      expect(recipe.instructions![0].group_id).toBeNull();
      expect(recipe.instructions![1].step).toBe("Grouped instruction.");
      expect(recipe.instructions![1].group_id).not.toBeNull();
    });

    it("handles ingredient form field correctly", async () => {
      const recipeName = `Test Form Field ${uniqueId()}`;

      const result = await clientA.rpc<string>("insert_recipe", {
        p_name: recipeName,
        p_description: "Recipe with ingredient forms",
        p_author: "Test Author",
        p_url: null,
        p_recipe_yield: 2,
        p_recipe_yield_name: null,
        p_prep_time: 10,
        p_cook_time: 20,
        p_cuisine: null,
        p_image: null,

        p_categories: [],
        p_ingredients: [
          { name: "Vitlök", measurement: "klyftor", quantity: "3", form: "hackad" },
          { name: "Lök", measurement: "st", quantity: "1", form: "tärnad" },
          { name: "Salt", measurement: "tsk", quantity: "1" }, // No form
        ],
        p_instructions: [{ step: "Hacka vitlöken och tärna löken." }],
      });

      expectSuccess(result, "insert_recipe with forms should succeed");
      expectValidUuid(result.data);

      const fetchResult = await clientA
        .from("user_recipes")
        .select("*")
        .eq("id", result.data!)
        .single();

      expectSuccess(fetchResult, "Should fetch created recipe");
      const recipe = fetchResult.data as RecipeFromView;

      expect(recipe.ingredients).not.toBeNull();
      expect(recipe.ingredients).toHaveLength(3);

      const garlic = recipe.ingredients!.find((i) => i.name === "Vitlök");
      const onion = recipe.ingredients!.find((i) => i.name === "Lök");
      const salt = recipe.ingredients!.find((i) => i.name === "Salt");

      expect(garlic?.form).toBe("hackad");
      expect(onion?.form).toBe("tärnad");
      expect(salt?.form).toBeNull();
    });

    it("fails for unauthenticated users", async () => {
      const result = await anonymousClient.rpc<string>("insert_recipe", {
        p_name: "Should Fail",
        p_description: "This should not be created",
        p_author: null,
        p_url: null,
        p_recipe_yield: 4,
        p_recipe_yield_name: null,
        p_prep_time: null,
        p_cook_time: null,
        p_cuisine: null,
        p_image: null,

        p_categories: [],
        p_ingredients: [],
        p_instructions: [],
      });

      expectError(result);
      expect(result.error?.message).toContain("permission denied");
    });

    it("enforces maximum limits on arrays", async () => {
      const tooManyCategories = Array.from({ length: 25 }, (_, i) => `Cat${i}`);
      const catResult = await clientA.rpc<string>("insert_recipe", {
        p_name: "Too Many Categories",
        p_description: "Test",
        p_author: null,
        p_url: null,
        p_recipe_yield: 4,
        p_recipe_yield_name: null,
        p_prep_time: null,
        p_cook_time: null,
        p_cuisine: null,
        p_image: null,

        p_categories: tooManyCategories,
        p_ingredients: [],
        p_instructions: [],
      });

      expectError(catResult);
      expect(catResult.error?.message).toContain("Too many categories");
    });
  });

  describe("update_recipe", () => {
    let recipeId: string;

    beforeEach(async () => {
      recipeId = await createTestRecipe(clientA, {
        name: `Update Test ${uniqueId()}`,
      });
    });

    it("returns void on successful update", async () => {
      const result = await clientA.rpc("update_recipe", {
        p_recipe_id: recipeId,
        p_name: "Updated Name",
        p_description: "Updated description",
        p_author: "Updated Author",
        p_url: "https://updated.example.com",
        p_recipe_yield: 6,
        p_recipe_yield_name: "portioner",
        p_prep_time: 20,
        p_cook_time: 45,
        p_cuisine: "Italian",
        p_image: "https://example.com/image.jpg",

        p_categories: ["Efterrätt"],
        p_ingredients: [
          { name: "Socker", measurement: "dl", quantity: "2" },
        ],
        p_instructions: [{ step: "Blanda allt." }],
      });

      expect(result.error).toBeNull();
      expect([200, 204]).toContain(result.status);
      expect(result.data).toBeFalsy();

      const fetchResult = await clientA
        .from("user_recipes")
        .select("*")
        .eq("id", recipeId)
        .single();

      expectSuccess(fetchResult, "Should fetch updated recipe");
      const recipe = fetchResult.data as RecipeFromView;

      expect(recipe.name).toBe("Updated Name");
      expect(recipe.description).toBe("Updated description");
      expect(recipe.author).toBe("Updated Author");
      expect(recipe.recipe_yield).toBe(6);
      expect(recipe.cuisine).toBe("Italian");
      expect(recipe.categories).toContain("Efterrätt");
    });

    it("fails when user does not own the recipe", async () => {
      const result = await clientB.rpc("update_recipe", {
        p_recipe_id: recipeId,
        p_name: "Hacked Name",
        p_description: "Hacked description",
        p_author: null,
        p_url: null,
        p_recipe_yield: 4,
        p_recipe_yield_name: null,
        p_prep_time: null,
        p_cook_time: null,
        p_cuisine: null,
        p_image: null,

        p_categories: [],
        p_ingredients: [],
        p_instructions: [],
      });

      expectError(result);
      expect(result.error?.message).toContain("Access denied");
    });

    it("fails for non-existent recipe", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000";
      const result = await clientA.rpc("update_recipe", {
        p_recipe_id: fakeId,
        p_name: "Ghost Recipe",
        p_description: "Does not exist",
        p_author: null,
        p_url: null,
        p_recipe_yield: 4,
        p_recipe_yield_name: null,
        p_prep_time: null,
        p_cook_time: null,
        p_cuisine: null,
        p_image: null,

        p_categories: [],
        p_ingredients: [],
        p_instructions: [],
      });

      expectError(result);
      expect(result.error?.message).toContain("Recipe not found");
    });

    it("fails for unauthenticated users", async () => {
      const result = await anonymousClient.rpc("update_recipe", {
        p_recipe_id: recipeId,
        p_name: "Anonymous Update",
        p_description: "Should fail",
        p_author: null,
        p_url: null,
        p_recipe_yield: 4,
        p_recipe_yield_name: null,
        p_prep_time: null,
        p_cook_time: null,
        p_cuisine: null,
        p_image: null,

        p_categories: [],
        p_ingredients: [],
        p_instructions: [],
      });

      expectError(result);
      expect(result.error?.message).toContain("permission denied");
    });
  });
});
