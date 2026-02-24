import { Mistral } from "@mistralai/mistralai";
import { env } from "@/lib/env";

export const MISTRAL_MODEL = "mistral-medium-latest";

// Mistral medium pricing (USD per million tokens)
const PRICE_PER_M_INPUT = 0.4;
const PRICE_PER_M_OUTPUT = 2;

export function createMistralClient(): Mistral {
  const apiKey = env.MISTRAL_API_KEY;
  if (!apiKey) {
    throw new Error("MISTRAL_API_KEY is not configured");
  }
  return new Mistral({ apiKey });
}

/** Extract token counts and estimated cost from a Mistral chat response */
export function getUsageCost(usage: { promptTokens?: number; completionTokens?: number } | undefined | null) {
  if (!usage) return null;
  const promptTokens = usage.promptTokens ?? 0;
  const completionTokens = usage.completionTokens ?? 0;
  const costUsd =
    (promptTokens / 1_000_000) * PRICE_PER_M_INPUT +
    (completionTokens / 1_000_000) * PRICE_PER_M_OUTPUT;
  return {
    promptTokens,
    completionTokens,
    costUsd: Math.round(costUsd * 1_000_000) / 1_000_000,
  };
}
