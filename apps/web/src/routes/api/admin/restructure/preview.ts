import { createFileRoute } from '@tanstack/react-router'
import { apiAdminMiddleware } from '@/lib/middleware'
import { env } from '@/lib/env'
import {
  RESTRUCTURE_JSON_SCHEMA,
  INSTRUCTIONS_JSON_SCHEMA,
  buildRestructureSystemInstruction,
  buildInstructionsSystemInstruction,
  formatIngredientsForPrompt,
  formatRecipeForInstructionsPrompt,
  validateRestructuredIngredients,
  validateImprovedInstructions,
  convertToUpdateFormat,
  convertInstructionsToUpdateFormat,
} from '@/lib/ingredient-restructure'
import type { Recipe } from '@/lib/types'
import { createMistralClient, MISTRAL_MODEL } from '@/lib/ai-client'
import { logger as rootLogger } from '@/lib/logger'

const logger = rootLogger.child({ module: 'api:admin:restructure-preview' })

export const Route = createFileRoute('/api/admin/restructure/preview')({
  server: {
    middleware: [apiAdminMiddleware],
    handlers: {
      /**
       * POST /api/admin/restructure/preview
       * Generates a preview of how ingredients would be restructured and/or instructions improved using AI.
       *
       * Body:
       * - recipeId: The recipe ID to restructure
       * - instructions: Optional custom instructions for the AI
       * - includeIngredients: Whether to restructure ingredients (default: true)
       * - includeInstructions: Whether to improve/create instructions (default: false)
       */
      POST: async ({ request }) => {
        try {
          const body = await request.json()
          const { recipeId, instructions, includeIngredients = true, includeInstructions = false } = body

          if (!recipeId || typeof recipeId !== 'string') {
            return Response.json(
              { error: 'recipeId is required' },
              { status: 400 }
            )
          }

          if (!includeIngredients && !includeInstructions) {
            return Response.json(
              { error: 'At least one of includeIngredients or includeInstructions must be true' },
              { status: 400 }
            )
          }

          const customInstructions = typeof instructions === 'string' ? instructions.trim() : ''

          // Fetch the recipe
          const recipeResponse = await fetch(
            `${env.POSTGREST_URL}/user_recipes?id=eq.${recipeId}`
          )

          if (!recipeResponse.ok) {
            return Response.json(
              { error: 'Failed to fetch recipe' },
              { status: 500 }
            )
          }

          const recipes: Recipe[] = await recipeResponse.json()

          if (recipes.length === 0) {
            return Response.json(
              { error: 'Recipe not found' },
              { status: 404 }
            )
          }

          const recipe = recipes[0]

          if (includeIngredients && (!recipe.ingredients || recipe.ingredients.length === 0)) {
            return Response.json(
              { error: 'Recipe has no ingredients' },
              { status: 400 }
            )
          }

          // Check AI API key
          if (!env.MISTRAL_API_KEY) {
            return Response.json(
              { error: 'AI API not configured' },
              { status: 503 }
            )
          }

          const client = createMistralClient()
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

            const aiResponse = await client.chat.complete({
              model: MISTRAL_MODEL,
              messages: [
                { role: 'system', content: buildRestructureSystemInstruction() },
                { role: 'user', content: fullPrompt },
              ],
              responseFormat: {
                type: 'json_schema',
                jsonSchema: {
                  name: 'restructured_ingredients',
                  schemaDefinition: RESTRUCTURE_JSON_SCHEMA,
                  strict: true,
                },
              },
            })

            const generatedText = aiResponse.choices?.[0]?.message?.content

            if (!generatedText || typeof generatedText !== 'string') {
              logger.error({ recipeId }, 'No content in AI response for ingredients')
              return Response.json(
                { error: 'No content generated by AI for ingredients' },
                { status: 422 }
              )
            }

            let parsedJson: unknown
            try {
              parsedJson = JSON.parse(generatedText)
            } catch (error) {
              logger.error({ err: error instanceof Error ? error : String(error), recipeId, detail: generatedText.substring(0, 500) }, 'JSON parse error for ingredients')
              return Response.json(
                {
                  error: 'LLM returned invalid JSON for ingredients',
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
              logger.error({ err: error instanceof Error ? error : String(error), recipeId, detail: parsedJson }, 'Ingredients validation error')
              return Response.json(
                {
                  error: 'LLM response failed validation for ingredients',
                  details: error instanceof Error ? error.message : 'Unknown error',
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

            const aiResponse = await client.chat.complete({
              model: MISTRAL_MODEL,
              messages: [
                { role: 'system', content: buildInstructionsSystemInstruction() },
                { role: 'user', content: fullPrompt },
              ],
              responseFormat: {
                type: 'json_schema',
                jsonSchema: {
                  name: 'improved_instructions',
                  schemaDefinition: INSTRUCTIONS_JSON_SCHEMA,
                  strict: true,
                },
              },
            })

            const generatedText = aiResponse.choices?.[0]?.message?.content

            if (!generatedText || typeof generatedText !== 'string') {
              logger.error({ recipeId }, 'No content in AI response for instructions')
              return Response.json(
                { error: 'No content generated by AI for instructions' },
                { status: 422 }
              )
            }

            let parsedJson: unknown
            try {
              parsedJson = JSON.parse(generatedText)
            } catch (error) {
              logger.error({ err: error instanceof Error ? error : String(error), recipeId, detail: generatedText.substring(0, 500) }, 'JSON parse error for instructions')
              return Response.json(
                {
                  error: 'LLM returned invalid JSON for instructions',
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
              logger.error({ err: error instanceof Error ? error : String(error), recipeId, detail: parsedJson }, 'Instructions validation error')
              return Response.json(
                {
                  error: 'LLM response failed validation for instructions',
                  details: error instanceof Error ? error.message : 'Unknown error',
                  rawResponse: parsedJson,
                },
                { status: 422 }
              )
            }
          }

          return Response.json(responseData)
        } catch (error) {
          logger.error({ err: error instanceof Error ? error : String(error) }, 'Preview restructure error')
          return Response.json(
            { error: 'Internal server error' },
            { status: 500 }
          )
        }
      },
    },
  },
})
