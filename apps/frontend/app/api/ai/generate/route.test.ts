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
    MISTRAL_API_KEY: "test-mistral-key",
  },
}));

const mockChatComplete = vi.fn();
const mockOcrProcess = vi.fn();

vi.mock("@mistralai/mistralai", () => ({
  Mistral: class {
    chat = { complete: mockChatComplete };
    ocr = { process: mockOcrProcess };
  },
}));

vi.mock("@/lib/recipe-parser/prompt", () => ({
  buildSystemInstruction: vi.fn().mockReturnValue("system prompt"),
  validateParsedRecipe: vi.fn().mockImplementation((data) => data),
}));

vi.mock("@/lib/recipe-parser/types", () => ({
  RECIPE_JSON_SCHEMA: {},
}));

vi.mock("@/lib/ai-client", async () => {
  const { Mistral } = await import("@mistralai/mistralai");
  return {
    createMistralClient: () => new Mistral({ apiKey: "test" }),
    MISTRAL_MODEL: "mistral-medium-latest",
  };
});

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

    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/rpc/get_user_credits")) {
        return Promise.resolve({ ok: true, json: async () => 0 });
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

  it("checks credits before AI call, deducts after success, and returns remaining balance", async () => {
    mockGetSession.mockResolvedValue({ email: "user@test.com", name: "Test" });

    const callOrder: string[] = [];

    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/rpc/get_user_credits")) {
        callOrder.push("check_credits");
        return Promise.resolve({ ok: true, json: async () => 10 });
      }
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

    mockChatComplete.mockImplementation(() => {
      callOrder.push("mistral");
      return { choices: [{ message: { content: JSON.stringify(mockRecipe) } }] };
    });

    const response = await POST(jsonRequest({ text: "pannkakor" }));
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.recipe.recipe_name).toBe("Pannkakor");
    expect(data.remainingCredits).toBe(9);

    // Verify order: check credits → call Mistral → deduct credit
    expect(callOrder).toEqual(["check_credits", "mistral", "deduct_credit"]);
  });

  it("returns 422 when AI returns invalid JSON (no credit deducted)", async () => {
    mockGetSession.mockResolvedValue({ email: "user@test.com", name: "Test" });

    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/rpc/get_user_credits")) {
        return Promise.resolve({ ok: true, json: async () => 10 });
      }
      if (url.includes("/categories")) {
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      return Promise.resolve({ ok: false });
    });

    mockChatComplete.mockResolvedValue({
      choices: [{ message: { content: "not valid json {{{" } }],
    });

    const response = await POST(jsonRequest({ text: "pannkakor" }));
    expect(response.status).toBe(422);

    // Verify no credit was deducted
    const fetchCalls = mockFetch.mock.calls.map((call: unknown[]) => call[0] as string);
    expect(fetchCalls.some((url) => url.includes("/rpc/deduct_credit"))).toBe(false);
  });

  it("returns 422 when AI returns no text (no credit deducted)", async () => {
    mockGetSession.mockResolvedValue({ email: "user@test.com", name: "Test" });

    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/rpc/get_user_credits")) {
        return Promise.resolve({ ok: true, json: async () => 10 });
      }
      if (url.includes("/categories")) {
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      return Promise.resolve({ ok: false });
    });

    mockChatComplete.mockResolvedValue({
      choices: [{ message: { content: null } }],
    });

    const response = await POST(jsonRequest({ text: "pannkakor" }));
    expect(response.status).toBe(422);

    const data = await response.json();
    expect(data.error).toContain("Inget svar från AI");

    // Verify no credit was deducted
    const fetchCalls = mockFetch.mock.calls.map((call: unknown[]) => call[0] as string);
    expect(fetchCalls.some((url) => url.includes("/rpc/deduct_credit"))).toBe(false);
  });
});
