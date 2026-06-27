import { z } from "zod";

import { rpcTool, type ToolDef } from "../tool.js";

const mealEntry = z.object({
  day_of_week: z.number().int().describe("0 = Monday … 6 = Sunday"),
  meal_type: z.string().describe('Meal type, e.g. "dinner"'),
  recipe_id: z.string().optional().describe("Real recipe id (use this OR suggested_name)"),
  suggested_name: z.string().optional().describe("Free-text suggestion (non-recipe entry)"),
  suggested_description: z.string().optional().describe("Optional suggestion description"),
  servings: z.number().int().optional().describe("Servings (default 4)"),
  sort_order: z.number().int().optional().describe("Order within the day"),
});

export const mealPlanTools: ToolDef[] = [
  rpcTool({
    name: "get_meal_plan",
    title: "Get meal plan",
    description:
      "Get the active meal plan (or a specific one by id). Returns null when there is no active plan.",
    rpc: "get_meal_plan",
    household: true,
    annotations: { readOnlyHint: true },
    inputSchema: {
      plan_id: z.string().optional().describe("Specific plan id; omit for the latest active plan"),
    },
  }),
  rpcTool({
    name: "save_meal_plan",
    title: "Save meal plan",
    description:
      "Save a new weekly meal plan (archives any existing active plan). Returns the new plan id.",
    rpc: "save_meal_plan",
    household: true,
    inputSchema: {
      week_start: z.string().describe("Monday of the week, ISO date (YYYY-MM-DD)"),
      preferences: z.record(z.string(), z.unknown()).describe("Diet preferences object (may be {})"),
      entries: z.array(mealEntry).describe("Meal plan entries"),
    },
  }),
  rpcTool({
    name: "swap_meal_plan_entry",
    title: "Swap meal plan entry",
    description:
      "Replace a single meal plan entry. Provide either recipe_id or suggested_name (+ description).",
    rpc: "swap_meal_plan_entry",
    inputSchema: {
      entry_id: z.string().describe("Meal plan entry id"),
      recipe_id: z.string().optional().describe("Replacement recipe id"),
      suggested_name: z.string().optional().describe("Replacement free-text suggestion"),
      suggested_description: z.string().optional().describe("Suggestion description"),
    },
  }),
  rpcTool({
    name: "add_meal_plan_to_shopping_list",
    title: "Add meal plan to shopping list",
    description:
      "Add a meal plan's recipe ingredients to a shopping list. Returns { recipes_added }.",
    rpc: "add_meal_plan_to_shopping_list",
    household: true,
    inputSchema: {
      plan_id: z.string().describe("Meal plan id"),
      shopping_list_id: z.string().optional().describe("Target list; omit for default"),
    },
  }),
  rpcTool({
    name: "get_base_recipes",
    title: "Get base recipes",
    description: "Random recipes from the curated base pool (for meal-plan seeding).",
    rpc: "get_base_recipes",
    annotations: { readOnlyHint: true },
    inputSchema: {
      diet_types: z
        .array(z.enum(["vegan", "vegetarian", "pescetarian", "meat"]))
        .optional()
        .describe("Diet filters"),
      categories: z.array(z.string()).optional().describe("Category filters"),
      limit: z.number().int().min(1).max(1000).optional().describe("Max results (default 50)"),
    },
  }),
];
