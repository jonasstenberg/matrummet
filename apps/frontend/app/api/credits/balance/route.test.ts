import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockGetSession, mockSignPostgrestToken } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockSignPostgrestToken: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getSession: mockGetSession,
  signPostgrestToken: mockSignPostgrestToken,
}));

vi.mock("@/lib/env", () => ({
  env: {
    POSTGREST_URL: "http://localhost:4444",
    JWT_SECRET: "a".repeat(32),
    POSTGREST_JWT_SECRET: "b".repeat(32),
  },
}));

import { GET } from "./route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/credits/balance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = mockFetch;
    mockSignPostgrestToken.mockResolvedValue("mock-token");
  });

  it("returns 401 when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);

    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("returns balance from PostgREST RPC", async () => {
    mockGetSession.mockResolvedValue({ email: "user@test.com", name: "Test" });

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => 7,
    });

    const response = await GET();
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.balance).toBe(7);
  });

  it("calls PostgREST with correct auth header", async () => {
    mockGetSession.mockResolvedValue({ email: "user@test.com", name: "Test" });
    mockSignPostgrestToken.mockResolvedValue("specific-token");

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => 10,
    });

    await GET();

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:4444/rpc/get_user_credits",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer specific-token",
        }),
      })
    );
  });

  it("returns 500 when PostgREST fails", async () => {
    mockGetSession.mockResolvedValue({ email: "user@test.com", name: "Test" });

    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
    });

    const response = await GET();
    expect(response.status).toBe(500);
  });
});
