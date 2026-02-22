import { createFileRoute } from '@tanstack/react-router'
import { apiAuthMiddleware } from '@/lib/middleware'
import { env } from '@/lib/env'
import {
  buildSystemInstruction,
  validateParsedRecipe,
} from '@/lib/recipe-parser/prompt'
import { RECIPE_JSON_SCHEMA } from '@/lib/recipe-parser/types'
import { createMistralClient, MISTRAL_MODEL } from '@/lib/ai-client'
import { logger as rootLogger } from '@/lib/logger'
const logger = rootLogger.child({ module: 'api:ai:generate' })

const MAX_IMAGE_SIZE = 10 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]

async function fetchCategories(): Promise<string[]> {
  try {
    const response = await fetch(
      `${env.POSTGREST_URL}/categories?select=name&order=name`,
    )
    if (!response.ok) return []
    const data = await response.json()
    return data.map((c: { name: string }) => c.name)
  } catch {
    return []
  }
}

async function checkCredits(
  postgrestToken: string,
): Promise<{ hasCredits: true; balance: number } | { hasCredits: false }> {
  const response = await fetch(`${env.POSTGREST_URL}/rpc/get_user_credits`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${postgrestToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  })

  if (!response.ok) {
    return { hasCredits: false }
  }

  const balance = await response.json()
  if (typeof balance !== 'number' || balance < 1) {
    return { hasCredits: false }
  }
  return { hasCredits: true, balance }
}

async function deductCredit(
  postgrestToken: string,
  description: string,
): Promise<{ success: true; remainingCredits: number } | { success: false }> {
  const response = await fetch(`${env.POSTGREST_URL}/rpc/deduct_credit`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${postgrestToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_description: description }),
  })

  if (!response.ok) {
    return { success: false }
  }

  const remainingCredits = await response.json()
  return { success: true, remainingCredits }
}

export const Route = createFileRoute('/api/ai/generate')({
  server: {
    middleware: [apiAuthMiddleware],
    handlers: {
      POST: async ({ request, context }) => {
        try {
          const { postgrestToken } = context

          const contentType = request.headers.get('content-type') || ''
          let text: string | null = null
          let imageData: { base64: string; mimeType: string } | null = null

          if (contentType.includes('multipart/form-data')) {
            const formData = await request.formData()
            text = formData.get('text') as string | null
            const image = formData.get('image') as File | null

            if (image) {
              if (!ALLOWED_IMAGE_TYPES.includes(image.type)) {
                return Response.json(
                  {
                    error:
                      'Ogiltig bildtyp. Tillåtna format: JPEG, PNG, WebP, GIF',
                  },
                  { status: 400 },
                )
              }

              if (image.size > MAX_IMAGE_SIZE) {
                return Response.json(
                  { error: 'Bilden får vara max 10 MB' },
                  { status: 400 },
                )
              }

              const bytes = await image.arrayBuffer()
              const base64 = Buffer.from(bytes).toString('base64')
              imageData = { base64, mimeType: image.type }
            }
          } else {
            const body = await request.json()
            text = body.text
          }

          const trimmedText =
            text && typeof text === 'string' ? text.trim() : null
          const hasText = trimmedText !== null && trimmedText.length > 0
          const hasImage = imageData !== null

          if (!hasText && !hasImage) {
            return Response.json(
              { error: 'Text eller bild krävs' },
              { status: 400 },
            )
          }

          if (!env.MISTRAL_API_KEY) {
            return Response.json(
              { error: 'AI-generering är inte konfigurerat' },
              { status: 503 },
            )
          }

          // Check that user has credits
          const creditCheck = await checkCredits(postgrestToken)

          if (!creditCheck.hasCredits) {
            return Response.json(
              {
                error:
                  'Du har inga AI-poäng kvar. Köp fler i menyn.',
                code: 'INSUFFICIENT_CREDITS',
              },
              { status: 402 },
            )
          }

          // Fetch categories
          const categories = await fetchCategories()

          const client = createMistralClient()

          let parsedJson: unknown

          if (imageData) {
            // Image path: use OCR endpoint with structured extraction
            const annotationPrompt = trimmedText
              ? `${buildSystemInstruction(categories, true)}\n\nAnvänd även denna extra information: ${trimmedText}`
              : buildSystemInstruction(categories, true)

            const ocrResponse = await client.ocr.process({
              model: 'mistral-ocr-latest',
              document: {
                imageUrl: `data:${imageData.mimeType};base64,${imageData.base64}`,
                type: 'image_url',
              },
              documentAnnotationFormat: {
                type: 'json_schema',
                jsonSchema: {
                  name: 'recipe',
                  schemaDefinition: RECIPE_JSON_SCHEMA,
                  strict: true,
                },
              },
              documentAnnotationPrompt: annotationPrompt,
            })

            const annotation = ocrResponse.documentAnnotation
            if (!annotation) {
              return Response.json(
                { error: 'Inget svar från AI' },
                { status: 422 },
              )
            }

            try {
              parsedJson = JSON.parse(annotation)
            } catch {
              return Response.json(
                { error: 'AI returnerade ogiltigt svar' },
                { status: 422 },
              )
            }
          } else {
            // Text path: use chat completion
            const response = await client.chat.complete({
              model: MISTRAL_MODEL,
              messages: [
                { role: 'system', content: buildSystemInstruction(categories, false) },
                { role: 'user', content: `Analysera följande recepttext och extrahera all information:\n\n${trimmedText}` },
              ],
              responseFormat: {
                type: 'json_schema',
                jsonSchema: {
                  name: 'recipe',
                  schemaDefinition: RECIPE_JSON_SCHEMA,
                  strict: true,
                },
              },
            })

            const generatedText = response.choices?.[0]?.message?.content
            if (!generatedText || typeof generatedText !== 'string') {
              return Response.json(
                { error: 'Inget svar från AI' },
                { status: 422 },
              )
            }

            try {
              parsedJson = JSON.parse(generatedText)
            } catch {
              return Response.json(
                { error: 'AI returnerade ogiltigt svar' },
                { status: 422 },
              )
            }
          }

          try {
            const recipe = validateParsedRecipe(parsedJson)

            // Deduct credit after successful generation
            const deductResult = await deductCredit(
              postgrestToken,
              `AI: ${recipe.recipe_name.substring(0, 50)}`,
            )

            return Response.json({
              recipe,
              remainingCredits: deductResult.success ? deductResult.remainingCredits : creditCheck.balance - 1,
            })
          } catch (error) {
            logger.error({ err: error instanceof Error ? error : String(error), email: context.session?.email }, 'Recipe validation error')
            return Response.json(
              {
                error: 'AI-svaret kunde inte valideras',
                details: error instanceof Error ? error.message : 'Unknown error',
              },
              { status: 422 },
            )
          }
        } catch (error) {
          logger.error({ err: error instanceof Error ? error : String(error), email: context.session?.email }, 'AI generate error')
          return Response.json(
            { error: 'Internal server error' },
            { status: 500 },
          )
        }
      },
    },
  },
})
