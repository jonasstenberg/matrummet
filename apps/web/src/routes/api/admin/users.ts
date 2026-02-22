import { createFileRoute } from '@tanstack/react-router'
import { apiAdminMiddleware } from '@/lib/middleware'
import { env } from '@/lib/env'
import { logger as rootLogger } from '@/lib/logger'
const logger = rootLogger.child({ module: 'api:admin:users' })

export const Route = createFileRoute('/api/admin/users')({
  server: {
    middleware: [apiAdminMiddleware],
    handlers: {
      // GET - Paginated list of users with search and role filter
      GET: async ({ request, context }) => {
        try {
          const { postgrestToken } = context

          const { searchParams } = new URL(request.url)
          const page = parseInt(searchParams.get('page') || '1')
          const search = searchParams.get('search') || ''
          const role = searchParams.get('role') || null
          const pageSize = 50

          // Fetch total count
          const countResponse = await fetch(
            `${env.POSTGREST_URL}/rpc/admin_count_users`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${postgrestToken}`,
              },
              body: JSON.stringify({
                p_search: search || null,
                p_role: role,
              }),
            }
          )

          if (!countResponse.ok) {
            throw new Error('Kunde inte hämta antal användare')
          }

          const total = await countResponse.json()

          // Fetch paginated items
          const offset = (page - 1) * pageSize
          const itemsResponse = await fetch(
            `${env.POSTGREST_URL}/rpc/admin_list_users`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${postgrestToken}`,
              },
              body: JSON.stringify({
                p_search: search || null,
                p_role: role,
                p_limit: pageSize,
                p_offset: offset,
              }),
            }
          )

          if (!itemsResponse.ok) {
            throw new Error('Kunde inte hämta användare')
          }

          const items = await itemsResponse.json()

          return Response.json({
            items,
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
          })
        } catch (error) {
          logger.error({ err: error }, 'Get users error')
          return Response.json(
            { error: 'Kunde inte hämta användare' },
            { status: 500 }
          )
        }
      },

      // PATCH - Update a user's name
      PATCH: async ({ request, context }) => {
        try {
          const { postgrestToken } = context

          const body = await request.json()
          const { id, name } = body

          if (!id || !name || !name.trim()) {
            return Response.json(
              { error: 'ID och namn krävs' },
              { status: 400 }
            )
          }

          const response = await fetch(
            `${env.POSTGREST_URL}/rpc/admin_update_user`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${postgrestToken}`,
              },
              body: JSON.stringify({
                p_user_id: id,
                p_name: name.trim(),
              }),
            }
          )

          if (!response.ok) {
            const errorText = await response.text()
            throw new Error(errorText || 'Kunde inte uppdatera användare')
          }

          return Response.json({ success: true })
        } catch (error) {
          logger.error({ err: error }, 'Update user error')
          return Response.json(
            { error: error instanceof Error ? error.message : 'Kunde inte uppdatera användare' },
            { status: 500 }
          )
        }
      },

      // DELETE - Delete a user
      DELETE: async ({ request, context }) => {
        try {
          const { postgrestToken } = context

          const { searchParams } = new URL(request.url)
          const id = searchParams.get('id')

          if (!id) {
            return Response.json({ error: 'ID krävs' }, { status: 400 })
          }

          const response = await fetch(
            `${env.POSTGREST_URL}/rpc/admin_delete_user`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${postgrestToken}`,
              },
              body: JSON.stringify({
                p_user_id: id,
              }),
            }
          )

          if (!response.ok) {
            const errorText = await response.text()
            throw new Error(errorText || 'Kunde inte ta bort användare')
          }

          return Response.json({ success: true })
        } catch (error) {
          logger.error({ err: error }, 'Delete user error')
          return Response.json(
            { error: error instanceof Error ? error.message : 'Kunde inte ta bort användare' },
            { status: 500 }
          )
        }
      },
    },
  },
})
