import { env } from "@/lib/env";
import { signPostgrestToken } from "@/lib/auth";
import {
  buildSystemInstruction,
  validateParsedRecipe,
} from "@/lib/recipe-parser/prompt";
import { RECIPE_SCHEMA, ParsedRecipe } from "@/lib/recipe-parser/types";
import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

const GEMINI_MODEL = "gemini-2.5-flash";
const POSTGREST_URL = process.env.POSTGREST_URL || "http://localhost:4444";

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

interface FoodMatch {
  id: string;
  name: string;
  rank: number;
}

interface UnitMatch {
  id: string;
  name: string;
  plural: string;
  abbreviation: string;
  rank: number;
}

async function searchFood(query: string): Promise<FoodMatch | null> {
  if (!query || query.length < 2) return null;

  try {
    const response = await fetch(`${POSTGREST_URL}/rpc/search_foods`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ p_query: query, p_limit: 1 }),
    });

    if (!response.ok) return null;

    const results: FoodMatch[] = await response.json();
    return results.length > 0 && results[0].rank > 0.5 ? results[0] : null;
  } catch {
    return null;
  }
}

async function searchUnit(query: string): Promise<UnitMatch | null> {
  if (!query || query.length < 1) return null;

  try {
    const response = await fetch(`${POSTGREST_URL}/rpc/search_units`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ p_query: query, p_limit: 1 }),
    });

    if (!response.ok) return null;

    const results: UnitMatch[] = await response.json();
    return results.length > 0 && results[0].rank > 0.5 ? results[0] : null;
  } catch {
    return null;
  }
}

async function matchIngredientsToDatabase(
  ingredients: Array<{ name: string; measurement: string; quantity: string }>
): Promise<Array<{ name: string; measurement: string; quantity: string }>> {
  const matched = await Promise.all(
    ingredients.map(async (ing) => {
      const [foodMatch, unitMatch] = await Promise.all([
        searchFood(ing.name),
        searchUnit(ing.measurement),
      ]);

      return {
        name: foodMatch?.name || ing.name,
        measurement:
          unitMatch?.abbreviation || unitMatch?.name || ing.measurement,
        quantity: ing.quantity,
      };
    })
  );

  return matched;
}

/**
 * Flatten grouped ingredients from Gemini parser into flat array with group markers
 * for the PostgREST insert_recipe function
 */
function flattenIngredientGroups(
  recipe: ParsedRecipe
): Array<{ name: string; measurement: string; quantity: string } | { group: string }> {
  const result: Array<{ name: string; measurement: string; quantity: string } | { group: string }> = [];

  for (const group of recipe.ingredient_groups || []) {
    // Only add group marker if there's a non-empty group name
    if (group.group_name) {
      result.push({ group: group.group_name });
    }

    for (const ing of group.ingredients) {
      result.push({
        name: ing.name,
        measurement: ing.measurement,
        quantity: ing.quantity,
      });
    }
  }

  return result;
}

/**
 * Flatten grouped instructions from Gemini parser into flat array with group markers
 * for the PostgREST insert_recipe function
 */
function flattenInstructionGroups(
  recipe: ParsedRecipe
): Array<{ step: string } | { group: string }> {
  const result: Array<{ step: string } | { group: string }> = [];

  for (const group of recipe.instruction_groups || []) {
    // Only add group marker if there's a non-empty group name
    if (group.group_name) {
      result.push({ group: group.group_name });
    }

    for (const inst of group.instructions) {
      result.push({ step: inst.step });
    }
  }

  return result;
}

export async function POST(request: NextRequest) {
  try {
    // Validate API key
    const apiKey = request.headers.get("x-api-key");
    const expectedApiKey = env.RECIPE_IMPORT_API_KEY;
    const importEmail = env.RECIPE_IMPORT_EMAIL;

    if (!expectedApiKey || !importEmail) {
      return NextResponse.json(
        { error: "Recipe import API not configured" },
        { status: 503 }
      );
    }

    if (!apiKey || apiKey !== expectedApiKey) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    }

    // Validate Gemini API is configured
    const geminiApiKey = env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return NextResponse.json(
        { error: "Gemini API not configured" },
        { status: 503 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { text } = body;

    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json(
        { error: "Text is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    // Fetch categories from database
    const categories = await fetchCategories();

    // Parse recipe with Gemini
    const ai = new GoogleGenAI({ apiKey: geminiApiKey });

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: `Analysera följande recepttext:\n\n${text.trim()}`,
      config: {
        systemInstruction: buildSystemInstruction(categories),
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

    let recipe: ParsedRecipe;
    try {
      recipe = validateParsedRecipe(parsedJson);
    } catch (error) {
      console.error("Recipe validation error:", error);
      console.error("Raw LLM response:", JSON.stringify(parsedJson, null, 2));
      return NextResponse.json(
        {
          error: "LLM response failed validation",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 422 }
      );
    }

    // Flatten grouped format to flat arrays for the database
    const flatIngredients = flattenIngredientGroups(recipe);
    const flatInstructions = flattenInstructionGroups(recipe);

    // Get only the actual ingredients (not group markers) for database matching
    const ingredientsOnly = flatIngredients.filter(
      (item): item is { name: string; measurement: string; quantity: string } =>
        "name" in item
    );

    // Match ingredients to database
    const matchedIngredients = await matchIngredientsToDatabase(ingredientsOnly);

    // Rebuild flat array with matched ingredients (preserving group markers)
    let matchedIndex = 0;
    const finalIngredients = flatIngredients.map((item) => {
      if ("group" in item) {
        return item;
      }
      return matchedIngredients[matchedIndex++];
    });

    // Create PostgREST token for the import email
    const token = await signPostgrestToken(importEmail);

    // Save the recipe
    const payload = {
      p_name: recipe.recipe_name,
      p_author: recipe.author || null,
      p_description: recipe.description,
      p_url: null,
      p_recipe_yield: recipe.recipe_yield || null,
      p_recipe_yield_name: recipe.recipe_yield_name || null,
      p_prep_time: recipe.prep_time || null,
      p_cook_time: recipe.cook_time || null,
      p_cuisine: recipe.cuisine || null,
      p_image: null,
      p_thumbnail: null,
      p_categories: recipe.categories || [],
      p_ingredients: finalIngredients,
      p_instructions: flatInstructions,
    };

    const saveResponse = await fetch(`${POSTGREST_URL}/rpc/insert_recipe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!saveResponse.ok) {
      const errorText = await saveResponse.text();
      console.error("Failed to save recipe:", errorText);
      return NextResponse.json(
        { error: "Failed to save recipe", details: errorText },
        { status: 500 }
      );
    }

    const recipeId = await saveResponse.json();

    return NextResponse.json({
      success: true,
      id: recipeId,
      recipe: {
        ...recipe,
        ingredients: finalIngredients,
        instructions: flatInstructions,
      },
    });
  } catch (error) {
    console.error("Recipe import error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
