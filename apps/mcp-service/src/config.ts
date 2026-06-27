function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Environment variable ${name} is required but not set`);
  }
  return value;
}

function getOptionalEnv(name: string, defaultValue: string): string {
  return process.env[name] ?? defaultValue;
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

const tokenSecret = getRequiredEnv("MCP_TOKEN_SECRET");
if (tokenSecret.length < 32) {
  throw new Error("MCP_TOKEN_SECRET must be at least 32 characters");
}

export const config = {
  /** PostgREST base URL. Anon RPCs (login, issue_api_key) + per-user x-api-key calls. */
  postgrestUrl: stripTrailingSlash(getRequiredEnv("POSTGREST_URL")),
  /** Image service base URL (POST <base>/upload). Empty disables the upload tool. */
  imageServiceUrl: stripTrailingSlash(getOptionalEnv("IMAGE_SERVICE_URL", "")),
  /** Public issuer/base URL of this service. OAuth issuer; token audience = <issuer>/mcp. */
  issuerUrl: stripTrailingSlash(getRequiredEnv("MCP_ISSUER_URL")),
  /** HS256 secret for the service's own access/refresh tokens. */
  tokenSecret,
  /** AES-256-GCM key (32 bytes, hex or base64) for encrypting stored user API keys. */
  encryptionKey: getRequiredEnv("MCP_ENCRYPTION_KEY"),
  /** SQLite store path. Prod: /opt/matrummet/data/mcp.sqlite */
  sqlitePath: getOptionalEnv("SQLITE_PATH", "data/mcp.sqlite"),
  port: Number.parseInt(getOptionalEnv("PORT", "4008"), 10),
  accessTokenSeconds: Number.parseInt(getOptionalEnv("MCP_ACCESS_TOKEN_TTL_SECONDS", "3600"), 10),
  refreshTokenTtlDays: Number.parseInt(getOptionalEnv("MCP_REFRESH_TOKEN_TTL_DAYS", "30"), 10),
  /** Hard cap on a single tool result's serialized size (chars) before it is
   *  truncated, so a list/search can't flood the agent's context. */
  maxResultChars: Number.parseInt(getOptionalEnv("MCP_MAX_RESULT_CHARS", "40000"), 10),
} as const;

/** OAuth resource indicator / token audience (RFC 8707). */
export const RESOURCE_URL = `${config.issuerUrl}/mcp`;

/**
 * Single scope advertised + issued. PostgREST RLS (keyed on the user's email
 * claim) is the real authorization boundary, so finer-grained OAuth scopes
 * would be cosmetic here.
 */
export const MCP_SCOPE = "api";
