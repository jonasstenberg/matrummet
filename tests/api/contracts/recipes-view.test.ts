/**
 * Contract tests for user_recipes view shape and instruction-ingredient group matching
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupTestHooks, type PostgrestClient } from "../setup";
import { createTestRecipe, uniqueId, SAMPLE_RECIPES } from "../seed";
import { expectSuccess } from "../helpers";
import {
  type RecipeFromView,
  type Ingredient,
  type IngredientGroup,
  type Instruction,
  type RecipeTestContext,
  setupRecipeTestContext,
  teardownRecipeTestContext,
} from "./recipes-types";

describe("Recipe View & Matching", () => {
  setupTestHooks();

  let clientA: PostgrestClient;
  let ctx: RecipeTestContext;

  beforeAll(async () => {
    ctx = await setupRecipeTestContext();
    clientA = ctx.clientA;
  });

  afterAll(async () => {
    await teardownRecipeTestContext(ctx);
  });

  describe("user_recipes view shape validation", () => {
    let testRecipeId: string;

    beforeAll(async () => {
      testRecipeId = await createTestRecipe(clientA, {
        ...SAMPLE_RECIPES.complex,
        name: `Shape Test ${uniqueId()}`,
      });
    });

    it("returns all expected fields with correct types", async () => {
      const result = await clientA
        .from("user_recipes")
        .select("*")
        .eq("id", testRecipeId)
        .single();

      expectSuccess(result);
      const recipe = result.data as RecipeFromView;

      // Core fields
      expect(typeof recipe.id).toBe("string");
      expect(typeof recipe.name).toBe("string");
      expect(typeof recipe.description).toBe("string");
      expect(typeof recipe.is_owner).toBe("boolean");

      // Optional string fields (can be null)
      expect(recipe.author === null || typeof recipe.author === "string").toBe(true);
      expect(recipe.url === null || typeof recipe.url === "string").toBe(true);
      expect(recipe.cuisine === null || typeof recipe.cuisine === "string").toBe(true);
      expect(recipe.image === null || typeof recipe.image === "string").toBe(true);
      expect(recipe.thumbnail === null || typeof recipe.thumbnail === "string").toBe(true);
      expect(recipe.recipe_yield_name === null || typeof recipe.recipe_yield_name === "string").toBe(true);

      // Optional number fields (can be null)
      expect(recipe.recipe_yield === null || typeof recipe.recipe_yield === "number").toBe(true);
      expect(recipe.prep_time === null || typeof recipe.prep_time === "number").toBe(true);
      expect(recipe.cook_time === null || typeof recipe.cook_time === "number").toBe(true);

      // Date fields (ISO strings)
      expect(recipe.date_published === null || typeof recipe.date_published === "string").toBe(true);
      expect(recipe.date_modified === null || typeof recipe.date_modified === "string").toBe(true);

      // Boolean fields
      expect(typeof recipe.is_liked).toBe("boolean");

      // Array fields
      expect(Array.isArray(recipe.categories)).toBe(true);

      // JSONB arrays (can be null for empty recipes)
      expect(recipe.ingredients === null || Array.isArray(recipe.ingredients)).toBe(true);
      expect(recipe.instructions === null || Array.isArray(recipe.instructions)).toBe(true);
      expect(recipe.ingredient_groups === null || Array.isArray(recipe.ingredient_groups)).toBe(true);
      expect(recipe.instruction_groups === null || Array.isArray(recipe.instruction_groups)).toBe(true);
    });

    it("ingredients have correct shape including form field", async () => {
      const result = await clientA
        .from("user_recipes")
        .select("ingredients")
        .eq("id", testRecipeId)
        .single();

      expectSuccess(result);
      const data = result.data as { ingredients: Ingredient[] };

      expect(data.ingredients.length).toBeGreaterThan(0);

      for (const ingredient of data.ingredients) {
        expect(typeof ingredient.id).toBe("string");
        expect(typeof ingredient.name).toBe("string");
        expect(typeof ingredient.measurement).toBe("string");
        expect(typeof ingredient.quantity).toBe("string");
        expect(ingredient.form === null || typeof ingredient.form === "string").toBe(true);
        expect(ingredient.group_id === null || typeof ingredient.group_id === "string").toBe(true);
        expect(typeof ingredient.sort_order).toBe("number");
        expect(ingredient.food_id === null || typeof ingredient.food_id === "string").toBe(true);
        expect(ingredient.unit_id === null || typeof ingredient.unit_id === "string").toBe(true);
      }
    });

    it("instructions have correct shape", async () => {
      const result = await clientA
        .from("user_recipes")
        .select("instructions")
        .eq("id", testRecipeId)
        .single();

      expectSuccess(result);
      const data = result.data as { instructions: Instruction[] };

      expect(data.instructions.length).toBeGreaterThan(0);

      for (const instruction of data.instructions) {
        expect(typeof instruction.id).toBe("string");
        expect(typeof instruction.step).toBe("string");
        expect(instruction.group_id === null || typeof instruction.group_id === "string").toBe(true);
        expect(typeof instruction.sort_order).toBe("number");
        expect(Array.isArray(instruction.matched_ingredients)).toBe(true);
      }
    });

    it("instructions include matched_ingredients with correct shape", async () => {
      const matchRecipeId = await createTestRecipe(clientA, {
        name: `Matched Ingredients Test ${uniqueId()}`,
        ingredients: [
          { name: "Lök", measurement: "st", quantity: "1" },
          { name: "Vitlök", measurement: "klyftor", quantity: "2" },
          { name: "Smör", measurement: "msk", quantity: "1" },
        ],
        instructions: [
          { step: "Hacka lök och vitlök." },
          { step: "Stek i smör." },
        ],
      });

      const result = await clientA
        .from("user_recipes")
        .select("instructions")
        .eq("id", matchRecipeId)
        .single();

      expectSuccess(result);
      const data = result.data as { instructions: Instruction[] };

      const step1 = data.instructions.find((i) => i.step.includes("lök"));
      expect(step1).toBeDefined();
      expect(step1!.matched_ingredients.length).toBeGreaterThan(0);

      for (const mi of step1!.matched_ingredients) {
        expect(typeof mi.id).toBe("string");
        expect(typeof mi.name).toBe("string");
        expect(mi.quantity === null || typeof mi.quantity === "string").toBe(true);
        expect(mi.measurement === null || typeof mi.measurement === "string").toBe(true);
      }

      const step2 = data.instructions.find((i) => i.step.includes("smör"));
      expect(step2).toBeDefined();
      expect(step2!.matched_ingredients.length).toBeGreaterThan(0);
      expect(step2!.matched_ingredients.some((mi) => mi.name === "Smör")).toBe(true);
    });

    it("ingredient_groups have correct shape when present", async () => {
      const groupRecipeId = await createTestRecipe(clientA, {
        name: `Group Shape Test ${uniqueId()}`,
        ingredients: [
          { name: "Test Ingredient", measurement: "st", quantity: "1" },
        ],
        instructions: [{ step: "Test step" }],
      });

      await clientA.rpc("update_recipe", {
        p_recipe_id: groupRecipeId,
        p_name: "Group Shape Test",
        p_description: "Test",
        p_author: null,
        p_url: null,
        p_recipe_yield: 4,
        p_recipe_yield_name: null,
        p_prep_time: null,
        p_cook_time: null,
        p_cuisine: null,
        p_image: null,

        p_categories: [],
        p_ingredients: [
          { group: "First Group" },
          { name: "Ingredient A", measurement: "st", quantity: "1" },
          { group: "Second Group" },
          { name: "Ingredient B", measurement: "dl", quantity: "2" },
        ],
        p_instructions: [{ step: "Test" }],
      });

      const result = await clientA
        .from("user_recipes")
        .select("ingredient_groups")
        .eq("id", groupRecipeId)
        .single();

      expectSuccess(result);
      const data = result.data as { ingredient_groups: IngredientGroup[] };

      expect(data.ingredient_groups).not.toBeNull();
      expect(data.ingredient_groups.length).toBe(2);

      for (const group of data.ingredient_groups) {
        expect(typeof group.id).toBe("string");
        expect(typeof group.name).toBe("string");
        expect(typeof group.sort_order).toBe("number");
      }

      expect(data.ingredient_groups[0].name).toBe("First Group");
      expect(data.ingredient_groups[1].name).toBe("Second Group");
    });
  });

  describe("instruction-ingredient group matching", () => {
    it("prefers same-group ingredient when groups match exactly", async () => {
      const recipeId = await createTestRecipe(clientA, {
        name: `Group Match Exact ${uniqueId()}`,
        ingredients: [
          { name: "Dummy", measurement: "st", quantity: "1" },
        ],
        instructions: [{ step: "Dummy" }],
      });

      const updateResult = await clientA.rpc("update_recipe", {
        p_recipe_id: recipeId,
        p_name: "Group Match Exact",
        p_description: "Test",
        p_author: null,
        p_url: null,
        p_recipe_yield: 4,
        p_recipe_yield_name: null,
        p_prep_time: null,
        p_cook_time: null,
        p_cuisine: null,
        p_image: null,
        p_categories: [],
        p_ingredients: [
          { group: "Sås" },
          { name: "Vatten", measurement: "dl", quantity: "2" },
          { group: "Pasta" },
          { name: "Vatten", measurement: "dl", quantity: "5" },
        ],
        p_instructions: [
          { group: "Sås" },
          { step: "Koka upp vatten." },
          { group: "Pasta" },
          { step: "Koka vatten till pastan." },
        ],
      });
      expect(updateResult.error).toBeNull();

      const result = await clientA
        .from("user_recipes")
        .select("instructions,ingredient_groups")
        .eq("id", recipeId)
        .single();

      expectSuccess(result);
      const data = result.data as {
        instructions: Instruction[];
        ingredient_groups: IngredientGroup[];
      };

      const sasGroup = data.ingredient_groups.find((g) => g.name === "Sås");
      const pastaGroup = data.ingredient_groups.find((g) => g.name === "Pasta");
      expect(sasGroup).toBeDefined();
      expect(pastaGroup).toBeDefined();

      const sasInstruction = data.instructions.find((i) => i.step === "Koka upp vatten.");
      const pastaInstruction = data.instructions.find((i) => i.step === "Koka vatten till pastan.");
      expect(sasInstruction).toBeDefined();
      expect(pastaInstruction).toBeDefined();

      expect(sasInstruction!.matched_ingredients.length).toBeGreaterThan(0);
      expect(pastaInstruction!.matched_ingredients.length).toBeGreaterThan(0);

      const sasMatch = sasInstruction!.matched_ingredients.find((mi) => mi.name === "Vatten");
      expect(sasMatch).toBeDefined();
      expect(sasMatch!.quantity).toBe("2");

      const pastaMatch = pastaInstruction!.matched_ingredients.find((mi) => mi.name === "Vatten");
      expect(pastaMatch).toBeDefined();
      expect(pastaMatch!.quantity).toBe("5");
    });

    it("fuzzy-matches group names with Swedish definite forms (Sås ↔ Såsen)", async () => {
      const recipeId = await createTestRecipe(clientA, {
        name: `Group Match Fuzzy ${uniqueId()}`,
        ingredients: [
          { name: "Dummy", measurement: "st", quantity: "1" },
        ],
        instructions: [{ step: "Dummy" }],
      });

      await clientA.rpc("update_recipe", {
        p_recipe_id: recipeId,
        p_name: "Group Match Fuzzy",
        p_description: "Test",
        p_author: null,
        p_url: null,
        p_recipe_yield: 4,
        p_recipe_yield_name: null,
        p_prep_time: null,
        p_cook_time: null,
        p_cuisine: null,
        p_image: null,
        p_categories: [],
        p_ingredients: [
          { group: "Sås" },
          { name: "Smör", measurement: "msk", quantity: "2" },
          { group: "Pasta" },
          { name: "Smör", measurement: "msk", quantity: "1" },
        ],
        p_instructions: [
          { group: "Såsen" },
          { step: "Smält smör i en kastrull." },
          { group: "Pastan" },
          { step: "Rör ner smör." },
        ],
      });

      const result = await clientA
        .from("user_recipes")
        .select("instructions,ingredient_groups")
        .eq("id", recipeId)
        .single();

      expectSuccess(result);
      const data = result.data as {
        instructions: Instruction[];
        ingredient_groups: IngredientGroup[];
      };

      const sasInstruction = data.instructions.find((i) => i.step.includes("kastrull"));
      const pastaInstruction = data.instructions.find((i) => i.step === "Rör ner smör.");
      expect(sasInstruction).toBeDefined();
      expect(pastaInstruction).toBeDefined();

      // Despite "Sås" ≠ "Såsen" (exact), fuzzy matching should prefer same-group
      const sasMatch = sasInstruction!.matched_ingredients.find((mi) => mi.name === "Smör");
      expect(sasMatch).toBeDefined();
      expect(sasMatch!.quantity).toBe("2"); // From the "Sås" group

      const pastaMatch = pastaInstruction!.matched_ingredients.find((mi) => mi.name === "Smör");
      expect(pastaMatch).toBeDefined();
      expect(pastaMatch!.quantity).toBe("1"); // From the "Pasta" group
    });
  });
});
