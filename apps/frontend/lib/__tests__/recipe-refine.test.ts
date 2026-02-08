import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// Mutable mock state
let mockMistralApiKey: string | undefined = "test-api-key";

// Mock modules before importing the route handler
vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  env: {
    get MISTRAL_API_KEY() {
      return mockMistralApiKey;
    },
    POSTGREST_URL: "http://localhost:4444",
    JWT_SECRET: "a".repeat(32),
    POSTGREST_JWT_SECRET: "b".repeat(32),
  },
}));

vi.mock("@mistralai/mistralai", () => ({
  Mistral: vi.fn(),
}));

vi.mock("@/lib/ai-client", () => ({
  createMistralClient: vi.fn(),
  MISTRAL_MODEL: "mistral-medium-latest",
}));

import { POST } from "@/app/api/admin/ai/refine/route";
import { getSession } from "@/lib/auth";
import { createMistralClient } from "@/lib/ai-client";

const mockGetSession = vi.mocked(getSession);
const mockCreateMistralClient = vi.mocked(createMistralClient);

function createRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/admin/ai/refine", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
    },
  });
}

const validRecipe = {
  recipe_name: "Test Recipe",
  description: "A test description",
  ingredients: [
    { name: "Flour", measurement: "dl", quantity: "2", group_id: null },
  ],
  instructions: [{ step: "Mix everything", group_id: null }],
  ingredientGroups: [],
  instructionGroups: [],
};

const validRequest = {
  currentRecipe: validRecipe,
  refinementInstructions: "Add more salt",
};

describe("POST /api/admin/ai/refine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("authentication", () => {
    it("returns 401 for unauthenticated requests", async () => {
      mockGetSession.mockResolvedValue(null);

      const request = createRequest(validRequest);
      const response = await POST(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe("Unauthorized");
    });

    it("allows authenticated non-admin users", async () => {
      mockGetSession.mockResolvedValue({
        email: "user@example.com",
        name: "Regular User",
        role: "user",
      });

      mockCreateMistralClient.mockReturnValue({
        chat: {
          complete: vi.fn().mockResolvedValue({
            choices: [{ message: { content: JSON.stringify(validRecipe) } }],
          }),
        },
      } as never);

      const request = createRequest(validRequest);
      const response = await POST(request);

      // Should succeed (200) not be forbidden (403)
      expect(response.status).toBe(200);
    });
  });

  describe("request validation", () => {
    beforeEach(() => {
      mockGetSession.mockResolvedValue({
        email: "user@example.com",
        name: "Test User",
      });
    });

    it("returns 400 if currentRecipe is missing", async () => {
      const request = createRequest({
        refinementInstructions: "Add more salt",
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("currentRecipe och refinementInstructions krävs");
    });

    it("returns 400 if refinementInstructions is missing", async () => {
      const request = createRequest({
        currentRecipe: validRecipe,
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("currentRecipe och refinementInstructions krävs");
    });

    it("returns 400 if both currentRecipe and refinementInstructions are missing", async () => {
      const request = createRequest({});
      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("currentRecipe och refinementInstructions krävs");
    });

    it("returns 400 if refinementInstructions is empty string", async () => {
      const request = createRequest({
        currentRecipe: validRecipe,
        refinementInstructions: "",
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("currentRecipe och refinementInstructions krävs");
    });
  });

  describe("API key configuration", () => {
    beforeEach(() => {
      mockGetSession.mockResolvedValue({
        email: "user@example.com",
        name: "Test User",
      });
    });

    it("returns 503 if MISTRAL_API_KEY is not configured", async () => {
      mockMistralApiKey = undefined;

      const request = createRequest(validRequest);
      const response = await POST(request);

      expect(response.status).toBe(503);
      const data = await response.json();
      expect(data.error).toBe("AI API not configured");

      mockMistralApiKey = "test-api-key";
    });
  });

  describe("successful recipe refinement", () => {
    beforeEach(() => {
      mockGetSession.mockResolvedValue({
        email: "user@example.com",
        name: "Test User",
      });

      mockMistralApiKey = "test-api-key";
    });

    it("successfully refines a recipe", async () => {
      const refinedRecipe = {
        recipe_name: "Test Recipe with Salt",
        description: "A test description with added salt",
        ingredients: [
          { name: "Flour", measurement: "dl", quantity: "2", group_id: null },
          { name: "Salt", measurement: "tsk", quantity: "1", group_id: null },
        ],
        instructions: [
          { step: "Mix everything", group_id: null },
          { step: "Add salt to taste", group_id: null },
        ],
        ingredientGroups: [],
        instructionGroups: [],
      };

      mockCreateMistralClient.mockReturnValue({
        chat: {
          complete: vi.fn().mockResolvedValue({
            choices: [{ message: { content: JSON.stringify(refinedRecipe) } }],
          }),
        },
      } as never);

      const request = createRequest(validRequest);
      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.updates).toBeDefined();
      expect(data.updates.name).toBe("Test Recipe with Salt");
      expect(data.updates.description).toBe(
        "A test description with added salt"
      );
      expect(data.updates.ingredients).toHaveLength(2);
      expect(data.updates.instructions).toHaveLength(2);
    });

    it("preserves ingredient and instruction groups from original recipe when not in response", async () => {
      const requestWithGroups = {
        currentRecipe: {
          ...validRecipe,
          ingredientGroups: [{ id: "group1", name: "Degen" }],
          instructionGroups: [{ id: "group2", name: "Förberedelse" }],
        },
        refinementInstructions: "Add more salt",
      };

      const refinedRecipeWithoutGroups = {
        recipe_name: "Test Recipe",
        description: "A test description",
        ingredients: [
          { name: "Flour", measurement: "dl", quantity: "2", group_id: null },
        ],
        instructions: [{ step: "Mix everything", group_id: null }],
        // No ingredientGroups or instructionGroups in response
      };

      mockCreateMistralClient.mockReturnValue({
        chat: {
          complete: vi.fn().mockResolvedValue({
            choices: [{ message: { content: JSON.stringify(refinedRecipeWithoutGroups) } }],
          }),
        },
      } as never);

      const request = createRequest(requestWithGroups);
      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      // Should preserve original groups when not in response
      expect(data.updates.ingredientGroups).toEqual([
        { id: "group1", name: "Degen" },
      ]);
      expect(data.updates.instructionGroups).toEqual([
        { id: "group2", name: "Förberedelse" },
      ]);
    });

    it("uses groups from response when provided", async () => {
      const refinedRecipeWithGroups = {
        recipe_name: "Test Recipe",
        description: "A test description",
        ingredients: [
          { name: "Flour", measurement: "dl", quantity: "2", group_id: "new1" },
        ],
        instructions: [{ step: "Mix everything", group_id: "new2" }],
        ingredientGroups: [{ id: "new1", name: "New Group" }],
        instructionGroups: [{ id: "new2", name: "New Instructions" }],
      };

      mockCreateMistralClient.mockReturnValue({
        chat: {
          complete: vi.fn().mockResolvedValue({
            choices: [{ message: { content: JSON.stringify(refinedRecipeWithGroups) } }],
          }),
        },
      } as never);

      const request = createRequest(validRequest);
      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.updates.ingredientGroups).toEqual([
        { id: "new1", name: "New Group" },
      ]);
      expect(data.updates.instructionGroups).toEqual([
        { id: "new2", name: "New Instructions" },
      ]);
    });
  });

  describe("error handling", () => {
    const originalConsoleError = console.error;

    beforeEach(() => {
      mockGetSession.mockResolvedValue({
        email: "user@example.com",
        name: "Test User",
      });

      mockMistralApiKey = "test-api-key";
      console.error = vi.fn(); // Suppress console.error during error tests
    });

    afterEach(() => {
      console.error = originalConsoleError; // Restore
    });

    it("returns 422 when AI returns no content", async () => {
      mockCreateMistralClient.mockReturnValue({
        chat: {
          complete: vi.fn().mockResolvedValue({
            choices: [{ message: { content: null } }],
          }),
        },
      } as never);

      const request = createRequest(validRequest);
      const response = await POST(request);

      expect(response.status).toBe(422);
      const data = await response.json();
      expect(data.error).toBe("No content generated by AI");
    });

    it("returns 422 when AI returns empty string", async () => {
      mockCreateMistralClient.mockReturnValue({
        chat: {
          complete: vi.fn().mockResolvedValue({
            choices: [{ message: { content: "" } }],
          }),
        },
      } as never);

      const request = createRequest(validRequest);
      const response = await POST(request);

      expect(response.status).toBe(422);
      const data = await response.json();
      expect(data.error).toBe("No content generated by AI");
    });

    it("returns 422 when AI returns invalid JSON", async () => {
      mockCreateMistralClient.mockReturnValue({
        chat: {
          complete: vi.fn().mockResolvedValue({
            choices: [{ message: { content: "This is not valid JSON {{{" } }],
          }),
        },
      } as never);

      const request = createRequest(validRequest);
      const response = await POST(request);

      expect(response.status).toBe(422);
      const data = await response.json();
      expect(data.error).toBe("LLM returned invalid JSON");
      expect(data.details).toBeDefined();
    });

    it("returns 500 on unexpected errors", async () => {
      mockCreateMistralClient.mockImplementation(() => {
        throw new Error("Unexpected API error");
      });

      const request = createRequest(validRequest);
      const response = await POST(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("Internal server error");
    });

    it("returns 500 when AI API call throws", async () => {
      mockCreateMistralClient.mockReturnValue({
        chat: {
          complete: vi.fn().mockRejectedValue(new Error("API rate limit exceeded")),
        },
      } as never);

      const request = createRequest(validRequest);
      const response = await POST(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("Internal server error");
    });
  });

  describe("prompt construction", () => {
    beforeEach(() => {
      mockGetSession.mockResolvedValue({
        email: "user@example.com",
        name: "Test User",
      });

      mockMistralApiKey = "test-api-key";
    });

    it("includes recipe details in the system message", async () => {
      const recipeWithDetails = {
        recipe_name: "Pannkakor",
        description: "Klassiska svenska pannkakor",
        ingredients: [
          { name: "Mjol", measurement: "dl", quantity: "3", group_id: null },
          { name: "Mjolk", measurement: "dl", quantity: "6", group_id: null },
          { name: "Agg", measurement: "st", quantity: "3", group_id: null },
        ],
        instructions: [
          { step: "Blanda mjol och mjolk", group_id: null },
          { step: "Vispa i aggen", group_id: null },
        ],
        ingredientGroups: [],
        instructionGroups: [],
      };

      const mockComplete = vi.fn().mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(recipeWithDetails) } }],
      });

      mockCreateMistralClient.mockReturnValue({
        chat: { complete: mockComplete },
      } as never);

      const request = createRequest({
        currentRecipe: recipeWithDetails,
        refinementInstructions: "Gor dem glutenfria",
      });
      await POST(request);

      expect(mockComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: "system",
              content: expect.stringContaining("Pannkakor"),
            }),
          ]),
        })
      );

      expect(mockComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: "system",
              content: expect.stringContaining(
                "Klassiska svenska pannkakor"
              ),
            }),
          ]),
        })
      );

      expect(mockComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: "system",
              content: expect.stringContaining("3 dl Mjol"),
            }),
          ]),
        })
      );
    });

    it("includes refinement instructions in user message", async () => {
      const mockComplete = vi.fn().mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(validRecipe) } }],
      });

      mockCreateMistralClient.mockReturnValue({
        chat: { complete: mockComplete },
      } as never);

      const request = createRequest({
        currentRecipe: validRecipe,
        refinementInstructions: "Dubbla alla ingredienser",
      });
      await POST(request);

      expect(mockComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: "user",
              content: expect.stringContaining("Dubbla alla ingredienser"),
            }),
          ]),
        })
      );
    });
  });
});
