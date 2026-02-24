import { createFileRoute } from '@tanstack/react-router'
import { apiAuthMiddleware } from '@/lib/middleware'
import { env } from '@/lib/env'
import { logger as rootLogger } from '@/lib/logger'

const logger = rootLogger.child({ module: 'api:recipes:search' })

export const Route = createFileRoute('/api/recipes/search')({
  server: {
    middleware: [apiAuthMiddleware],
    handlers: {
      GET: async ({ request, context }) => {
        const { postgrestToken } = context

        const { searchParams } = new URL(request.url)
        const query = searchParams.get('q') || ''
        const limit = searchParams.get('limit') || '20'
        const homeId = searchParams.get('home_id') || undefined

        const headers: Record<string, string> = {
          Authorization: `Bearer ${postgrestToken}`,
          Accept: 'application/json',
        }
        if (homeId) {
          headers['X-Active-Home-Id'] = homeId
        }

        let url: string
        if (query.trim()) {
          // Use search_recipes RPC
          url = `${env.POSTGREST_URL}/rpc/search_recipes`
          const response = await fetch(url, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              p_query: query.trim(),
              p_limit: parseInt(limit),
              p_offset: 0,
            }),
          })

          if (!response.ok) {
            const errorText = await response.text()
            logger.error({ status: response.status, responseBody: errorText, query: query.trim() }, 'Recipe search RPC failed')
            return Response.json([])
          }

          const recipes = await response.json()
          return Response.json(
            recipes.map((r: Record<string, unknown>) => ({
              id: r.id,
              name: r.name,
              image: r.image,
              categories: r.categories || [],
              prep_time: r.prep_time,
              cook_time: r.cook_time,
            })),
          )
        } else {
          // Recent recipes
          url = `${env.POSTGREST_URL}/user_recipes?select=id,name,image,categories,prep_time,cook_time&order=date_modified.desc&limit=${limit}`
          const response = await fetch(url, { headers, cache: 'no-store' })

          if (!response.ok) {
            const errorText = await response.text()
            logger.error({ status: response.status, responseBody: errorText }, 'Recent recipes query failed')
            return Response.json([])
          }

          return Response.json(await response.json())
        }
      },
    },
  },
})
