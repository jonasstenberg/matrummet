import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  calculateTransactionalRetry,
  calculateBatchRetry,
  calculateBatchDelay,
} from "../retry.js";

describe("calculateTransactionalRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should increment retry count from 0", () => {
    const result = calculateTransactionalRetry(0);
    expect(result.retryCount).toBe(1);
  });

  it("should increment retry count from null", () => {
    const result = calculateTransactionalRetry(null);
    expect(result.retryCount).toBe(1);
  });

  it("should allow retry on first failure", () => {
    const result = calculateTransactionalRetry(0);
    expect(result.shouldRetry).toBe(true);
    expect(result.newStatus).toBe("queued");
  });

  it("should allow retry on second failure", () => {
    const result = calculateTransactionalRetry(1);
    expect(result.shouldRetry).toBe(true);
    expect(result.newStatus).toBe("queued");
  });

  it("should allow retry on third failure (MAX_RETRIES=3)", () => {
    const result = calculateTransactionalRetry(2);
    expect(result.shouldRetry).toBe(true);
    expect(result.newStatus).toBe("queued");
  });

  it("should fail after max retries exceeded", () => {
    const result = calculateTransactionalRetry(3);
    expect(result.shouldRetry).toBe(false);
    expect(result.newStatus).toBe("failed");
    expect(result.nextRetryAt).toBeNull();
  });

  it("should set retry time to 5 minutes in future", () => {
    const result = calculateTransactionalRetry(0);
    expect(result.nextRetryAt).toEqual(new Date("2024-01-01T12:05:00Z"));
  });
});

describe("calculateBatchRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should increment retry count from 0", () => {
    const result = calculateBatchRetry(0);
    expect(result.retryCount).toBe(1);
  });

  it("should increment retry count from null", () => {
    const result = calculateBatchRetry(null);
    expect(result.retryCount).toBe(1);
  });

  it("should allow retry on first failure", () => {
    const result = calculateBatchRetry(0);
    expect(result.shouldRetry).toBe(true);
    expect(result.newStatus).toBe("queued");
  });

  it("should fail after max retries exceeded", () => {
    const result = calculateBatchRetry(3);
    expect(result.shouldRetry).toBe(false);
    expect(result.newStatus).toBe("failed");
    expect(result.nextRetryAt).toBeNull();
  });

  it("should use exponential backoff - first retry is 2 minutes", () => {
    const result = calculateBatchRetry(0);
    // retries = 1, delay = 2^1 * 60000 = 2 minutes
    expect(result.nextRetryAt).toEqual(new Date("2024-01-01T12:02:00Z"));
  });

  it("should use exponential backoff - second retry is 4 minutes", () => {
    const result = calculateBatchRetry(1);
    // retries = 2, delay = 2^2 * 60000 = 4 minutes
    expect(result.nextRetryAt).toEqual(new Date("2024-01-01T12:04:00Z"));
  });

  it("should use exponential backoff - third retry is 8 minutes", () => {
    const result = calculateBatchRetry(2);
    // retries = 3, delay = 2^3 * 60000 = 8 minutes
    expect(result.nextRetryAt).toEqual(new Date("2024-01-01T12:08:00Z"));
  });
});

describe("calculateBatchDelay", () => {
  it("should calculate correct delay with default values", () => {
    // (60000 * 10) / 60 = 10000ms = 10 seconds
    const result = calculateBatchDelay(60, 10);
    expect(result).toBe(10000);
  });

  it("should calculate correct delay with higher rate limit", () => {
    // (60000 * 10) / 120 = 5000ms = 5 seconds
    const result = calculateBatchDelay(120, 10);
    expect(result).toBe(5000);
  });

  it("should calculate correct delay with larger batch size", () => {
    // (60000 * 20) / 60 = 20000ms = 20 seconds
    const result = calculateBatchDelay(60, 20);
    expect(result).toBe(20000);
  });

  it("should handle low rate limits", () => {
    // (60000 * 10) / 10 = 60000ms = 1 minute
    const result = calculateBatchDelay(10, 10);
    expect(result).toBe(60000);
  });
});
