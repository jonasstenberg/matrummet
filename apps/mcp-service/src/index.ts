import express, { type Request, type Response } from "express";

import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import {
  getOAuthProtectedResourceMetadataUrl,
  mcpAuthRouter,
} from "@modelcontextprotocol/sdk/server/auth/router.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { config, MCP_SCOPE, RESOURCE_URL } from "./config.js";
import { loginRouter } from "./auth/login.js";
import { oauthProvider } from "./auth/provider.js";
import { store } from "./auth/store.js";
import { logger } from "./logger.js";
import { buildMcpServer } from "./mcp/server.js";

const app = express();
app.disable("x-powered-by");

// OAuth 2.1 authorization server: /authorize, /token, /register (DCR), /revoke,
// and the RFC 8414 / RFC 9728 discovery metadata. Mounted at the app root.
app.use(
  mcpAuthRouter({
    provider: oauthProvider,
    issuerUrl: new URL(config.issuerUrl),
    resourceServerUrl: new URL(RESOURCE_URL),
    scopesSupported: [MCP_SCOPE],
    resourceName: "Matrummet",
  }),
);

// Interactive login/consent (the credential-handling half of authorize()).
app.use(loginRouter);

const bearer = requireBearerAuth({
  verifier: oauthProvider,
  resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(new URL(RESOURCE_URL)),
});

// base64 image uploads ride inside tool-call args, so allow a generous body.
const jsonBody = express.json({ limit: "30mb" });

async function runMcp(req: Request, res: Response): Promise<void> {
  const server = buildMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  res.on("close", () => {
    void transport.close();
    void server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
}

function handleMcp(req: Request, res: Response): void {
  runMcp(req, res).catch((err: unknown) => {
    logger.error({ err }, "MCP request failed");
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  });
}

app.post("/mcp", bearer, jsonBody, handleMcp);
// The stateless transport has no session, so a GET would open an idle SSE stream
// that never delivers anything and blocks graceful shutdown. Reject it per spec.
app.get("/mcp", bearer, (_req, res) => {
  res.status(405).set("Allow", "POST, DELETE").json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed; this server exposes no SSE stream." },
    id: null,
  });
});
app.delete("/mcp", bearer, handleMcp);

// Self-describing root so a browser/human visit isn't a bare 404. Clients still
// connect to /mcp; this just points the curious in the right direction.
app.get("/", (_req, res) => {
  res.json({
    service: "Matrummet MCP",
    description: "Model Context Protocol server for the Matrummet recipe API.",
    transport: "streamable-http",
    mcp_endpoint: RESOURCE_URL,
    authorization_server: `${config.issuerUrl}/.well-known/oauth-authorization-server`,
    protected_resource_metadata: `${config.issuerUrl}/.well-known/oauth-protected-resource/mcp`,
  });
});

app.get("/health", (_req, res) => {
  res.sendStatus(200);
});

const httpServer = app.listen(config.port, () => {
  logger.info(
    { port: config.port, issuer: config.issuerUrl, tools: "registered" },
    "MCP service started",
  );
});

const sweep = setInterval(() => {
  store.sweepExpired();
}, 10 * 60 * 1000);
sweep.unref();

let shuttingDown = false;
function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Shutting down");
  clearInterval(sweep);
  const finish = (): void => {
    try {
      store.close();
    } catch (err) {
      logger.error({ err }, "sqlite close error");
    }
    process.exit(0);
  };
  // These exist on Node's http.Server but may be absent under Bun, so treat them
  // as optional rather than relying on Node's always-present typing.
  const closable = httpServer as {
    closeIdleConnections?: () => void;
    closeAllConnections?: () => void;
  };
  closable.closeIdleConnections?.();
  httpServer.close(() => {
    logger.info("HTTP server closed");
    finish();
  });
  // Force-close lingering sockets so close() (and the WAL checkpoint) can run.
  setTimeout(() => closable.closeAllConnections?.(), 3_000).unref();
  // Hard deadline — still exit cleanly (checkpoint sqlite) rather than crash.
  setTimeout(finish, 10_000).unref();
}

process.on("SIGTERM", () => {
  shutdown("SIGTERM");
});
process.on("SIGINT", () => {
  shutdown("SIGINT");
});
