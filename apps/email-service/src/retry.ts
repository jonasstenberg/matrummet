import { MAX_RETRIES } from "./constants.js";

export type RetryResult = {
  shouldRetry: boolean;
  newStatus: "queued" | "failed";
  retryCount: number;
  nextRetryAt: Date | null;
};

type DelayStrategy = 'fixed' | 'exponential';

/**
 * Calculate retry parameters with configurable delay strategy
 */
export const calculateRetry = (
  currentRetryCount: number | null,
  strategy: DelayStrategy = 'fixed',
  baseDelayMs: number = 5 * 60000
): RetryResult => {
  const retries = (currentRetryCount ?? 0) + 1;
  const shouldRetry = retries <= MAX_RETRIES;
  const delayMs = strategy === 'exponential'
    ? Math.pow(2, retries) * 60000
    : baseDelayMs;

  return {
    shouldRetry,
    newStatus: shouldRetry ? "queued" : "failed",
    retryCount: retries,
    nextRetryAt: shouldRetry ? new Date(Date.now() + delayMs) : null,
  };
};

/**
 * Calculate retry parameters for transactional emails
 * Uses fixed 5-minute delay
 */
export const calculateTransactionalRetry = (
  currentRetryCount: number | null
): RetryResult => calculateRetry(currentRetryCount, 'fixed');

/**
 * Calculate retry parameters for batch emails
 * Uses exponential backoff (2^retries minutes)
 */
export const calculateBatchRetry = (
  currentRetryCount: number | null
): RetryResult => calculateRetry(currentRetryCount, 'exponential');

/**
 * Calculate batch processing delay based on rate limit
 */
export const calculateBatchDelay = (
  emailRateLimit: number,
  batchSize: number
): number => {
  return (60000 * batchSize) / emailRateLimit;
};
