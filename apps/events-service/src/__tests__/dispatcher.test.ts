import { describe, it, expect, vi, beforeEach } from "vitest";
import { dispatchEvent } from "../dispatcher.js";
import type { EventRow } from "../types.js";

vi.mock("../config.js", () => ({
  config: {
    matrix: {
      homeserverUrl: "https://matrix.test",
      accessToken: "test-token",
      roomId: "!room:matrix.test",
    },
  },
}));

vi.mock("../matrix.js", () => ({
  isMatrixConfigured: vi.fn(() => true),
  sendMatrixMessage: vi.fn(),
}));

import { sendMatrixMessage } from "../matrix.js";

function createTestEvent(overrides: Partial<EventRow> = {}): EventRow {
  return {
    id: "evt-1",
    event_type: "user.signup",
    payload: {
      user_id: "u-1",
      email: "test@example.com",
      name: "Test User",
      provider: null,
    },
    status: "processing",
    error_message: null,
    retry_count: 0,
    next_retry_at: null,
    created_at: "2024-01-01T12:00:00Z",
    processed_at: null,
    ...overrides,
  };
}

describe("dispatchEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should send Matrix message for user.signup event", async () => {
    await dispatchEvent(createTestEvent());

    expect(sendMatrixMessage).toHaveBeenCalledWith(
      expect.objectContaining({ homeserverUrl: "https://matrix.test" }),
      "New signup: Test User <test@example.com>"
    );
  });

  it("should include provider in message when present", async () => {
    await dispatchEvent(
      createTestEvent({ payload: { name: "Test", email: "t@t.com", provider: "google" } })
    );

    expect(sendMatrixMessage).toHaveBeenCalledWith(
      expect.any(Object),
      "New signup: Test <t@t.com> (google)"
    );
  });

  it("should handle missing name/email gracefully", async () => {
    await dispatchEvent(createTestEvent({ payload: {} }));

    expect(sendMatrixMessage).toHaveBeenCalledWith(
      expect.any(Object),
      "New signup: Unknown <?>"
    );
  });

  it("should send Matrix message for user.deleted event", async () => {
    await dispatchEvent(
      createTestEvent({
        event_type: "user.deleted",
        payload: { user_id: "u-1", email: "gone@example.com", name: "Gone User" },
      })
    );

    expect(sendMatrixMessage).toHaveBeenCalledWith(
      expect.any(Object),
      "Account deleted: Gone User <gone@example.com>"
    );
  });

  it("should send Matrix message for credits.purchased event", async () => {
    await dispatchEvent(
      createTestEvent({
        event_type: "credits.purchased",
        payload: { user_email: "buyer@example.com", amount: 10, balance_after: 15 },
      })
    );

    expect(sendMatrixMessage).toHaveBeenCalledWith(
      expect.any(Object),
      "Credits purchased: buyer@example.com bought 10 credits (balance: 15)"
    );
  });

  it("should do nothing for unknown event types", async () => {
    await dispatchEvent(createTestEvent({ event_type: "unknown.event" }));

    expect(sendMatrixMessage).not.toHaveBeenCalled();
  });

  it("should propagate errors from Matrix", async () => {
    vi.mocked(sendMatrixMessage).mockRejectedValueOnce(
      new Error("Matrix API error 403: Forbidden")
    );

    await expect(dispatchEvent(createTestEvent())).rejects.toThrow(
      "Matrix API error 403: Forbidden"
    );
  });
});
