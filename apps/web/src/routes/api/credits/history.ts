import { createFileRoute } from '@tanstack/react-router'
import { apiAuthMiddleware } from '@/lib/middleware'
import { env } from '@/lib/env'

export const Route = createFileRoute('/api/credits/history')({
  server: {
    middleware: [apiAuthMiddleware],
    handlers: {
      GET: async ({ request, context }) => {
        const { postgrestToken } = context

        const { searchParams } = new URL(request.url)
        const limit = parseInt(searchParams.get('limit') || '50', 10)
        const offset = parseInt(searchParams.get('offset') || '0', 10)

        const response = await fetch(`${env.POSTGREST_URL}/rpc/get_credit_history`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${postgrestToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ p_limit: limit, p_offset: offset }),
          cache: 'no-store',
        })

        if (!response.ok) {
          return Response.json(
            { error: 'Failed to fetch history' },
            { status: 500 },
          )
        }

        const transactions = await response.json()
        return Response.json({ transactions })
      },
    },
  },
})
