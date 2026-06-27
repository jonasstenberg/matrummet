import { z } from "zod";

import { rpcTool, type ToolDef } from "../tool.js";

export const apiKeyTools: ToolDef[] = [
  rpcTool({
    name: "get_user_api_keys",
    title: "List API keys",
    description: "List your API keys (prefix + metadata only; the full key is never shown again).",
    rpc: "get_user_api_keys",
    annotations: { readOnlyHint: true },
  }),
  rpcTool({
    name: "create_user_api_key",
    title: "Create API key",
    description:
      "Create a new API key. Returns the full key ONCE — store it securely; it cannot be retrieved again.",
    rpc: "create_user_api_key",
    inputSchema: { name: z.string().describe("A label for the key") },
  }),
  rpcTool({
    name: "revoke_api_key",
    title: "Revoke API key",
    description: "Revoke one of your API keys.",
    rpc: "revoke_api_key",
    annotations: { destructiveHint: true },
    inputSchema: { key_id: z.string().describe("API key id") },
  }),
];
