import { z } from "zod";

import { rpcTool, type ToolDef } from "../tool.js";

const deduction = z.object({
  food_id: z.string().describe("Food id"),
  amount: z.number().describe("Amount to deduct"),
});

export const pantryTools: ToolDef[] = [
  rpcTool({
    name: "add_to_pantry",
    title: "Add to pantry",
    description: "Add or update a pantry item (upsert). Returns the pantry entry id.",
    rpc: "add_to_pantry",
    household: true,
    inputSchema: {
      food_id: z.string().describe("Food id (see search_foods)"),
      quantity: z.number().optional().describe("Quantity"),
      unit: z.string().optional().describe("Unit"),
      expires_at: z.string().optional().describe("Expiry date, ISO 8601"),
    },
  }),
  rpcTool({
    name: "remove_from_pantry",
    title: "Remove from pantry",
    description: "Remove a food from the pantry.",
    rpc: "remove_from_pantry",
    household: true,
    inputSchema: { food_id: z.string().describe("Food id") },
  }),
  rpcTool({
    name: "get_user_pantry",
    title: "Get pantry",
    description: "List your household pantry items.",
    rpc: "get_user_pantry",
    household: true,
    annotations: { readOnlyHint: true },
  }),
  rpcTool({
    name: "get_common_pantry_items",
    title: "Common pantry items",
    description: "Suggested common items for quick-add.",
    rpc: "get_common_pantry_items",
    annotations: { readOnlyHint: true },
  }),
  rpcTool({
    name: "find_recipes_from_pantry",
    title: "Find recipes from pantry",
    description: "Find recipes you can (mostly) make from your pantry, ranked by match %.",
    rpc: "find_recipes_from_pantry",
    household: true,
    annotations: { readOnlyHint: true },
    inputSchema: {
      min_match_percentage: z.number().int().optional().describe("Minimum match %% (default 50)"),
      limit: z.number().int().min(1).max(1000).optional().describe("Max results (default 20)"),
    },
  }),
  rpcTool({
    name: "find_recipes_by_ingredients",
    title: "Find recipes by ingredients",
    description: "Find recipes matching a given set of food ids.",
    rpc: "find_recipes_by_ingredients",
    annotations: { readOnlyHint: true },
    inputSchema: {
      food_ids: z.array(z.string()).describe("Food ids to match"),
      user_email: z.string().optional().describe("Restrict to a user's recipes"),
      min_match_percentage: z.number().int().optional().describe("Minimum match %% (default 50)"),
      limit: z.number().int().min(1).max(1000).optional().describe("Max results (default 20)"),
    },
  }),
  rpcTool({
    name: "deduct_from_pantry",
    title: "Deduct from pantry",
    description: "Deduct amounts from pantry items after cooking. Returns the count deducted.",
    rpc: "deduct_from_pantry",
    household: true,
    inputSchema: {
      deductions: z.array(deduction).describe("List of { food_id, amount } to deduct"),
    },
  }),
];
