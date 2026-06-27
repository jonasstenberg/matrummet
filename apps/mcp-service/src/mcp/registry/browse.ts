import { z } from "zod";

import { rpcTool, type ToolDef, viewTool } from "../tool.js";

/** Direct PostgREST view reads (the documented "Direct Table Access" section). */
export const browseTools: ToolDef[] = [
  rpcTool({
    name: "count_recipes",
    title: "Count recipes",
    description:
      "Total number of recipes you can see (your own + shared). Returns a single number. " +
      "owner_only=true counts only your own; filter by categories. Pairs with list_user_recipes for paging.",
    rpc: "count_recipes",
    annotations: { readOnlyHint: true },
    inputSchema: {
      owner_only: z.boolean().optional().describe("Only your own recipes (default false)"),
      categories: z.array(z.string()).optional().describe("Filter by category names"),
      owner_ids: z.array(z.string()).optional().describe("Filter by owner ids"),
    },
  }),
  viewTool({
    name: "list_user_recipes",
    title: "List my recipes",
    description: "List recipes you can see (your own + shared), newest modified first.",
    view: "user_recipes",
    defaultOrder: "date_modified.desc",
    inputSchema: {
      name_contains: z.string().optional().describe("Case-insensitive name filter"),
    },
    buildFilters: (args): Record<string, string> => {
      const term = typeof args.name_contains === "string" ? args.name_contains : "";
      return term ? { name: `ilike.*${term}*` } : {};
    },
  }),
  viewTool({
    name: "list_public_recipes",
    title: "List public recipes",
    description: "List public recipes.",
    view: "public_recipes",
    defaultOrder: "date_modified.desc",
    inputSchema: {
      name_contains: z.string().optional().describe("Case-insensitive name filter"),
    },
    buildFilters: (args): Record<string, string> => {
      const term = typeof args.name_contains === "string" ? args.name_contains : "";
      return term ? { name: `ilike.*${term}*` } : {};
    },
  }),
  viewTool({
    name: "list_liked_recipes",
    title: "List liked recipes",
    description: "List recipes you have liked.",
    view: "liked_recipes",
    defaultOrder: "date_modified.desc",
  }),
  viewTool({
    name: "list_featured_recipes",
    title: "List featured recipes",
    description: "List featured recipes.",
    view: "featured_recipes",
  }),
];
