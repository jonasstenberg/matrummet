import { createFileRoute } from '@tanstack/react-router'
import { apiAuthMiddleware } from '@/lib/middleware'
import { env } from '@/lib/env'

export const Route = createFileRoute('/api/credits/balance')({
  server: {
    middleware: [apiAuthMiddleware],
    handlers: {
      GET: async ({ context }) => {
        const { postgrestToken } = context

        const response = await fetch(`${env.POSTGREST_URL}/rpc/get_user_credits`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${postgrestToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
          cache: 'no-store',
        })

        if (!response.ok) {
          return Response.json(
            { error: 'Kunde inte hämta AI-poäng' },
            { status: 500 },
          )
        }

        const balance = await response.json()
        return Response.json({ balance })
      },
    },
  },
})
