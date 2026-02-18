import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { calculateRetry } from "../retry.js";

describe("calculateRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should increment retry count from 0", () => {
    const result = calculateRetry(0);
    expect(result.retryCount).toBe(1);
  });

  it("should increment retry count from null", () => {
    const result = calculateRetry(null);
    expect(result.retryCount).toBe(1);
  });

  it("should allow retry on first failure", () => {
    const result = calculateRetry(0);
    expect(result.shouldRetry).toBe(true);
    expect(result.newStatus).toBe("pending");
  });

  it("should allow retry up to MAX_RETRIES (5)", () => {
    const result = calculateRetry(4);
    expect(result.shouldRetry).toBe(true);
    expect(result.newStatus).toBe("pending");
  });

  it("should fail after max retries exceeded", () => {
    const result = calculateRetry(5);
    expect(result.shouldRetry).toBe(false);
    expect(result.newStatus).toBe("failed");
    expect(result.nextRetryAt).toBeNull();
  });

  it("should use exponential backoff - first retry is 2 minutes", () => {
    const result = calculateRetry(0);
    // retries = 1, delay = 2^1 * 60000 = 2 minutes
    expect(result.nextRetryAt).toEqual(new Date("2024-01-01T12:02:00Z"));
  });

  it("should use exponential backoff - second retry is 4 minutes", () => {
    const result = calculateRetry(1);
    // retries = 2, delay = 2^2 * 60000 = 4 minutes
    expect(result.nextRetryAt).toEqual(new Date("2024-01-01T12:04:00Z"));
  });

  it("should use exponential backoff - third retry is 8 minutes", () => {
    const result = calculateRetry(2);
    // retries = 3, delay = 2^3 * 60000 = 8 minutes
    expect(result.nextRetryAt).toEqual(new Date("2024-01-01T12:08:00Z"));
  });

  it("should use exponential backoff - fifth retry is 32 minutes", () => {
    const result = calculateRetry(4);
    // retries = 5, delay = 2^5 * 60000 = 32 minutes
    expect(result.nextRetryAt).toEqual(new Date("2024-01-01T12:32:00Z"));
  });
});
