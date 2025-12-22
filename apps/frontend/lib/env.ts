import { z } from "zod";

const envSchema = z.object({
  POSTGREST_URL: z.string().url("POSTGREST_URL must be a valid URL"),
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 characters long"),
  POSTGREST_JWT_SECRET: z
    .string()
    .min(32, "POSTGREST_JWT_SECRET must be at least 32 characters long"),
  OLLAMA_API_URL: z.string().url().optional(),
  OLLAMA_API_TOKEN: z.string().optional(),
});

type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

function getEnv(): Env {
  if (cachedEnv) return cachedEnv;

  const result = envSchema.safeParse({
    POSTGREST_URL: process.env.POSTGREST_URL,
    JWT_SECRET: process.env.JWT_SECRET,
    POSTGREST_JWT_SECRET: process.env.POSTGREST_JWT_SECRET,
    OLLAMA_API_URL: process.env.OLLAMA_API_URL,
    OLLAMA_API_TOKEN: process.env.OLLAMA_API_TOKEN,
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
  get OLLAMA_API_URL() {
    return getEnv().OLLAMA_API_URL;
  },
  get OLLAMA_API_TOKEN() {
    return getEnv().OLLAMA_API_TOKEN;
  },
};
