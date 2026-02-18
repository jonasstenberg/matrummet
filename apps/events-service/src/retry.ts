import { MAX_RETRIES } from "./constants.js";

export type RetryResult = {
  shouldRetry: boolean;
  newStatus: "pending" | "failed";
  retryCount: number;
  nextRetryAt: Date | null;
};

/**
 * Calculate retry parameters using exponential backoff (2^retries minutes)
 */
export const calculateRetry = (
  currentRetryCount: number | null
): RetryResult => {
  const retries = (currentRetryCount ?? 0) + 1;
  const shouldRetry = retries <= MAX_RETRIES;
  const delayMs = Math.pow(2, retries) * 60000;

  return {
    shouldRetry,
    newStatus: shouldRetry ? "pending" : "failed",
    retryCount: retries,
    nextRetryAt: shouldRetry ? new Date(Date.now() + delayMs) : null,
  };
};
