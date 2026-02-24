import { createFileRoute } from '@tanstack/react-router'
import { apiAuthMiddleware } from '@/lib/middleware'
import { getSubstitutionSuggestions } from '@/lib/substitutions'
import { logger as rootLogger } from '@/lib/logger'
const logger = rootLogger.child({ module: 'api:substitutions' })

export const Route = createFileRoute('/api/substitutions')({
  server: {
    middleware: [apiAuthMiddleware],
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json()

          const result = await getSubstitutionSuggestions({
            recipe_id: body.recipe_id,
            missing_food_ids: body.missing_food_ids,
            available_food_ids: body.available_food_ids,
            user_preferences: body.user_preferences,
          })

          if ('error' in result) {
            return Response.json(
              { error: result.error },
              { status: result.status || 500 },
            )
          }

          logger.info({ ...result.usage, recipeId: body.recipe_id, missingCount: body.missing_food_ids?.length }, 'Substitution suggestions generated')
          return Response.json({ substitutions: result.substitutions })
        } catch (error) {
          logger.error({ err: error instanceof Error ? error : String(error) }, 'Substitution API error')
          return Response.json(
            { error: 'Ett ovantad fel uppstod' },
            { status: 500 },
          )
        }
      },
    },
  },
})
