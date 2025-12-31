import { getRequiredEnv, getOptionalEnv } from "@recept/shared";

// Re-export constants for backwards compatibility
export { MAX_RETRIES } from "./constants.js";

export const config = {
  db: {
    url: getRequiredEnv("DATABASE_URL"),
    schema: getOptionalEnv("DB_SCHEMA", "private"),
    role: getOptionalEnv("DB_ROLE", "recept"),
    channels: ["email_message_channel", "email_batch_channel"],
  },
  email: {
    from: getRequiredEnv("SMTP_FROM"),
    host: getRequiredEnv("SMTP_HOST"),
    port: Number(getRequiredEnv("SMTP_PORT")),
    secure: getOptionalEnv("SMTP_SECURE", "false") === "true",
  },
  app: {
    baseUrl: getOptionalEnv("APP_BASE_URL", "http://localhost:5173"),
  },
} as const;

export const EMAIL_RATE_LIMIT = Number(
  getOptionalEnv("EMAIL_RATE_LIMIT", "60")
);
export const EMAIL_BATCH_SIZE = Number(
  getOptionalEnv("EMAIL_BATCH_SIZE", "10")
);

export const smtpUser = getOptionalEnv("SMTP_USER", "");
export const smtpPass = getOptionalEnv("SMTP_PASS", "");
