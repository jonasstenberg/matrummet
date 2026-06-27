import { z } from "zod";

import { rpcTool, type ToolDef } from "../tool.js";

const limit = z.number().int().min(1).max(1000).optional().describe("Max results (cap 1000)");
const offset = z.number().int().min(0).optional().describe("Pagination offset");
const readOnly = { readOnlyHint: true };

export const searchTools: ToolDef[] = [
  rpcTool({
    name: "search_recipes",
    title: "Search recipes",
    description: "Swedish full-text search across recipes you can see (your own + shared).",
    rpc: "search_recipes",
    annotations: readOnly,
    inputSchema: {
      query: z.string().describe("Search query"),
      owner_only: z.boolean().optional().describe("Only your own recipes (default false)"),
      category: z.string().optional().describe("Filter by category name"),
      limit,
      offset,
      owner_ids: z.array(z.string()).optional().describe("Filter by owner ids"),
    },
  }),
  rpcTool({
    name: "search_liked_recipes",
    title: "Search liked recipes",
    description: "Full-text search across recipes you have liked.",
    rpc: "search_liked_recipes",
    annotations: readOnly,
    inputSchema: {
      query: z.string().describe("Search query"),
      category: z.string().optional().describe("Filter by category name"),
      limit,
      offset,
    },
  }),
  rpcTool({
    name: "search_public_recipes",
    title: "Search public recipes",
    description: "Full-text search across all public recipes.",
    rpc: "search_public_recipes",
    annotations: readOnly,
    inputSchema: {
      query: z.string().describe("Search query"),
      category: z.string().optional().describe("Filter by category name"),
      author_id: z.string().optional().describe("Filter by recipe owner id"),
      limit,
      offset,
    },
  }),
  rpcTool({
    name: "search_foods",
    title: "Search foods",
    description: "Search the food database to resolve food ids (e.g. for pantry tools).",
    rpc: "search_foods",
    annotations: readOnly,
    inputSchema: {
      query: z.string().describe("Food name query"),
      limit: z.number().int().min(1).max(1000).optional().describe("Max results (default 10)"),
    },
  }),
  rpcTool({
    name: "search_units",
    title: "Search units",
    description: "Search measurement units.",
    rpc: "search_units",
    annotations: readOnly,
    inputSchema: {
      query: z.string().describe("Unit name query"),
      limit: z.number().int().min(1).max(1000).optional().describe("Max results (default 10)"),
    },
  }),
  rpcTool({
    name: "current_user_info",
    title: "Current user",
    description: "Return your account info (email, name, role).",
    rpc: "current_user_info",
    annotations: readOnly,
  }),
];
