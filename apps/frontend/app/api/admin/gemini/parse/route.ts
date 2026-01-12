import { getSession } from "@/lib/auth";
import { env } from "@/lib/env";
import {
  buildSystemInstruction,
  validateParsedRecipe,
} from "@/lib/recipe-parser/prompt";
import { RECIPE_SCHEMA } from "@/lib/recipe-parser/types";
import {
  extractUrl,
  parseJsonLdFromHtml,
  parseJsonLdFromScripts,
  type JsonLdRecipe,
} from "@/lib/recipe-parser/json-ld";
import { GoogleGenAI, Part } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { chromium, Browser } from "playwright";

const GEMINI_MODEL = "gemini-2.5-flash";
const POSTGREST_URL = process.env.POSTGREST_URL || "http://localhost:4444";
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

/**
 * Browser singleton with proper lifecycle management.
 * Designed for long-running Node.js servers (e.g., VPS deployments).
 */
let browserInstance: Browser | null = null;
let browserPromise: Promise<Browser> | null = null;
let lastUsed = Date.now();
let idleTimeoutId: ReturnType<typeof setTimeout> | null = null;

const BROWSER_IDLE_TIMEOUT = 60000; // 1 minute - close browser after inactivity

function scheduleIdleCleanup(): void {
  // Clear any existing timeout
  if (idleTimeoutId) {
    clearTimeout(idleTimeoutId);
  }

  idleTimeoutId = setTimeout(async () => {
    const timeSinceLastUse = Date.now() - lastUsed;
    if (timeSinceLastUse >= BROWSER_IDLE_TIMEOUT && browserInstance) {
      try {
        await browserInstance.close();
      } catch {
        // Browser may already be closed or crashed, ignore
      } finally {
        browserInstance = null;
        browserPromise = null;
      }
    }
  }, BROWSER_IDLE_TIMEOUT);
}

async function getBrowser(): Promise<Browser> {
  // If already initializing, wait for that promise to resolve
  // This prevents race conditions where multiple concurrent requests
  // would each start their own browser instance
  if (browserPromise) {
    const browser = await browserPromise;
    lastUsed = Date.now();
    scheduleIdleCleanup();
    return browser;
  }

  // If existing instance is still valid and connected
  if (browserInstance) {
    try {
      // Check if browser is still connected/usable
      if (browserInstance.isConnected()) {
        lastUsed = Date.now();
        scheduleIdleCleanup();
        return browserInstance;
      }
    } catch {
      // Browser is in a bad state, clean up
      browserInstance = null;
    }
  }

  // Initialize with lock - store the promise to prevent concurrent launches
  browserPromise = chromium.launch({ headless: true });

  try {
    browserInstance = await browserPromise;
    lastUsed = Date.now();
    scheduleIdleCleanup();
    return browserInstance;
  } catch (error) {
    // Launch failed, clean up state so next request can retry
    browserPromise = null;
    browserInstance = null;
    throw error;
  } finally {
    // Clear the promise after resolution (success or failure handled above)
    // We keep browserInstance set on success for reuse
    browserPromise = null;
  }
}

/**
 * Use Playwright to render a JS-heavy page and extract JSON-LD.
 * Uses isolated browser contexts to prevent resource leaks.
 */
async function fetchWithPlaywright(url: string): Promise<JsonLdRecipe | null> {
  let browser: Browser;
  try {
    browser = await getBrowser();
  } catch (error) {
    console.error("Failed to get browser instance:", error);
    return null;
  }

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });

  try {
    const page = await context.newPage();

    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });

    // Wait a bit for any late-loading content
    await page.waitForTimeout(1000);

    // Extract JSON-LD from the rendered page
    const jsonLdScripts = await page.evaluate(() => {
      const scripts = document.querySelectorAll(
        'script[type="application/ld+json"]'
      );
      return Array.from(scripts).map((s) => s.textContent);
    });

    return parseJsonLdFromScripts(jsonLdScripts);
  } catch (error) {
    console.error("Playwright fetch failed for URL:", url, error);
    return null;
  } finally {
    // Always close context - this is guaranteed to run after context is created
    await context.close().catch((err) =>
      console.error("Failed to close browser context:", err)
    );
  }
}

/**
 * Fetch JSON-LD recipe data from a URL
 * Returns the structured recipe data if found, null otherwise
 */
async function fetchJsonLdFromUrl(url: string): Promise<JsonLdRecipe | null> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "sv-SE,sv;q=0.9,en;q=0.8",
    },
  });

  if (!response.ok) {
    return null;
  }

  const html = await response.text();
  return parseJsonLdFromHtml(html);
}

async function fetchCategories(): Promise<string[]> {
  try {
    const response = await fetch(
      `${POSTGREST_URL}/categories?select=name&order=name`
    );
    if (!response.ok) return [];
    const data = await response.json();
    return data.map((c: { name: string }) => c.name);
  } catch {
    return [];
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const contentType = request.headers.get("content-type") || "";
    let text: string | null = null;
    let imageData: { base64: string; mimeType: string } | null = null;

    // Handle FormData (with image) or JSON (text only)
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      text = formData.get("text") as string | null;
      const image = formData.get("image") as File | null;

      if (image) {
        // Validate image type
        if (!ALLOWED_IMAGE_TYPES.includes(image.type)) {
          return NextResponse.json(
            {
              error:
                "Ogiltig bildtyp. Tillåtna format: JPEG, PNG, WebP, GIF",
            },
            { status: 400 }
          );
        }

        // Validate image size
        if (image.size > MAX_IMAGE_SIZE) {
          return NextResponse.json(
            { error: "Bilden får vara max 10 MB" },
            { status: 400 }
          );
        }

        // Convert to base64
        const bytes = await image.arrayBuffer();
        const base64 = Buffer.from(bytes).toString("base64");
        imageData = { base64, mimeType: image.type };
      }
    } else {
      const body = await request.json();
      text = body.text;
    }

    // Normalize text input
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
        { error: "Gemini API not configured" },
        { status: 503 }
      );
    }

    // Fetch categories from database
    const categories = await fetchCategories();

    const ai = new GoogleGenAI({ apiKey: geminiApiKey });

    // Build content parts for multimodal input
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
      // Check if the input contains a URL - if so, fetch its content
      const { url, remainingText } = extractUrl(trimmedText);

      if (url) {
        const extraInstructions = remainingText
          ? `\n\nAnvändarens instruktioner: ${remainingText}`
          : "";

        // Try to fetch JSON-LD from the URL (lightweight first)
        let jsonLd = await fetchJsonLdFromUrl(url);

        // If no JSON-LD found, the page might be JS-rendered - try Playwright
        if (!jsonLd) {
          jsonLd = await fetchWithPlaywright(url);
        }

        if (jsonLd) {
          // We have structured data - ask Gemini to parse it and CREATE groups
          parts.push({
            text: `Analysera följande strukturerade receptdata (JSON-LD) och skapa ett komplett recept.

VIKTIGT - SKAPA GRUPPER:
JSON-LD-data innehåller ofta alla ingredienser och instruktioner i en platt lista, men receptet kan ha flera delar (t.ex. "Potatispuré", "Äppelsallad", "Brynt smör", "Sås").

Din uppgift:
1. Analysera ingredienserna och instruktionerna
2. Identifiera logiska grupper baserat på innehållet (t.ex. om det finns ingredienser för en sallad, skapa en "Sallad"-grupp)
3. Skapa separata ingredient_groups och instruction_groups för varje del av receptet
4. Om det bara är en enkel rätt utan tydliga delar, använd en tom grupp ("")

Ledtrådar för att identifiera grupper:
- Ingredienser som hör ihop (t.ex. äpple + selleri + majonnäs = sallad)
- Instruktioner som nämner specifika komponenter ("Gör äppelsalladen...")
- Vanliga tillbehör: puré, sås, sallad, topping, etc.
${extraInstructions}

RECEPTDATA (JSON-LD):
${JSON.stringify(jsonLd, null, 2)}`,
          });
        } else {
          // No JSON-LD found even with Playwright - fallback to just sending the URL
          parts.push({
            text: `Analysera receptet från denna URL: ${url}

VIKTIGT: Se till att extrahera ALLA delar av receptet och skapa lämpliga grupper för ingredienser och instruktioner.
Recept har ofta flera sektioner som t.ex. "Potatispuré", "Äppelsallad", "Brynt smör" - identifiera och gruppera dessa.${extraInstructions}`,
          });
        }
      } else {
        parts.push({
          text: `Analysera följande recepttext:\n\n${trimmedText}`,
        });
      }
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
      console.error("No content in Gemini response:", response);
      return NextResponse.json(
        { error: "No content generated by Gemini" },
        { status: 422 }
      );
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(generatedText);
    } catch (error) {
      console.error("JSON parse error:", error, "Response:", generatedText);
      return NextResponse.json(
        {
          error: "LLM returned invalid JSON",
          details: generatedText.substring(0, 200),
        },
        { status: 422 }
      );
    }

    try {
      const recipe = validateParsedRecipe(parsedJson);
      return NextResponse.json({ recipe });
    } catch (error) {
      console.error("Recipe validation error:", error);
      console.error("Raw LLM response:", JSON.stringify(parsedJson, null, 2));
      return NextResponse.json(
        {
          error: "LLM response failed validation",
          details: error instanceof Error ? error.message : "Unknown error",
          rawResponse: parsedJson,
        },
        { status: 422 }
      );
    }
  } catch (error) {
    console.error("Parse recipe error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
