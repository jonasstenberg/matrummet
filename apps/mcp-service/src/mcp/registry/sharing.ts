import { z } from "zod";

import { rpcTool, type ToolDef } from "../tool.js";

export const sharingTools: ToolDef[] = [
  rpcTool({
    name: "create_share_token",
    title: "Create recipe share link",
    description: "Create a share token/link for one of your recipes. Returns { token, expires_at }.",
    rpc: "create_share_token",
    inputSchema: {
      recipe_id: z.string().describe("Recipe id (must be yours)"),
      expires_days: z.number().int().optional().describe("Days until expiry; omit/null = never"),
    },
  }),
  rpcTool({
    name: "get_recipe_share_tokens",
    title: "List recipe share tokens",
    description: "List share tokens for one of your recipes.",
    rpc: "get_recipe_share_tokens",
    annotations: { readOnlyHint: true },
    inputSchema: { recipe_id: z.string().describe("Recipe id") },
  }),
  rpcTool({
    name: "revoke_share_token",
    title: "Revoke recipe share token",
    description: "Revoke a recipe share token. Returns true.",
    rpc: "revoke_share_token",
    inputSchema: { token: z.string().describe("Share token to revoke") },
  }),
  rpcTool({
    name: "get_shared_recipe",
    title: "Get shared recipe",
    description:
      "Fetch a recipe by its share token. Returns the recipe + sharer name; empty if the token is invalid, expired or revoked.",
    rpc: "get_shared_recipe",
    anon: true,
    annotations: { readOnlyHint: true, openWorldHint: true },
    inputSchema: { token: z.string().describe("Share token") },
  }),
  rpcTool({
    name: "copy_shared_recipe",
    title: "Copy shared recipe",
    description: "Copy a shared recipe (by token) into your own collection. Returns the new id.",
    rpc: "copy_shared_recipe",
    inputSchema: { token: z.string().describe("Share token") },
  }),
];
