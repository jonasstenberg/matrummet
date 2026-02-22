import { createFileRoute } from '@tanstack/react-router'
import { apiAdminMiddleware } from '@/lib/middleware'
import { env } from '@/lib/env'
import { logger as rootLogger } from '@/lib/logger'

const logger = rootLogger.child({ module: 'api:admin:foods-recipes' })

export const Route = createFileRoute('/api/admin/foods/recipes')({
  server: {
    middleware: [apiAdminMiddleware],
    handlers: {
      // GET - Get recipes that use a specific food
      GET: async ({ request, context }) => {
        try {
          const { postgrestToken } = context

          const { searchParams } = new URL(request.url)
          const foodId = searchParams.get('foodId')

          if (!foodId) {
            return Response.json({ error: 'foodId is required' }, { status: 400 })
          }

          // First get ingredients with this food_id
          const ingredientsResponse = await fetch(
            `${env.POSTGREST_URL}/ingredients?food_id=eq.${foodId}&select=recipe_id`,
            {
              headers: {
                Authorization: `Bearer ${postgrestToken}`,
              },
            }
          )

          if (!ingredientsResponse.ok) {
            throw new Error('Failed to fetch ingredients')
          }

          const ingredients = await ingredientsResponse.json()

          // Get unique recipe IDs
          const recipeIds = [...new Set(ingredients.map((i: { recipe_id: string }) => i.recipe_id))]

          if (recipeIds.length === 0) {
            return Response.json([])
          }

          // Fetch recipes by IDs
          const recipesResponse = await fetch(
            `${env.POSTGREST_URL}/recipes?id=in.(${recipeIds.join(',')})&select=id,name&order=name`,
            {
              headers: {
                Authorization: `Bearer ${postgrestToken}`,
              },
            }
          )

          if (!recipesResponse.ok) {
            throw new Error('Failed to fetch recipes')
          }

          const recipes = await recipesResponse.json()

          return Response.json(recipes)
        } catch (error) {
          logger.error({ err: error instanceof Error ? error : String(error) }, 'Get recipes for food error')
          return Response.json(
            { error: 'Failed to fetch recipes' },
            { status: 500 }
          )
        }
      },
    },
  },
})
