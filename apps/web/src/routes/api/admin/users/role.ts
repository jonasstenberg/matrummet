import { createFileRoute } from '@tanstack/react-router'
import { apiAdminMiddleware } from '@/lib/middleware'
import { env } from '@/lib/env'
import { logger as rootLogger } from '@/lib/logger'
const logger = rootLogger.child({ module: 'api:admin:users-role' })

export const Route = createFileRoute('/api/admin/users/role')({
  server: {
    middleware: [apiAdminMiddleware],
    handlers: {
      // PATCH - Update a user's role
      PATCH: async ({ request, context }) => {
        try {
          const { postgrestToken } = context

          const body = await request.json()
          const { id, role } = body

          if (!id) {
            return Response.json({ error: 'ID krävs' }, { status: 400 })
          }

          if (role !== 'user' && role !== 'admin') {
            return Response.json(
              { error: 'Roll måste vara "user" eller "admin"' },
              { status: 400 }
            )
          }

          const response = await fetch(
            `${env.POSTGREST_URL}/rpc/admin_update_user_role`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${postgrestToken}`,
              },
              body: JSON.stringify({
                p_user_id: id,
                p_new_role: role,
              }),
            }
          )

          if (!response.ok) {
            const errorText = await response.text()
            throw new Error(errorText || 'Kunde inte uppdatera användarroll')
          }

          return Response.json({ success: true })
        } catch (error) {
          logger.error({ err: error instanceof Error ? error : String(error) }, 'Update user role error')
          return Response.json(
            { error: error instanceof Error ? error.message : 'Kunde inte uppdatera användarroll' },
            { status: 500 }
          )
        }
      },
    },
  },
})
