import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

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
    GEMINI_API_KEY: "test-gemini-key",
  },
}));

const mockGenerateContent = vi.fn();

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent: mockGenerateContent };
  },
}));

vi.mock("@/lib/recipe-parser/prompt", () => ({
  buildSystemInstruction: vi.fn().mockReturnValue("system prompt"),
  validateParsedRecipe: vi.fn().mockImplementation((data) => data),
}));

vi.mock("@/lib/recipe-parser/types", () => ({
  RECIPE_SCHEMA: {},
}));

// ---------------------------------------------------------------------------
// Import the route handler under test
// ---------------------------------------------------------------------------

import { POST } from "./route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();

function jsonRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3000/api/ai/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/ai/generate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = mockFetch;
    mockSignPostgrestToken.mockResolvedValue("mock-postgrest-token");
  });

  it("returns 401 when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);

    const response = await POST(jsonRequest({ text: "pannkakor" }));
    expect(response.status).toBe(401);
  });

  it("returns 400 when no text or image provided", async () => {
    mockGetSession.mockResolvedValue({ email: "user@test.com", name: "Test" });

    const response = await POST(jsonRequest({ text: "" }));
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toContain("Text eller bild krävs");
  });

  it("returns 402 with INSUFFICIENT_CREDITS when user has no credits", async () => {
    mockGetSession.mockResolvedValue({ email: "user@test.com", name: "Test" });

    // Categories fetch succeeds
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/rpc/deduct_credit")) {
        return Promise.resolve({ ok: false, status: 400 });
      }
      if (url.includes("/categories")) {
        return Promise.resolve({
          ok: true,
          json: async () => [{ name: "Huvudrätt" }],
        });
      }
      return Promise.resolve({ ok: false });
    });

    const response = await POST(jsonRequest({ text: "pannkakor" }));
    expect(response.status).toBe(402);

    const data = await response.json();
    expect(data.code).toBe("INSUFFICIENT_CREDITS");
  });

  it("deducts credit before calling Gemini and returns recipe with remaining credits", async () => {
    mockGetSession.mockResolvedValue({ email: "user@test.com", name: "Test" });

    const callOrder: string[] = [];

    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/rpc/deduct_credit")) {
        callOrder.push("deduct_credit");
        return Promise.resolve({ ok: true, json: async () => 9 });
      }
      if (url.includes("/categories")) {
        return Promise.resolve({
          ok: true,
          json: async () => [{ name: "Huvudrätt" }],
        });
      }
      return Promise.resolve({ ok: false });
    });

    const mockRecipe = {
      recipe_name: "Pannkakor",
      description: "Klassiska svenska pannkakor",
      ingredient_groups: [
        {
          group_name: "",
          ingredients: [
            { name: "Vetemjöl", measurement: "dl", quantity: "3" },
          ],
        },
      ],
      instruction_groups: [
        {
          group_name: "",
          instructions: [{ step: "Blanda allt." }],
        },
      ],
    };

    mockGenerateContent.mockImplementation(() => {
      callOrder.push("gemini");
      return { text: JSON.stringify(mockRecipe) };
    });

    const response = await POST(jsonRequest({ text: "pannkakor" }));
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.recipe.recipe_name).toBe("Pannkakor");
    expect(data.remainingCredits).toBe(9);

    // Verify credit was deducted BEFORE Gemini was called
    expect(callOrder).toEqual(["deduct_credit", "gemini"]);
  });

  it("deducts credit with description containing the user prompt", async () => {
    mockGetSession.mockResolvedValue({ email: "user@test.com", name: "Test" });

    let deductBody: Record<string, unknown> | null = null;

    mockFetch.mockImplementation((url: string, opts?: RequestInit) => {
      if (url.includes("/rpc/deduct_credit")) {
        deductBody = JSON.parse(opts?.body as string);
        return Promise.resolve({ ok: true, json: async () => 5 });
      }
      if (url.includes("/categories")) {
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      return Promise.resolve({ ok: false });
    });

    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        recipe_name: "Test",
        description: "Test",
        ingredient_groups: [
          { group_name: "", ingredients: [{ name: "Salt", measurement: "tsk", quantity: "1" }] },
        ],
        instruction_groups: [
          { group_name: "", instructions: [{ step: "Blanda." }] },
        ],
      }),
    });

    await POST(jsonRequest({ text: "Gör ett recept på lax med dill" }));

    expect(deductBody).toEqual({
      p_description: "AI: Gör ett recept på lax med dill",
    });
  });

  it("returns 422 when Gemini returns invalid JSON", async () => {
    mockGetSession.mockResolvedValue({ email: "user@test.com", name: "Test" });

    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/rpc/deduct_credit")) {
        return Promise.resolve({ ok: true, json: async () => 9 });
      }
      if (url.includes("/categories")) {
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      return Promise.resolve({ ok: false });
    });

    mockGenerateContent.mockResolvedValue({ text: "not valid json {{{" });

    const response = await POST(jsonRequest({ text: "pannkakor" }));
    expect(response.status).toBe(422);
  });

  it("returns 422 when Gemini returns no text", async () => {
    mockGetSession.mockResolvedValue({ email: "user@test.com", name: "Test" });

    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/rpc/deduct_credit")) {
        return Promise.resolve({ ok: true, json: async () => 9 });
      }
      if (url.includes("/categories")) {
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      return Promise.resolve({ ok: false });
    });

    mockGenerateContent.mockResolvedValue({ text: null });

    const response = await POST(jsonRequest({ text: "pannkakor" }));
    expect(response.status).toBe(422);

    const data = await response.json();
    expect(data.error).toContain("Inget svar från AI");
  });
});
