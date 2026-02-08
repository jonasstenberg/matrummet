import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks -- vi.hoisted ensures these are available in vi.mock factories,
// which vitest hoists to the top of the file before any other code runs.
// ---------------------------------------------------------------------------

const { mockCookies, mockJwtVerify } = vi.hoisted(() => ({
  mockCookies: vi.fn(),
  mockJwtVerify: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: mockCookies,
}));

vi.mock("jose", () => ({
  jwtVerify: mockJwtVerify,
  // SignJWT is imported by auth.ts but not needed for getAuthFromRequest tests
  SignJWT: vi.fn().mockImplementation(() => ({
    setProtectedHeader: vi.fn().mockReturnThis(),
    setIssuedAt: vi.fn().mockReturnThis(),
    setExpirationTime: vi.fn().mockReturnThis(),
    sign: vi.fn().mockResolvedValue("mock-token"),
  })),
}));

vi.mock("@/lib/env", () => ({
  env: {
    POSTGREST_URL: "http://localhost:4444",
    JWT_SECRET: "a".repeat(32),
    POSTGREST_JWT_SECRET: "b".repeat(32),
  },
}));

// ---------------------------------------------------------------------------
// Import the real function under test (uses mocked dependencies)
// ---------------------------------------------------------------------------

import { getAuthFromRequest } from "@/lib/auth";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();

function createRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost:3000/api/upload", { headers });
}

/** Simulate cookies() returning a cookie store with an auth-token. */
function setCookieToken(token: string) {
  mockCookies.mockResolvedValue({
    get: (name: string) => (name === "auth-token" ? { value: token } : undefined),
  });
}

/** Simulate cookies() returning a cookie store with no auth-token. */
function setNoCookie() {
  mockCookies.mockResolvedValue({
    get: () => undefined,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getAuthFromRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = mockFetch;
  });

  // ---- 1. Valid cookie auth ------------------------------------------------

  it("returns the session from a valid cookie without calling PostgREST", async () => {
    const payload = { email: "user@example.com", name: "Test User" };

    setCookieToken("valid-jwt-token");
    mockJwtVerify.mockResolvedValue({
      payload: { email: payload.email, name: payload.name },
    });

    const request = createRequest();
    const result = await getAuthFromRequest(request);

    expect(result).toEqual(payload);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  // ---- 2. Valid x-api-key auth ---------------------------------------------

  it("returns user info from PostgREST when x-api-key is valid", async () => {
    setNoCookie();

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ email: "api@example.com", name: "API User" }),
    });

    const request = createRequest({ "x-api-key": "sk_test_valid" });
    const result = await getAuthFromRequest(request);

    expect(result).toEqual({ email: "api@example.com", name: "API User" });
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:4444/rpc/current_user_info",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "sk_test_valid",
        },
      },
    );
  });

  // ---- 3. Missing credentials (no cookie, no header) -----------------------

  it("returns null when there is no cookie and no x-api-key header", async () => {
    setNoCookie();

    const request = createRequest();
    const result = await getAuthFromRequest(request);

    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  // ---- 4. Invalid API key (PostgREST returns 403) --------------------------

  it("returns null when PostgREST responds with a non-ok status", async () => {
    setNoCookie();

    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
    });

    const request = createRequest({ "x-api-key": "sk_test_invalid" });
    const result = await getAuthFromRequest(request);

    expect(result).toBeNull();
  });

  // ---- 5. PostgREST returns invalid data (no email) ------------------------

  it("returns null when PostgREST response has no email field", async () => {
    setNoCookie();

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ name: "No Email User" }),
    });

    const request = createRequest({ "x-api-key": "sk_test_noemail" });
    const result = await getAuthFromRequest(request);

    expect(result).toBeNull();
  });

  // ---- 6. PostgREST network error (fetch throws) ---------------------------

  it("returns null when fetch throws a network error", async () => {
    setNoCookie();

    mockFetch.mockRejectedValue(new Error("Network error"));

    const request = createRequest({ "x-api-key": "sk_test_neterr" });
    const result = await getAuthFromRequest(request);

    expect(result).toBeNull();
  });

  // ---- 7. PostgREST user with no name (name is null) -----------------------

  it("returns an empty string name when PostgREST response has null name", async () => {
    setNoCookie();

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ email: "noname@example.com", name: null }),
    });

    const request = createRequest({ "x-api-key": "sk_test_noname" });
    const result = await getAuthFromRequest(request);

    expect(result).toEqual({ email: "noname@example.com", name: "" });
  });
});
