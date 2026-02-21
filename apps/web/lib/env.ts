import { z } from "zod";

const envSchema = z.object({
  POSTGREST_URL: z.string().url("POSTGREST_URL must be a valid URL"),
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 characters long"),
  POSTGREST_JWT_SECRET: z
    .string()
    .min(32, "POSTGREST_JWT_SECRET must be at least 32 characters long"),
  MISTRAL_API_KEY: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_SECRET: z.string().optional(),
  APP_URL: z.string().url().optional(),
  CRON_SECRET: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  IMAGE_SERVICE_URL: z.string().url().optional(),
});

type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

function getEnv(): Env {
  if (cachedEnv) return cachedEnv;

  const result = envSchema.safeParse({
    POSTGREST_URL: process.env.POSTGREST_URL,
    JWT_SECRET: process.env.JWT_SECRET,
    POSTGREST_JWT_SECRET: process.env.POSTGREST_JWT_SECRET,
    MISTRAL_API_KEY: process.env.MISTRAL_API_KEY,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_SECRET: process.env.GOOGLE_SECRET,
    APP_URL: process.env.APP_URL,
    CRON_SECRET: process.env.CRON_SECRET,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY,
    IMAGE_SERVICE_URL: process.env.IMAGE_SERVICE_URL,
  });

  if (!result.success) {
    const errors = result.error.issues
      .map((err) => `  - ${err.path.join(".")}: ${err.message}`)
      .join("\n");

    throw new Error(
      `Environment variable validation failed:\n${errors}\n\nPlease check your .env file and ensure all required variables are set correctly.`
    );
  }

  cachedEnv = result.data;
  return cachedEnv;
}

export const env = {
  get POSTGREST_URL() {
    return getEnv().POSTGREST_URL;
  },
  get JWT_SECRET() {
    return getEnv().JWT_SECRET;
  },
  get POSTGREST_JWT_SECRET() {
    return getEnv().POSTGREST_JWT_SECRET;
  },
  get MISTRAL_API_KEY() {
    return getEnv().MISTRAL_API_KEY;
  },
  get GOOGLE_CLIENT_ID() {
    return getEnv().GOOGLE_CLIENT_ID;
  },
  get GOOGLE_SECRET() {
    return getEnv().GOOGLE_SECRET;
  },
  get APP_URL() {
    return getEnv().APP_URL;
  },
  get CRON_SECRET() {
    return getEnv().CRON_SECRET;
  },
  get STRIPE_SECRET_KEY() {
    return getEnv().STRIPE_SECRET_KEY;
  },
  get STRIPE_WEBHOOK_SECRET() {
    return getEnv().STRIPE_WEBHOOK_SECRET;
  },
  get STRIPE_PUBLISHABLE_KEY() {
    return getEnv().STRIPE_PUBLISHABLE_KEY;
  },
  get IMAGE_SERVICE_URL() {
    return getEnv().IMAGE_SERVICE_URL;
  },
};
