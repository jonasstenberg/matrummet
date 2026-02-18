import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchPendingEvents,
  markDispatched,
  markFailed,
  getPendingCount,
} from "../queue.js";

vi.mock("../config.js", () => ({
  EVENT_BATCH_SIZE: 10,
}));

vi.mock("../retry.js", () => ({
  calculateRetry: vi.fn((retryCount: number | null) => ({
    shouldRetry: (retryCount ?? 0) < 5,
    newStatus: (retryCount ?? 0) >= 5 ? "failed" : "pending",
    retryCount: (retryCount ?? 0) + 1,
    nextRetryAt: new Date("2024-01-01T00:02:00Z"),
  })),
}));

function createTestDbPool() {
  const query = vi.fn();
  return { query };
}

describe("queue", () => {
  let mockPool: ReturnType<typeof createTestDbPool>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPool = createTestDbPool();
  });

  describe("fetchPendingEvents", () => {
    it("should fetch and lock pending events", async () => {
      const events = [
        {
          id: "evt-1",
          event_type: "user.signup",
          payload: { user_id: "u-1" },
          status: "processing",
          error_message: null,
          retry_count: 0,
          next_retry_at: null,
          created_at: "2024-01-01T12:00:00Z",
          processed_at: null,
        },
      ];
      mockPool.query.mockResolvedValueOnce({ rows: events });

      const result = await fetchPendingEvents(mockPool, 5);

      expect(result).toEqual(events);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE events SET status = 'processing'"),
        [5]
      );
    });

    it("should use default batch size when not provided", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await fetchPendingEvents(mockPool);

      expect(mockPool.query).toHaveBeenCalledWith(expect.any(String), [10]);
    });
  });

  describe("markDispatched", () => {
    it("should update event status to dispatched", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await markDispatched(mockPool, "evt-1");

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("status = 'dispatched'"),
        ["evt-1"]
      );
    });
  });

  describe("markFailed", () => {
    it("should update event with retry info", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await markFailed(mockPool, "evt-1", "Webhook error", 1);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE events SET status"),
        ["evt-1", "pending", "Webhook error", 2, expect.any(Date)]
      );
    });
  });

  describe("getPendingCount", () => {
    it("should return pending event count", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ count: "5" }],
      });

      const result = await getPendingCount(mockPool);

      expect(result).toBe(5);
    });

    it("should return 0 when no pending events", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ count: "0" }],
      });

      const result = await getPendingCount(mockPool);

      expect(result).toBe(0);
    });
  });
});
