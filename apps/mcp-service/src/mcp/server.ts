import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { PostgrestError } from "../api/postgrest.js";
import { logger } from "../logger.js";
import { capResult } from "./format.js";
import { allTools } from "./registry/index.js";

function formatError(err: unknown): string {
  if (err instanceof PostgrestError) {
    const parts = [err.message];
    if (err.hint) parts.push(`hint: ${err.hint}`);
    if (err.details) parts.push(`details: ${err.details}`);
    return parts.join(" — ");
  }
  if (err instanceof Error) return err.message;
  return String(err);
}


/**
 * Build a fresh McpServer with all tools registered. One server (and transport)
 * is created per request in the stateless transport model.
 */
export function buildMcpServer(): McpServer {
  const server = new McpServer({ name: "matrummet-mcp", version: "1.0.0" });

  for (const def of allTools) {
    server.registerTool(
      def.name,
      {
        title: def.title,
        description: def.description,
        inputSchema: def.inputSchema,
        annotations: def.annotations,
      },
      async (args: Record<string, unknown>, extra) => {
        const email =
          typeof extra.authInfo?.extra?.email === "string" ? extra.authInfo.extra.email : undefined;
        const role =
          typeof extra.authInfo?.extra?.role === "string" ? extra.authInfo.extra.role : "user";
        if (!email) {
          return { content: [{ type: "text", text: "Not authenticated." }], isError: true };
        }
        try {
          const data = await def.handler(args, { email, role });
          return { content: [{ type: "text", text: capResult(data) }] };
        } catch (err) {
          const message = formatError(err);
          logger.warn({ tool: def.name, err: message }, "tool call failed");
          return { content: [{ type: "text", text: message }], isError: true };
        }
      },
    );
  }

  return server;
}
