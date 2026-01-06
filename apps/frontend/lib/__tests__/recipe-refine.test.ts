import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// Mutable mock state
let mockGeminiApiKey: string | undefined = "test-api-key";

// Mock modules before importing the route handler
vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  env: {
    get GEMINI_API_KEY() {
      return mockGeminiApiKey;
    },
    POSTGREST_URL: "http://localhost:4444",
    JWT_SECRET: "a".repeat(32),
    POSTGREST_JWT_SECRET: "b".repeat(32),
  },
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn(),
}));

import { POST } from "@/app/api/admin/gemini/refine/route";
import { getSession } from "@/lib/auth";
import { GoogleGenAI } from "@google/genai";

const mockGetSession = vi.mocked(getSession);
const MockGoogleGenAI = vi.mocked(GoogleGenAI);

function createRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/admin/gemini/refine", {
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

describe("POST /api/admin/gemini/refine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("authentication and authorization", () => {
    it("returns 401 for unauthenticated requests", async () => {
      mockGetSession.mockResolvedValue(null);

      const request = createRequest(validRequest);
      const response = await POST(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe("Unauthorized");
    });

    it("returns 403 for non-admin users", async () => {
      mockGetSession.mockResolvedValue({
        email: "user@example.com",
        name: "Regular User",
        role: "user",
      });

      const request = createRequest(validRequest);
      const response = await POST(request);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe("Forbidden");
    });

    it("returns 403 for users without role", async () => {
      mockGetSession.mockResolvedValue({
        email: "user@example.com",
        name: "User Without Role",
      });

      const request = createRequest(validRequest);
      const response = await POST(request);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe("Forbidden");
    });
  });

  describe("request validation", () => {
    beforeEach(() => {
      mockGetSession.mockResolvedValue({
        email: "admin@example.com",
        name: "Admin User",
        role: "admin",
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
        email: "admin@example.com",
        name: "Admin User",
        role: "admin",
      });
    });

    it("returns 503 if GEMINI_API_KEY is not configured", async () => {
      // Override the mock to return undefined for GEMINI_API_KEY
      mockGeminiApiKey = undefined;

      const request = createRequest(validRequest);
      const response = await POST(request);

      expect(response.status).toBe(503);
      const data = await response.json();
      expect(data.error).toBe("Gemini API not configured");

      // Restore the mock
      mockGeminiApiKey = "test-api-key";
    });
  });

  describe("successful recipe refinement", () => {
    beforeEach(() => {
      mockGetSession.mockResolvedValue({
        email: "admin@example.com",
        name: "Admin User",
        role: "admin",
      });

      mockGeminiApiKey = "test-api-key";
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

      const mockGenerateContent = vi.fn().mockResolvedValue({
        text: JSON.stringify(refinedRecipe),
      });

      MockGoogleGenAI.mockImplementation(
        function () {
          return {
            models: {
              generateContent: mockGenerateContent,
            },
          } as unknown as InstanceType<typeof GoogleGenAI>;
        }
      );

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

      // Verify GoogleGenAI was called with correct parameters
      expect(MockGoogleGenAI).toHaveBeenCalledWith({ apiKey: "test-api-key" });
      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "gemini-2.5-flash",
          contents: expect.arrayContaining([
            expect.objectContaining({
              role: "user",
              parts: expect.arrayContaining([
                expect.objectContaining({
                  text: expect.stringContaining("Add more salt"),
                }),
              ]),
            }),
          ]),
          config: expect.objectContaining({
            responseMimeType: "application/json",
          }),
        })
      );
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

      const mockGenerateContent = vi.fn().mockResolvedValue({
        text: JSON.stringify(refinedRecipeWithoutGroups),
      });

      MockGoogleGenAI.mockImplementation(
        function () {
          return {
            models: {
              generateContent: mockGenerateContent,
            },
          } as unknown as InstanceType<typeof GoogleGenAI>;
        }
      );

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

      const mockGenerateContent = vi.fn().mockResolvedValue({
        text: JSON.stringify(refinedRecipeWithGroups),
      });

      MockGoogleGenAI.mockImplementation(
        function () {
          return {
            models: {
              generateContent: mockGenerateContent,
            },
          } as unknown as InstanceType<typeof GoogleGenAI>;
        }
      );

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
        email: "admin@example.com",
        name: "Admin User",
        role: "admin",
      });

      mockGeminiApiKey = "test-api-key";
      console.error = vi.fn(); // Suppress console.error during error tests
    });

    afterEach(() => {
      console.error = originalConsoleError; // Restore
    });

    it("returns 422 when Gemini returns no content", async () => {
      const mockGenerateContent = vi.fn().mockResolvedValue({
        text: null,
      });

      MockGoogleGenAI.mockImplementation(
        function () {
          return {
            models: {
              generateContent: mockGenerateContent,
            },
          } as unknown as InstanceType<typeof GoogleGenAI>;
        }
      );

      const request = createRequest(validRequest);
      const response = await POST(request);

      expect(response.status).toBe(422);
      const data = await response.json();
      expect(data.error).toBe("No content generated by Gemini");
    });

    it("returns 422 when Gemini returns empty string", async () => {
      const mockGenerateContent = vi.fn().mockResolvedValue({
        text: "",
      });

      MockGoogleGenAI.mockImplementation(
        function () {
          return {
            models: {
              generateContent: mockGenerateContent,
            },
          } as unknown as InstanceType<typeof GoogleGenAI>;
        }
      );

      const request = createRequest(validRequest);
      const response = await POST(request);

      expect(response.status).toBe(422);
      const data = await response.json();
      expect(data.error).toBe("No content generated by Gemini");
    });

    it("returns 422 when Gemini returns invalid JSON", async () => {
      const mockGenerateContent = vi.fn().mockResolvedValue({
        text: "This is not valid JSON {{{",
      });

      MockGoogleGenAI.mockImplementation(
        function () {
          return {
            models: {
              generateContent: mockGenerateContent,
            },
          } as unknown as InstanceType<typeof GoogleGenAI>;
        }
      );

      const request = createRequest(validRequest);
      const response = await POST(request);

      expect(response.status).toBe(422);
      const data = await response.json();
      expect(data.error).toBe("LLM returned invalid JSON");
      expect(data.details).toBeDefined();
    });

    it("returns 500 on unexpected errors", async () => {
      MockGoogleGenAI.mockImplementation(function () {
        throw new Error("Unexpected API error");
      });

      const request = createRequest(validRequest);
      const response = await POST(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe("Internal server error");
    });

    it("returns 500 when Gemini API call throws", async () => {
      const mockGenerateContent = vi
        .fn()
        .mockRejectedValue(new Error("API rate limit exceeded"));

      MockGoogleGenAI.mockImplementation(
        function () {
          return {
            models: {
              generateContent: mockGenerateContent,
            },
          } as unknown as InstanceType<typeof GoogleGenAI>;
        }
      );

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
        email: "admin@example.com",
        name: "Admin User",
        role: "admin",
      });

      mockGeminiApiKey = "test-api-key";
    });

    it("includes recipe details in the system instruction", async () => {
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

      const mockGenerateContent = vi.fn().mockResolvedValue({
        text: JSON.stringify(recipeWithDetails),
      });

      MockGoogleGenAI.mockImplementation(
        function () {
          return {
            models: {
              generateContent: mockGenerateContent,
            },
          } as unknown as InstanceType<typeof GoogleGenAI>;
        }
      );

      const request = createRequest({
        currentRecipe: recipeWithDetails,
        refinementInstructions: "Gor dem glutenfria",
      });
      await POST(request);

      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            systemInstruction: expect.stringContaining("Pannkakor"),
          }),
        })
      );

      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            systemInstruction: expect.stringContaining(
              "Klassiska svenska pannkakor"
            ),
          }),
        })
      );

      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            systemInstruction: expect.stringContaining("3 dl Mjol"),
          }),
        })
      );
    });

    it("includes refinement instructions in user message", async () => {
      const mockGenerateContent = vi.fn().mockResolvedValue({
        text: JSON.stringify(validRecipe),
      });

      MockGoogleGenAI.mockImplementation(
        function () {
          return {
            models: {
              generateContent: mockGenerateContent,
            },
          } as unknown as InstanceType<typeof GoogleGenAI>;
        }
      );

      const request = createRequest({
        currentRecipe: validRecipe,
        refinementInstructions: "Dubbla alla ingredienser",
      });
      await POST(request);

      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          contents: expect.arrayContaining([
            expect.objectContaining({
              role: "user",
              parts: expect.arrayContaining([
                expect.objectContaining({
                  text: expect.stringContaining("Dubbla alla ingredienser"),
                }),
              ]),
            }),
          ]),
        })
      );
    });
  });
});
