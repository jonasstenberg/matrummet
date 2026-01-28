import { getSession, signPostgrestToken } from "@/lib/auth";
import { env } from "@/lib/env";
import {
  buildSystemInstruction,
  validateParsedRecipe,
} from "@/lib/recipe-parser/prompt";
import { RECIPE_SCHEMA } from "@/lib/recipe-parser/types";
import { GoogleGenAI, Part } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

const GEMINI_MODEL = "gemini-2.5-flash";
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

async function fetchCategories(): Promise<string[]> {
  try {
    const response = await fetch(
      `${env.POSTGREST_URL}/categories?select=name&order=name`
    );
    if (!response.ok) return [];
    const data = await response.json();
    return data.map((c: { name: string }) => c.name);
  } catch {
    return [];
  }
}

async function checkCredits(
  postgrestToken: string
): Promise<{ hasCredits: true; balance: number } | { hasCredits: false }> {
  const response = await fetch(`${env.POSTGREST_URL}/rpc/get_user_credits`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${postgrestToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    return { hasCredits: false };
  }

  const balance = await response.json();
  if (typeof balance !== "number" || balance < 1) {
    return { hasCredits: false };
  }
  return { hasCredits: true, balance };
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const contentType = request.headers.get("content-type") || "";
    let text: string | null = null;
    let imageData: { base64: string; mimeType: string } | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      text = formData.get("text") as string | null;
      const image = formData.get("image") as File | null;

      if (image) {
        if (!ALLOWED_IMAGE_TYPES.includes(image.type)) {
          return NextResponse.json(
            {
              error:
                "Ogiltig bildtyp. Tillåtna format: JPEG, PNG, WebP, GIF",
            },
            { status: 400 }
          );
        }

        if (image.size > MAX_IMAGE_SIZE) {
          return NextResponse.json(
            { error: "Bilden får vara max 10 MB" },
            { status: 400 }
          );
        }

        const bytes = await image.arrayBuffer();
        const base64 = Buffer.from(bytes).toString("base64");
        imageData = { base64, mimeType: image.type };
      }
    } else {
      const body = await request.json();
      text = body.text;
    }

    const trimmedText =
      text && typeof text === "string" ? text.trim() : null;
    const hasText = trimmedText !== null && trimmedText.length > 0;
    const hasImage = imageData !== null;

    if (!hasText && !hasImage) {
      return NextResponse.json(
        { error: "Text eller bild krävs" },
        { status: 400 }
      );
    }

    const geminiApiKey = env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return NextResponse.json(
        { error: "AI-generering är inte konfigurerat" },
        { status: 503 }
      );
    }

    // Check that user has credits (deduction happens when recipe is saved)
    const postgrestToken = await signPostgrestToken(session.email);
    const creditCheck = await checkCredits(postgrestToken);

    if (!creditCheck.hasCredits) {
      return NextResponse.json(
        {
          error:
            "Du har inga AI-genereringar kvar. Köp fler under Inställningar > Krediter.",
          code: "INSUFFICIENT_CREDITS",
        },
        { status: 402 }
      );
    }

    // Fetch categories
    const categories = await fetchCategories();

    const ai = new GoogleGenAI({ apiKey: geminiApiKey });

    // Build content parts
    const parts: Part[] = [];

    if (imageData) {
      parts.push({
        inlineData: {
          mimeType: imageData.mimeType,
          data: imageData.base64,
        },
      });

      if (trimmedText) {
        parts.push({
          text: `Analysera receptet i bilden. Använd även denna extra information: ${trimmedText}`,
        });
      } else {
        parts.push({
          text: "Analysera receptet i bilden och extrahera all information.",
        });
      }
    } else if (trimmedText) {
      parts.push({
        text: `Analysera följande recepttext:\n\n${trimmedText}`,
      });
    }

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: "user", parts }],
      config: {
        systemInstruction: buildSystemInstruction(categories, hasImage),
        responseMimeType: "application/json",
        responseSchema: RECIPE_SCHEMA,
      },
    });

    const generatedText = response.text;
    if (!generatedText) {
      return NextResponse.json(
        { error: "Inget svar från AI" },
        { status: 422 }
      );
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(generatedText);
    } catch {
      return NextResponse.json(
        { error: "AI returnerade ogiltigt svar" },
        { status: 422 }
      );
    }

    try {
      const recipe = validateParsedRecipe(parsedJson);
      return NextResponse.json({
        recipe,
        remainingCredits: creditCheck.balance,
      });
    } catch (error) {
      console.error("Recipe validation error:", error);
      return NextResponse.json(
        {
          error: "AI-svaret kunde inte valideras",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 422 }
      );
    }
  } catch (error) {
    console.error("AI generate error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
