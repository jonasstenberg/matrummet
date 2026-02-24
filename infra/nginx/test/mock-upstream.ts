// @ts-nocheck — runs inside Docker only, not part of project build
// Mock upstream that echoes request details as JSON.
// Usage: bun mock-upstream.ts <name> <port>
const upstreamName = Bun.argv[2];
const listenPort = parseInt(Bun.argv[3], 10);

Bun.serve({
  port: listenPort,
  hostname: "127.0.0.1",
  fetch(req) {
    const url = new URL(req.url);
    return Response.json({
      upstream: upstreamName,
      port: listenPort,
      method: req.method,
      path: url.pathname + url.search,
      headers: Object.fromEntries(req.headers),
    });
  },
});
