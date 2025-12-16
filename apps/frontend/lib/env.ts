import { z } from 'zod'

const envSchema = z.object({
  POSTGREST_URL: z.string().url('POSTGREST_URL must be a valid URL'),
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters long'),
  POSTGREST_JWT_SECRET: z
    .string()
    .min(32, 'POSTGREST_JWT_SECRET must be at least 32 characters long'),
})

function validateEnv() {
  const result = envSchema.safeParse({
    POSTGREST_URL: process.env.POSTGREST_URL,
    JWT_SECRET: process.env.JWT_SECRET,
    POSTGREST_JWT_SECRET: process.env.POSTGREST_JWT_SECRET,
  })

  if (!result.success) {
    const errors = result.error.issues
      .map((err) => `  - ${err.path.join('.')}: ${err.message}`)
      .join('\n')

    throw new Error(
      `Environment variable validation failed:\n${errors}\n\nPlease check your .env file and ensure all required variables are set correctly.`
    )
  }

  return result.data
}

export const env = validateEnv()
