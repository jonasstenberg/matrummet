import { getSession } from "@/lib/auth";
import { env } from "@/lib/env";
import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

const GEMINI_MODEL = "gemini-2.5-flash";

interface CurrentRecipe {
  recipe_name: string;
  description: string;
  ingredients: Array<{
    name: string;
    measurement: string;
    quantity: string;
    group_id?: string | null;
  }>;
  instructions: Array<{
    step: string;
    group_id?: string | null;
  }>;
  ingredientGroups: Array<{ id: string; name: string }>;
  instructionGroups: Array<{ id: string; name: string }>;
}

interface RefineRequest {
  currentRecipe: CurrentRecipe;
  refinementInstructions: string;
}

const REFINE_SCHEMA = {
  type: "object" as const,
  properties: {
    recipe_name: { type: "string" as const },
    description: { type: "string" as const },
    ingredients: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          name: { type: "string" as const },
          measurement: { type: "string" as const },
          quantity: { type: "string" as const },
          group_id: { type: "string" as const, nullable: true },
        },
        required: ["name", "measurement", "quantity"],
      },
    },
    instructions: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          step: { type: "string" as const },
          group_id: { type: "string" as const, nullable: true },
        },
        required: ["step"],
      },
    },
    ingredientGroups: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          id: { type: "string" as const },
          name: { type: "string" as const },
        },
        required: ["id", "name"],
      },
    },
    instructionGroups: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          id: { type: "string" as const },
          name: { type: "string" as const },
        },
        required: ["id", "name"],
      },
    },
  },
  required: ["recipe_name", "description", "ingredients", "instructions"],
};

interface ValidatedRefineResponse {
  recipe_name: string;
  description: string;
  ingredients: CurrentRecipe["ingredients"];
  instructions: CurrentRecipe["instructions"];
  ingredientGroups?: CurrentRecipe["ingredientGroups"];
  instructionGroups?: CurrentRecipe["instructionGroups"];
}

/**
 * Validates the Gemini response for recipe refinement.
 * Throws an error with a descriptive message if validation fails.
 */
function validateRefineResponse(data: unknown): ValidatedRefineResponse {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid response: Expected JSON object");
  }

  const response = data as Record<string, unknown>;

  // Validate required string fields
  if (!response.recipe_name || typeof response.recipe_name !== "string") {
    throw new Error("Missing or invalid field: recipe_name");
  }

  if (!response.description || typeof response.description !== "string") {
    throw new Error("Missing or invalid field: description");
  }

  // Validate ingredients array
  if (!Array.isArray(response.ingredients)) {
    throw new Error("Missing or invalid field: ingredients must be an array");
  }

  const validatedIngredients: CurrentRecipe["ingredients"] = [];
  for (let i = 0; i < response.ingredients.length; i++) {
    const ing = response.ingredients[i];
    if (!ing || typeof ing !== "object") {
      throw new Error(`Invalid ingredient at index ${i}: must be an object`);
    }
    const ingredient = ing as Record<string, unknown>;

    if (!ingredient.name || typeof ingredient.name !== "string") {
      throw new Error(`Invalid ingredient at index ${i}: missing or invalid name`);
    }
    if (typeof ingredient.measurement !== "string") {
      throw new Error(`Invalid ingredient at index ${i}: missing or invalid measurement`);
    }
    if (typeof ingredient.quantity !== "string") {
      throw new Error(`Invalid ingredient at index ${i}: missing or invalid quantity`);
    }

    validatedIngredients.push({
      name: ingredient.name,
      measurement: ingredient.measurement,
      quantity: ingredient.quantity,
      group_id: typeof ingredient.group_id === "string" ? ingredient.group_id : null,
    });
  }

  if (validatedIngredients.length === 0) {
    throw new Error("Recipe must have at least one ingredient");
  }

  // Validate instructions array
  if (!Array.isArray(response.instructions)) {
    throw new Error("Missing or invalid field: instructions must be an array");
  }

  const validatedInstructions: CurrentRecipe["instructions"] = [];
  for (let i = 0; i < response.instructions.length; i++) {
    const inst = response.instructions[i];
    if (!inst || typeof inst !== "object") {
      throw new Error(`Invalid instruction at index ${i}: must be an object`);
    }
    const instruction = inst as Record<string, unknown>;

    if (!instruction.step || typeof instruction.step !== "string") {
      throw new Error(`Invalid instruction at index ${i}: missing or invalid step`);
    }

    validatedInstructions.push({
      step: instruction.step,
      group_id: typeof instruction.group_id === "string" ? instruction.group_id : null,
    });
  }

  if (validatedInstructions.length === 0) {
    throw new Error("Recipe must have at least one instruction");
  }

  // Validate optional groups arrays
  let validatedIngredientGroups: CurrentRecipe["ingredientGroups"] | undefined;
  if (response.ingredientGroups !== undefined) {
    if (!Array.isArray(response.ingredientGroups)) {
      throw new Error("Invalid field: ingredientGroups must be an array");
    }
    validatedIngredientGroups = [];
    for (const group of response.ingredientGroups) {
      if (!group || typeof group !== "object") {
        throw new Error("Invalid ingredientGroup: must be an object");
      }
      const g = group as Record<string, unknown>;
      if (typeof g.id !== "string" || typeof g.name !== "string") {
        throw new Error("Invalid ingredientGroup: missing id or name");
      }
      validatedIngredientGroups.push({ id: g.id, name: g.name });
    }
  }

  let validatedInstructionGroups: CurrentRecipe["instructionGroups"] | undefined;
  if (response.instructionGroups !== undefined) {
    if (!Array.isArray(response.instructionGroups)) {
      throw new Error("Invalid field: instructionGroups must be an array");
    }
    validatedInstructionGroups = [];
    for (const group of response.instructionGroups) {
      if (!group || typeof group !== "object") {
        throw new Error("Invalid instructionGroup: must be an object");
      }
      const g = group as Record<string, unknown>;
      if (typeof g.id !== "string" || typeof g.name !== "string") {
        throw new Error("Invalid instructionGroup: missing id or name");
      }
      validatedInstructionGroups.push({ id: g.id, name: g.name });
    }
  }

  return {
    recipe_name: response.recipe_name,
    description: response.description,
    ingredients: validatedIngredients,
    instructions: validatedInstructions,
    ingredientGroups: validatedIngredientGroups,
    instructionGroups: validatedInstructionGroups,
  };
}

function buildRefinePrompt(currentRecipe: CurrentRecipe): string {
  // Build a readable version of the current recipe
  const ingredientsList = currentRecipe.ingredients
    .map((i) => `- ${i.quantity} ${i.measurement} ${i.name}`)
    .join("\n");

  const instructionsList = currentRecipe.instructions
    .map((i, idx) => `${idx + 1}. ${i.step}`)
    .join("\n");

  return `Du är en svensk receptexpert. Du har fått ett recept som ska förfinas baserat på användarens instruktioner.

NUVARANDE RECEPT:
Namn: ${currentRecipe.recipe_name}
Beskrivning: ${currentRecipe.description}

Ingredienser:
${ingredientsList}

Instruktioner:
${instructionsList}

VIKTIGT:
1. Gör ENDAST de ändringar som användaren begär
2. Behåll all annan information oförändrad
3. Om användaren vill lägga till/ta bort ingredienser, uppdatera ingredienslistan
4. Om användaren vill ändra instruktioner, uppdatera instruktionslistan
5. Behåll befintliga group_id:n för ingredienser och instruktioner som inte ändras
6. För nya ingredienser/instruktioner, använd null som group_id
7. Returnera HELA det uppdaterade receptet (inte bara ändringarna)

INGREDIENSNAMN:
Extrahera ENDAST det rena livsmedelsnamnet. Flytta ALL tillagningsinfo till instruktionerna.
Exempel: "lime, skal och saft" -> Ingrediens: "Lime", Instruktion: "Riv skalet och pressa saften."`;
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

    const body: RefineRequest = await request.json();

    if (!body.currentRecipe || !body.refinementInstructions) {
      return NextResponse.json(
        { error: "currentRecipe och refinementInstructions krävs" },
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

    const ai = new GoogleGenAI({ apiKey: geminiApiKey });

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Förfina receptet enligt följande instruktioner:\n\n${body.refinementInstructions}`,
            },
          ],
        },
      ],
      config: {
        systemInstruction: buildRefinePrompt(body.currentRecipe),
        responseMimeType: "application/json",
        responseSchema: REFINE_SCHEMA,
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
      const updates = validateRefineResponse(parsedJson);

      // Map to form data format
      return NextResponse.json({
        updates: {
          name: updates.recipe_name,
          description: updates.description,
          ingredients: updates.ingredients,
          instructions: updates.instructions,
          ingredientGroups:
            updates.ingredientGroups || body.currentRecipe.ingredientGroups,
          instructionGroups:
            updates.instructionGroups || body.currentRecipe.instructionGroups,
        },
      });
    } catch (error) {
      console.error("Refine validation error:", error);
      console.error("Raw LLM response:", JSON.stringify(parsedJson, null, 2));
      return NextResponse.json(
        {
          error: "LLM response failed validation",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 422 }
      );
    }
  } catch (error) {
    console.error("Refine recipe error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
