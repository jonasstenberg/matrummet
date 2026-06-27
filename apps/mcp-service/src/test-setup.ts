// Provide env so config.ts loads under vitest (node) before any test imports it.
process.env.POSTGREST_URL ??= "http://localhost:4444";
process.env.MCP_ISSUER_URL ??= "http://localhost:4071";
process.env.MCP_TOKEN_SECRET ??= "test-secret-test-secret-test-secret-0123456789";
process.env.MCP_ENCRYPTION_KEY ??= "0".repeat(64);
process.env.IMAGE_SERVICE_URL ??= "http://localhost:4446";
process.env.SQLITE_PATH ??= ":memory:";
