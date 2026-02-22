import { createLogger, getOptionalEnv } from "@matrummet/shared";
import { config } from "./config.js";
import { startImageCleanupListener, stopImageCleanupListener } from "./listener.js";
import { handleHealth } from "./routes/health.js";
import { handleUpload } from "./routes/upload.js";
import { handleServeWithConditional } from "./routes/serve.js";
import { handleDelete } from "./routes/delete.js";

const logger = createLogger({ service: "image-service" });

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": getOptionalEnv("CORS_ORIGIN", "*"),
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

const server = Bun.serve({
  port: config.port,
  async fetch(request) {
    const url = new URL(request.url);
    const { pathname } = url;

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          ...CORS_HEADERS,
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // Route dispatch
    if (pathname === "/health" && request.method === "GET") {
      return handleHealth();
    }

    if (pathname === "/upload" && request.method === "POST") {
      const response = await handleUpload(request, logger);
      return addCorsHeaders(response);
    }

    // /images/:id or /images/:id/:size
    const imageMatch = pathname.match(/^\/images\/([^/]+)(?:\/([^/]+))?$/);
    if (imageMatch) {
      const [, imageId, size] = imageMatch;

      if (request.method === "GET") {
        return handleServeWithConditional(request, imageId, size);
      }

      if (request.method === "DELETE") {
        const response = await handleDelete(request, imageId, logger);
        return addCorsHeaders(response);
      }
    }

    return Response.json({ error: "Not found" }, { status: 404 });
  },
});

function addCorsHeaders(response: Response): Response {
  const newResponse = new Response(response.body, response);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    newResponse.headers.set(key, value);
  }
  return newResponse;
}

logger.info({ port: server.port }, "Image service started");

startImageCleanupListener(logger);

// Graceful shutdown
const shutdown = () => {
  logger.info("Shutting down");
  server.stop();
  void stopImageCleanupListener().finally(() => process.exit(0));
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
