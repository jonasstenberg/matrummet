import { z } from "zod";

import { deleteFrom, queryView, rpcTool, type ToolContext, type ToolDef } from "../tool.js";

/** Ingredient array element: an item OR a group header (never both). */
const ingredient = z.union([
  z.object({
    name: z.string().describe("Ingredient name (use this XOR group)"),
    quantity: z.number().nullish().describe("Amount as a number, or null"),
    measurement: z.string().nullish().describe("Unit, e.g. dl, g, msk"),
    form: z.string().nullish().describe("Preparation form, e.g. hackad"),
  }),
  z.object({ group: z.string().describe("Ingredient group header; items after it belong to it") }),
]);

/** Instruction array element: a step OR a group header (never both). */
const instruction = z.union([
  z.object({ step: z.string().describe("Instruction step text (use this XOR group)") }),
  z.object({ group: z.string().describe("Instruction group header") }),
]);

const recipeBody = {
  name: z.string().describe("Recipe name"),
  author: z.string().describe("Author name"),
  url: z.string().describe("Source URL (empty string if none)"),
  recipe_yield: z.number().int().describe("Number of servings"),
  recipe_yield_name: z.string().describe('Serving unit, e.g. "portioner"'),
  prep_time: z.number().int().describe("Prep time in minutes"),
  cook_time: z.number().int().describe("Cook time in minutes"),
  description: z.string().describe("Short description"),
  categories: z.array(z.string()).describe("Category names"),
  ingredients: z.array(ingredient).describe("Ordered ingredient objects"),
  instructions: z.array(instruction).describe("Ordered instruction objects"),
  cuisine: z.string().optional().describe("Cuisine type"),
  image: z.string().optional().describe("Image id from upload_image"),
} satisfies z.ZodRawShape;

export const recipeTools: ToolDef[] = [
  {
    name: "get_recipe",
    title: "Get recipe by id",
    description:
      "Fetch a single recipe in full (name, servings, categories, ingredients and instructions) by its id.",
    inputSchema: {
      recipe_id: z.string().describe("Recipe id (uuid)"),
    },
    annotations: { readOnlyHint: true },
    handler: async (args: Record<string, unknown>, ctx: ToolContext) => {
      const id = typeof args.recipe_id === "string" ? args.recipe_id : "";
      if (!id) throw new Error("recipe_id is required");
      const params = new URLSearchParams();
      params.set("id", `eq.${id}`);
      params.set("limit", "1");
      const rows = await queryView(ctx, "user_recipes", params);
      if (Array.isArray(rows)) {
        const list = rows as unknown[];
        return list[0] ?? "Recipe not found.";
      }
      return rows;
    },
  },
  rpcTool({
    name: "insert_recipe",
    title: "Create recipe",
    description:
      "Create a new recipe in your collection. Returns the new recipe id. Ingredients and instructions are ordered arrays of {name,quantity,measurement,form} / {step} objects, with optional {group} headers.",
    rpc: "insert_recipe",
    inputSchema: recipeBody,
  }),
  rpcTool({
    name: "update_recipe",
    title: "Update recipe",
    description: "Update one of your recipes. Replaces categories, ingredients and instructions.",
    rpc: "update_recipe",
    inputSchema: {
      recipe_id: z.string().describe("Id of the recipe to update (must be yours)"),
      ...recipeBody,
      date_published: z.string().optional().describe("Publish date, ISO 8601"),
    },
    annotations: { idempotentHint: true },
  }),
  rpcTool({
    name: "copy_recipe",
    title: "Copy recipe",
    description: "Copy another user's recipe into your own collection. Returns the new recipe id.",
    rpc: "copy_recipe",
    inputSchema: {
      source_recipe_id: z.string().describe("Id of the recipe to copy"),
    },
  }),
  rpcTool({
    name: "toggle_recipe_like",
    title: "Like / unlike recipe",
    description: "Toggle a like on a recipe that isn't your own. Returns { liked: boolean }.",
    rpc: "toggle_recipe_like",
    inputSchema: {
      recipe_id: z.string().describe("Id of the recipe to like or unlike"),
    },
  }),
  // OUT-OF-DOCS, DESTRUCTIVE: no documented delete RPC exists. Hard delete via a
  // PostgREST table delete (RLS restricts it to the owner). Image cleanup runs
  // via DB trigger. Requires explicit confirm:true.
  {
    name: "delete_recipe",
    title: "Delete recipe (destructive)",
    description:
      "Permanently delete one of your own recipes. This cannot be undone. You MUST pass confirm:true. (Not part of the documented API.)",
    inputSchema: {
      recipe_id: z.string().describe("Id of the recipe to delete (must be yours)"),
      confirm: z.literal(true).describe("Must be true to confirm permanent deletion"),
    },
    annotations: { destructiveHint: true },
    handler: async (args: Record<string, unknown>, ctx: ToolContext) => {
      const recipeId = typeof args.recipe_id === "string" ? args.recipe_id : "";
      if (!recipeId) throw new Error("recipe_id is required");
      if (args.confirm !== true) throw new Error("confirm must be true to delete a recipe");
      const params = new URLSearchParams();
      params.set("id", `eq.${recipeId}`);
      return deleteFrom(ctx, "recipes", params);
    },
  },
];
