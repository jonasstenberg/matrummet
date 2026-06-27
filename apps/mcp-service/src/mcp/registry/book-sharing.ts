import { z } from "zod";

import { rpcTool, type ToolDef } from "../tool.js";

export const bookSharingTools: ToolDef[] = [
  rpcTool({
    name: "create_book_share_token",
    title: "Share whole recipe book",
    description: "Create a share link for your entire recipe book. Returns { token, expires_at }.",
    rpc: "create_book_share_token",
    inputSchema: {
      expires_days: z.number().int().optional().describe("Days until expiry; omit/null = never"),
    },
  }),
  rpcTool({
    name: "get_book_share_info",
    title: "Preview book share link",
    description:
      "Preview a recipe-book share link: sharer name/email, recipe count, whether you're already connected.",
    rpc: "get_book_share_info",
    anon: true,
    annotations: { readOnlyHint: true, openWorldHint: true },
    inputSchema: { token: z.string().describe("Book share token") },
  }),
  rpcTool({
    name: "accept_book_share",
    title: "Accept book share",
    description: "Connect to a shared recipe book by token (idempotent). Returns sharer info.",
    rpc: "accept_book_share",
    inputSchema: { token: z.string().describe("Book share token") },
  }),
  rpcTool({
    name: "get_shared_books",
    title: "List shared books",
    description: "List recipe books shared with you.",
    rpc: "get_shared_books",
    annotations: { readOnlyHint: true },
  }),
  rpcTool({
    name: "revoke_book_share_token",
    title: "Revoke book share token",
    description: "Revoke one of your book share tokens. Returns true.",
    rpc: "revoke_book_share_token",
    inputSchema: { token: z.string().describe("Book share token") },
  }),
  rpcTool({
    name: "remove_book_share_connection",
    title: "Remove book share connection",
    description: "Remove a book share connection (either party may remove). Returns true.",
    rpc: "remove_book_share_connection",
    inputSchema: { connection_id: z.string().describe("Connection id") },
  }),
];
