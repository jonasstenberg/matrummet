import { z } from "zod";

import { rpcTool, type ToolDef, viewTool } from "../tool.js";

export const shoppingListTools: ToolDef[] = [
  rpcTool({
    name: "create_shopping_list",
    title: "Create shopping list",
    description:
      "Create a shopping list. Pass home_id to make it a shared household list, omit for a personal list. Returns the list id.",
    rpc: "create_shopping_list",
    inputSchema: {
      name: z.string().describe("List name"),
      // Body param p_home_id (NOT the X-Active-Home-Id header).
      home_id: z.string().optional().describe("Household id for a shared list; omit for personal"),
    },
  }),
  rpcTool({
    name: "get_user_shopping_lists",
    title: "List shopping lists",
    description: "List your shopping lists with item/checked counts.",
    rpc: "get_user_shopping_lists",
    household: true,
    annotations: { readOnlyHint: true },
  }),
  rpcTool({
    name: "add_recipe_to_shopping_list",
    title: "Add recipe to shopping list",
    description:
      "Add a recipe's ingredients to a shopping list (default list if shopping_list_id omitted).",
    rpc: "add_recipe_to_shopping_list",
    household: true,
    inputSchema: {
      recipe_id: z.string().describe("Recipe id"),
      shopping_list_id: z.string().optional().describe("Target list; omit for default"),
      servings: z.number().int().optional().describe("Scale to this many servings"),
      ingredient_ids: z.array(z.string()).optional().describe("Specific ingredient ids; omit = all"),
    },
  }),
  rpcTool({
    name: "add_custom_shopping_list_item",
    title: "Add custom shopping item",
    description: "Add a custom item to a shopping list.",
    rpc: "add_custom_shopping_list_item",
    household: true,
    inputSchema: {
      name: z.string().describe("Item text"),
      shopping_list_id: z.string().optional().describe("Target list; omit for default"),
      food_id: z.string().optional().describe("Optional linked food id"),
    },
  }),
  rpcTool({
    name: "toggle_shopping_list_item",
    title: "Toggle shopping item",
    description: "Check/uncheck a shopping list item.",
    rpc: "toggle_shopping_list_item",
    household: true,
    inputSchema: { item_id: z.string().describe("Shopping list item id") },
  }),
  rpcTool({
    name: "clear_checked_items",
    title: "Clear checked items",
    description: "Remove checked items from a shopping list (default list if omitted).",
    rpc: "clear_checked_items",
    household: true,
    inputSchema: {
      shopping_list_id: z.string().optional().describe("Target list; omit for default"),
    },
  }),
  rpcTool({
    name: "rename_shopping_list",
    title: "Rename shopping list",
    description: "Rename a shopping list.",
    rpc: "rename_shopping_list",
    household: true,
    inputSchema: {
      list_id: z.string().describe("Shopping list id"),
      name: z.string().describe("New name"),
    },
  }),
  rpcTool({
    name: "set_default_shopping_list",
    title: "Set default shopping list",
    description: "Mark a shopping list as your default.",
    rpc: "set_default_shopping_list",
    household: true,
    inputSchema: { list_id: z.string().describe("Shopping list id") },
  }),
  rpcTool({
    name: "delete_shopping_list",
    title: "Delete shopping list",
    description: "Delete a shopping list and its items.",
    rpc: "delete_shopping_list",
    household: true,
    annotations: { destructiveHint: true },
    inputSchema: { list_id: z.string().describe("Shopping list id") },
  }),
  viewTool({
    name: "get_shopping_list_items",
    title: "Get shopping list items",
    description: "Read the items of a shopping list (checked items last).",
    view: "shopping_list_view",
    household: true,
    defaultOrder: "is_checked.asc,sort_order.asc",
    inputSchema: {
      shopping_list_id: z.string().describe("Shopping list id"),
    },
    buildFilters: (args): Record<string, string> => {
      const id = typeof args.shopping_list_id === "string" ? args.shopping_list_id : "";
      return id ? { shopping_list_id: `eq.${id}` } : {};
    },
  }),
];
