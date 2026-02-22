import { createFileRoute } from '@tanstack/react-router'
import { apiAdminMiddleware } from '@/lib/middleware'
import { env } from '@/lib/env'

export const Route = createFileRoute('/api/admin/foods')({
  server: {
    middleware: [apiAdminMiddleware],
    handlers: {
      // GET - Paginated list of foods with search
      GET: async ({ request, context }) => {
        try {
          const { postgrestToken } = context

          const { searchParams } = new URL(request.url)
          const page = parseInt(searchParams.get('page') || '1')
          const search = searchParams.get('search') || ''
          const status = searchParams.get('status') || null
          const pageSize = 50

          // Fetch total count
          const countResponse = await fetch(
            `${env.POSTGREST_URL}/rpc/admin_count_foods`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${postgrestToken}`,
              },
              body: JSON.stringify({
                p_search: search || null,
                p_status: status,
              }),
            }
          )

          if (!countResponse.ok) {
            throw new Error('Kunde inte hämta antal matvaror')
          }

          const total = await countResponse.json()

          // Fetch paginated items
          const offset = (page - 1) * pageSize
          const itemsResponse = await fetch(
            `${env.POSTGREST_URL}/rpc/admin_list_foods`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${postgrestToken}`,
              },
              body: JSON.stringify({
                p_search: search || null,
                p_status: status,
                p_limit: pageSize,
                p_offset: offset,
              }),
            }
          )

          if (!itemsResponse.ok) {
            throw new Error('Kunde inte hämta matvaror')
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
          console.error('Get foods error:', error)
          return Response.json(
            { error: 'Kunde inte hämta matvaror' },
            { status: 500 }
          )
        }
      },

      // POST - Create a new food
      POST: async ({ request, context }) => {
        try {
          const { postgrestToken } = context

          const body = await request.json()
          const { name } = body

          if (!name || !name.trim()) {
            return Response.json({ error: 'Namn krävs' }, { status: 400 })
          }

          const response = await fetch(`${env.POSTGREST_URL}/foods`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${postgrestToken}`,
              Prefer: 'return=minimal',
            },
            body: JSON.stringify({ name: name.trim() }),
          })

          if (!response.ok) {
            const errorText = await response.text()

            // Check for duplicate key error
            if (errorText.includes('duplicate key') || errorText.includes('unique constraint')) {
              return Response.json(
                { error: 'En matvara med detta namn finns redan' },
                { status: 409 }
              )
            }

            throw new Error(errorText || 'Kunde inte skapa matvara')
          }

          return Response.json({ success: true })
        } catch (error) {
          console.error('Create food error:', error)

          if (error instanceof Error && error.message.includes('matvara med detta namn')) {
            return Response.json(
              { error: error.message },
              { status: 409 }
            )
          }

          return Response.json(
            { error: error instanceof Error ? error.message : 'Kunde inte skapa matvara' },
            { status: 500 }
          )
        }
      },

      // PATCH - Update a food
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

          const response = await fetch(`${env.POSTGREST_URL}/foods?id=eq.${id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${postgrestToken}`,
            },
            body: JSON.stringify({ name: name.trim() }),
          })

          if (!response.ok) {
            const errorText = await response.text()

            // Check for duplicate key error
            if (errorText.includes('duplicate key') || errorText.includes('unique constraint')) {
              return Response.json(
                { error: 'En matvara med detta namn finns redan' },
                { status: 409 }
              )
            }

            throw new Error(errorText || 'Kunde inte uppdatera matvara')
          }

          return Response.json({ success: true })
        } catch (error) {
          console.error('Update food error:', error)

          if (error instanceof Error && error.message.includes('matvara med detta namn')) {
            return Response.json(
              { error: error.message },
              { status: 409 }
            )
          }

          return Response.json(
            { error: error instanceof Error ? error.message : 'Kunde inte uppdatera matvara' },
            { status: 500 }
          )
        }
      },

      // DELETE - Delete a food
      DELETE: async ({ request, context }) => {
        try {
          const { postgrestToken } = context

          const { searchParams } = new URL(request.url)
          const id = searchParams.get('id')

          if (!id) {
            return Response.json({ error: 'ID krävs' }, { status: 400 })
          }

          const response = await fetch(`${env.POSTGREST_URL}/foods?id=eq.${id}`, {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${postgrestToken}`,
            },
          })

          if (!response.ok) {
            const errorText = await response.text()
            throw new Error(errorText || 'Kunde inte ta bort matvara')
          }

          return Response.json({ success: true })
        } catch (error) {
          console.error('Delete food error:', error)
          return Response.json(
            { error: error instanceof Error ? error.message : 'Kunde inte ta bort matvara' },
            { status: 500 }
          )
        }
      },
    },
  },
})
