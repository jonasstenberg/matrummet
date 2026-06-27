import { z } from "zod";

import { rpcTool, type ToolDef } from "../tool.js";

export const creditTools: ToolDef[] = [
  rpcTool({
    name: "get_user_credits",
    title: "Get credit balance",
    description: "Return your current AI credit balance (integer).",
    rpc: "get_user_credits",
    annotations: { readOnlyHint: true },
  }),
  rpcTool({
    name: "get_credit_history",
    title: "Credit history",
    description: "Return your AI credit transaction history.",
    rpc: "get_credit_history",
    annotations: { readOnlyHint: true },
    inputSchema: {
      limit: z.number().int().min(1).max(1000).optional().describe("Max rows (default 50)"),
      offset: z.number().int().min(0).optional().describe("Pagination offset"),
    },
  }),
];
