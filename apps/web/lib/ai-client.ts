import { Mistral } from "@mistralai/mistralai";
import { env } from "@/lib/env";

export const MISTRAL_MODEL = "mistral-medium-latest";

export function createMistralClient(): Mistral {
  const apiKey = env.MISTRAL_API_KEY;
  if (!apiKey) {
    throw new Error("MISTRAL_API_KEY is not configured");
  }
  return new Mistral({ apiKey });
}
