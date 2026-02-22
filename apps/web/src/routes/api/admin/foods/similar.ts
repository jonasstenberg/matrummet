import { createFileRoute } from '@tanstack/react-router'
import { apiAdminMiddleware } from '@/lib/middleware'
import { env } from '@/lib/env'
import { logger as rootLogger } from '@/lib/logger'

const logger = rootLogger.child({ module: 'api:admin:foods-similar' })

export const Route = createFileRoute('/api/admin/foods/similar')({
  server: {
    middleware: [apiAdminMiddleware],
    handlers: {
      // GET - Find similar foods
      GET: async ({ request, context }) => {
        try {
          const { postgrestToken } = context

          const { searchParams } = new URL(request.url)
          const name = searchParams.get('name')
          const limit = parseInt(searchParams.get('limit') || '5', 10)

          if (!name) {
            return Response.json({ error: 'Name is required' }, { status: 400 })
          }

          const response = await fetch(`${env.POSTGREST_URL}/rpc/find_similar_foods`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${postgrestToken}`,
            },
            body: JSON.stringify({
              p_name: name,
              p_limit: limit,
            }),
          })

          if (!response.ok) {
            const errorText = await response.text()
            throw new Error(errorText || 'Failed to find similar foods')
          }

          const data = await response.json()
          return Response.json(data)
        } catch (error) {
          logger.error({ err: error }, 'Find similar foods error')
          return Response.json(
            { error: error instanceof Error ? error.message : 'Failed to find similar foods' },
            { status: 500 }
          )
        }
      },
    },
  },
})
