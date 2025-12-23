import { getSession } from "@/lib/auth"
import { env } from "@/lib/env"
import {
  RESTRUCTURE_SCHEMA,
  INSTRUCTIONS_SCHEMA,
  buildRestructureSystemInstruction,
  buildInstructionsSystemInstruction,
  formatIngredientsForPrompt,
  formatRecipeForInstructionsPrompt,
  validateRestructuredIngredients,
  validateImprovedInstructions,
  convertToUpdateFormat,
  convertInstructionsToUpdateFormat,
} from "@/lib/ingredient-restructure"
import type { Recipe } from "@/lib/types"
import { GoogleGenAI } from "@google/genai"
import { NextRequest, NextResponse } from "next/server"

const GEMINI_MODEL = "gemini-2.5-flash"
const POSTGREST_URL = process.env.POSTGREST_URL || "http://localhost:4444"

/**
 * POST /api/admin/restructure/preview
 * Generates a preview of how ingredients would be restructured and/or instructions improved using Gemini.
 *
 * Body:
 * - recipeId: The recipe ID to restructure
 * - instructions: Optional custom instructions for the AI
 * - includeIngredients: Whether to restructure ingredients (default: true)
 * - includeInstructions: Whether to improve/create instructions (default: false)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { recipeId, instructions, includeIngredients = true, includeInstructions = false } = body

    if (!recipeId || typeof recipeId !== "string") {
      return NextResponse.json(
        { error: "recipeId is required" },
        { status: 400 }
      )
    }

    if (!includeIngredients && !includeInstructions) {
      return NextResponse.json(
        { error: "At least one of includeIngredients or includeInstructions must be true" },
        { status: 400 }
      )
    }

    const customInstructions = typeof instructions === "string" ? instructions.trim() : ""

    // Fetch the recipe
    const recipeResponse = await fetch(
      `${POSTGREST_URL}/recipes_and_categories?id=eq.${recipeId}`
    )

    if (!recipeResponse.ok) {
      return NextResponse.json(
        { error: "Failed to fetch recipe" },
        { status: 500 }
      )
    }

    const recipes: Recipe[] = await recipeResponse.json()

    if (recipes.length === 0) {
      return NextResponse.json(
        { error: "Recipe not found" },
        { status: 404 }
      )
    }

    const recipe = recipes[0]

    if (includeIngredients && (!recipe.ingredients || recipe.ingredients.length === 0)) {
      return NextResponse.json(
        { error: "Recipe has no ingredients" },
        { status: 400 }
      )
    }

    // Check Gemini API key
    const geminiApiKey = env.GEMINI_API_KEY

    if (!geminiApiKey) {
      return NextResponse.json(
        { error: "Gemini API not configured" },
        { status: 503 }
      )
    }

    const ai = new GoogleGenAI({ apiKey: geminiApiKey })
    const ingredientGroups = recipe.ingredient_groups || []
    const recipeInstructions = recipe.instructions || []

    // Build response object
    const responseData: {
      recipe: { id: string; name: string }
      current: {
        ingredient_groups: typeof recipe.ingredient_groups
        ingredients: typeof recipe.ingredients
        instructions: typeof recipe.instructions
      }
      restructured?: ReturnType<typeof validateRestructuredIngredients>
      updateFormat?: ReturnType<typeof convertToUpdateFormat>
      improvedInstructions?: ReturnType<typeof validateImprovedInstructions>
      instructionsUpdateFormat?: ReturnType<typeof convertInstructionsToUpdateFormat>
    } = {
      recipe: {
        id: recipe.id,
        name: recipe.name,
      },
      current: {
        ingredient_groups: recipe.ingredient_groups,
        ingredients: recipe.ingredients,
        instructions: recipe.instructions,
      },
    }

    // Process ingredients if requested
    if (includeIngredients) {
      const promptText = formatIngredientsForPrompt(
        recipe.name,
        recipe.description,
        recipe.ingredients,
        ingredientGroups,
        recipeInstructions
      )

      let fullPrompt = `Strukturera om följande ingredienser:\n\n${promptText}`
      if (customInstructions) {
        fullPrompt += `\n\nYTTERLIGARE INSTRUKTIONER FRÅN ANVÄNDAREN:\n${customInstructions}`
      }

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: fullPrompt,
        config: {
          systemInstruction: buildRestructureSystemInstruction(),
          responseMimeType: "application/json",
          responseSchema: RESTRUCTURE_SCHEMA,
        },
      })

      const generatedText = response.text

      if (!generatedText) {
        console.error("No content in Gemini response for ingredients:", response)
        return NextResponse.json(
          { error: "No content generated by Gemini for ingredients" },
          { status: 422 }
        )
      }

      let parsedJson: unknown
      try {
        parsedJson = JSON.parse(generatedText)
      } catch (error) {
        console.error("JSON parse error for ingredients:", error, "Response:", generatedText)
        return NextResponse.json(
          {
            error: "LLM returned invalid JSON for ingredients",
            details: generatedText.substring(0, 500),
          },
          { status: 422 }
        )
      }

      try {
        const restructured = validateRestructuredIngredients(parsedJson)
        const updateFormat = convertToUpdateFormat(restructured)
        responseData.restructured = restructured
        responseData.updateFormat = updateFormat
      } catch (error) {
        console.error("Ingredients validation error:", error)
        console.error("Raw LLM response:", JSON.stringify(parsedJson, null, 2))
        return NextResponse.json(
          {
            error: "LLM response failed validation for ingredients",
            details: error instanceof Error ? error.message : "Unknown error",
            rawResponse: parsedJson,
          },
          { status: 422 }
        )
      }
    }

    // Process instructions if requested
    if (includeInstructions) {
      const promptText = formatRecipeForInstructionsPrompt(
        recipe.name,
        recipe.description,
        recipe.ingredients || [],
        ingredientGroups,
        recipeInstructions
      )

      let fullPrompt = `Förbättra eller skapa instruktioner för följande recept:\n\n${promptText}`
      if (customInstructions) {
        fullPrompt += `\n\nYTTERLIGARE INSTRUKTIONER FRÅN ANVÄNDAREN:\n${customInstructions}`
      }

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: fullPrompt,
        config: {
          systemInstruction: buildInstructionsSystemInstruction(),
          responseMimeType: "application/json",
          responseSchema: INSTRUCTIONS_SCHEMA,
        },
      })

      const generatedText = response.text

      if (!generatedText) {
        console.error("No content in Gemini response for instructions:", response)
        return NextResponse.json(
          { error: "No content generated by Gemini for instructions" },
          { status: 422 }
        )
      }

      let parsedJson: unknown
      try {
        parsedJson = JSON.parse(generatedText)
      } catch (error) {
        console.error("JSON parse error for instructions:", error, "Response:", generatedText)
        return NextResponse.json(
          {
            error: "LLM returned invalid JSON for instructions",
            details: generatedText.substring(0, 500),
          },
          { status: 422 }
        )
      }

      try {
        const improvedInstructions = validateImprovedInstructions(parsedJson)
        const instructionsUpdateFormat = convertInstructionsToUpdateFormat(improvedInstructions)
        responseData.improvedInstructions = improvedInstructions
        responseData.instructionsUpdateFormat = instructionsUpdateFormat
      } catch (error) {
        console.error("Instructions validation error:", error)
        console.error("Raw LLM response:", JSON.stringify(parsedJson, null, 2))
        return NextResponse.json(
          {
            error: "LLM response failed validation for instructions",
            details: error instanceof Error ? error.message : "Unknown error",
            rawResponse: parsedJson,
          },
          { status: 422 }
        )
      }
    }

    return NextResponse.json(responseData)
  } catch (error) {
    console.error("Preview restructure error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
