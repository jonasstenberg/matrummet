import { pino } from "pino";

const isProduction = process.env.NODE_ENV === "production";

/**
 * Pino logger with redaction. This service handles plaintext passwords (login
 * bridge) and mints/holds tokens + API keys, so secrets must never reach the
 * log. `@matrummet/shared`'s createLogger does not expose a redact option, so
 * we build pino directly and mirror the same base/timestamp/level shape.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isProduction ? "info" : "debug"),
  base: { service: "mcp-service" },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label }),
  },
  redact: {
    paths: [
      "authorization",
      "cookie",
      "password",
      "login_password",
      "p_password",
      "code",
      "code_verifier",
      "refresh_token",
      "access_token",
      "api_key",
      "apiKey",
      "x-api-key",
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-api-key"]',
      "*.password",
      "*.api_key",
      "*.access_token",
      "*.refresh_token",
    ],
    // Note: pino only invokes censor for the keys listed in `paths` above; it does
    // not walk every value, so a secret logged under an unlisted key is NOT caught.
    // Keep secrets out of log payloads at the call site.
    censor: "[REDACTED]",
    remove: false,
  },
  ...(isProduction ? {} : { transport: { target: "pino-pretty" } }),
});
