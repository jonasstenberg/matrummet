import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendMatrixMessage, isMatrixConfigured } from "../matrix.js";

describe("sendMatrixMessage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should PUT message to Matrix room endpoint", async () => {
    const mockFetch = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ event_id: "$test" }), { status: 200 })
    );

    await sendMatrixMessage(
      {
        homeserverUrl: "https://matrix.test",
        accessToken: "token-123",
        roomId: "!room:matrix.test",
      },
      "Hello world"
    );

    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("https://matrix.test/_matrix/client/v3/rooms/");
    expect(url).toContain("/send/m.room.message/");
    expect(options.method).toBe("PUT");
    expect((options.headers as Record<string, string>)["Authorization"]).toBe(
      "Bearer token-123"
    );
    expect(options.body).toBe(
      JSON.stringify({ msgtype: "m.text", body: "Hello world" })
    );
  });

  it("should throw on non-OK response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Forbidden", { status: 403 })
    );

    await expect(
      sendMatrixMessage(
        {
          homeserverUrl: "https://matrix.test",
          accessToken: "bad-token",
          roomId: "!room:matrix.test",
        },
        "Hello"
      )
    ).rejects.toThrow("Matrix API error 403: Forbidden");
  });

  it("should propagate network errors", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new Error("Network error")
    );

    await expect(
      sendMatrixMessage(
        {
          homeserverUrl: "https://matrix.test",
          accessToken: "token",
          roomId: "!room:matrix.test",
        },
        "Hello"
      )
    ).rejects.toThrow("Network error");
  });
});

describe("isMatrixConfigured", () => {
  it("should return true when all fields are set", () => {
    expect(
      isMatrixConfigured({
        homeserverUrl: "https://matrix.test",
        accessToken: "token",
        roomId: "!room:matrix.test",
      })
    ).toBe(true);
  });

  it("should return false when homeserverUrl is empty", () => {
    expect(
      isMatrixConfigured({ homeserverUrl: "", accessToken: "token", roomId: "!room:matrix.test" })
    ).toBe(false);
  });

  it("should return false when accessToken is empty", () => {
    expect(
      isMatrixConfigured({ homeserverUrl: "https://matrix.test", accessToken: "", roomId: "!room:matrix.test" })
    ).toBe(false);
  });

  it("should return false when roomId is empty", () => {
    expect(
      isMatrixConfigured({ homeserverUrl: "https://matrix.test", accessToken: "token", roomId: "" })
    ).toBe(false);
  });
});
