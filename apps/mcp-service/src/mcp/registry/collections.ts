import { z } from "zod";

import { rpcTool, type ToolDef } from "../tool.js";

const collectionId = z.string().describe("Collection id");

export const collectionTools: ToolDef[] = [
  rpcTool({
    name: "list_collections",
    title: "List collections",
    description: "List collections you own plus collections shared with you.",
    rpc: "list_collections",
    annotations: { readOnlyHint: true },
  }),
  rpcTool({
    name: "create_collection",
    title: "Create collection",
    description:
      'Create a collection. kind is "personal" (default) or "curated" (curated requires admin).',
    rpc: "create_collection",
    inputSchema: {
      name: z.string().describe("Collection name"),
      description: z.string().optional().describe("Optional description"),
      kind: z.enum(["personal", "curated"]).optional().describe("Default personal"),
    },
  }),
  rpcTool({
    name: "update_collection",
    title: "Update collection",
    description: "Update a collection you own.",
    rpc: "update_collection",
    annotations: { idempotentHint: true },
    inputSchema: {
      id: collectionId,
      name: z.string().optional(),
      description: z.string().optional(),
      cover_image: z.string().optional().describe("Cover image id"),
    },
  }),
  rpcTool({
    name: "delete_collection",
    title: "Delete collection",
    description:
      "Delete a collection you own (cascades membership; does NOT delete the recipes themselves).",
    rpc: "delete_collection",
    annotations: { destructiveHint: true },
    inputSchema: { id: collectionId },
  }),
  rpcTool({
    name: "add_recipe_to_collection",
    title: "Add recipe to collection",
    description: "Add one of your recipes to one of your collections.",
    rpc: "add_recipe_to_collection",
    inputSchema: {
      collection_id: collectionId,
      recipe_id: z.string().describe("Recipe id (must be yours)"),
    },
  }),
  rpcTool({
    name: "remove_recipe_from_collection",
    title: "Remove recipe from collection",
    description: "Remove a recipe from one of your collections.",
    rpc: "remove_recipe_from_collection",
    inputSchema: { collection_id: collectionId, recipe_id: z.string().describe("Recipe id") },
  }),
  rpcTool({
    name: "collections_for_recipe",
    title: "Collections for recipe",
    description: "List your collections, each flagged whether it contains the given recipe.",
    rpc: "collections_for_recipe",
    annotations: { readOnlyHint: true },
    inputSchema: { recipe_id: z.string().describe("Recipe id") },
  }),
  rpcTool({
    name: "list_recipes_by_collection",
    title: "List recipes in collection",
    description: "List a collection's recipes (newest first).",
    rpc: "list_recipes_by_collection",
    annotations: { readOnlyHint: true },
    inputSchema: {
      collection_id: collectionId,
      limit: z.number().int().min(1).max(1000).optional().describe("Max results (default 50)"),
      offset: z.number().int().min(0).optional().describe("Pagination offset"),
    },
  }),
  rpcTool({
    name: "count_recipes_by_collection",
    title: "Count recipes in collection",
    description: "Return the number of recipes in a collection.",
    rpc: "count_recipes_by_collection",
    annotations: { readOnlyHint: true },
    inputSchema: { collection_id: collectionId },
  }),
  rpcTool({
    name: "create_collection_share_token",
    title: "Share collection",
    description: "Create a share link for a collection you own. Returns { token, expires_at }.",
    rpc: "create_collection_share_token",
    inputSchema: {
      collection_id: collectionId,
      expires_days: z.number().int().optional().describe("Days until expiry; omit/null = never"),
    },
  }),
  rpcTool({
    name: "get_collection_share_info",
    title: "Preview collection share link",
    description:
      "Preview a collection share link (requires sign-in; no anonymous preview). Returns collection + sharer info.",
    rpc: "get_collection_share_info",
    annotations: { readOnlyHint: true },
    inputSchema: { token: z.string().describe("Collection share token") },
  }),
  rpcTool({
    name: "accept_collection_share",
    title: "Accept collection share",
    description: "Accept a collection share link (idempotent), granting read access to its recipes.",
    rpc: "accept_collection_share",
    inputSchema: { token: z.string().describe("Collection share token") },
  }),
  rpcTool({
    name: "get_shared_collections",
    title: "List shared collections",
    description: "List collections shared with you.",
    rpc: "get_shared_collections",
    annotations: { readOnlyHint: true },
  }),
  rpcTool({
    name: "revoke_collection_share_token",
    title: "Revoke collection share token",
    description: "Revoke a collection share token (owner only). Returns true.",
    rpc: "revoke_collection_share_token",
    inputSchema: { token: z.string().describe("Collection share token") },
  }),
  rpcTool({
    name: "remove_collection_share_connection",
    title: "Remove collection share connection",
    description: "Remove a collection share connection (either party). Returns true.",
    rpc: "remove_collection_share_connection",
    inputSchema: { connection_id: z.string().describe("Connection id") },
  }),
];
