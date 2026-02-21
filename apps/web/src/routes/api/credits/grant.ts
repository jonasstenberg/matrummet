import { createFileRoute } from '@tanstack/react-router'
import { apiAdminMiddleware } from '@/lib/middleware'
import { env } from '@/lib/env'

export const Route = createFileRoute('/api/credits/grant')({
  server: {
    middleware: [apiAdminMiddleware],
    handlers: {
      POST: async ({ request, context }) => {
        const { session, postgrestToken } = context

        const body = await request.json()
        const { email, amount } = body as { email: string; amount: number }

        if (!email || typeof email !== 'string') {
          return Response.json({ error: 'Email required' }, { status: 400 })
        }

        if (!amount || typeof amount !== 'number' || amount < 1 || amount > 1000) {
          return Response.json(
            { error: 'Amount must be between 1 and 1000' },
            { status: 400 },
          )
        }

        const response = await fetch(`${env.POSTGREST_URL}/rpc/add_credits`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${postgrestToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            p_user_email: email,
            p_amount: amount,
            p_transaction_type: 'admin_grant',
            p_description: `Beviljat av admin (${session.email})`,
          }),
        })

        if (!response.ok) {
          const errorText = await response.text()
          return Response.json(
            { error: `Failed to grant credits: ${errorText}` },
            { status: 500 },
          )
        }

        const newBalance = await response.json()
        return Response.json({ balance: newBalance })
      },
    },
  },
})
