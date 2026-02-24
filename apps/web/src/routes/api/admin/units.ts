import { createFileRoute } from '@tanstack/react-router'
import { apiAdminMiddleware } from '@/lib/middleware'
import { env } from '@/lib/env'
import { logger as rootLogger } from '@/lib/logger'

const logger = rootLogger.child({ module: 'api:admin:units' })

export const Route = createFileRoute('/api/admin/units')({
  server: {
    middleware: [apiAdminMiddleware],
    handlers: {
      // GET - List units with pagination, search, and filter
      GET: async ({ request, context }) => {
        try {
          const { postgrestToken } = context

          const { searchParams } = new URL(request.url)
          const page = parseInt(searchParams.get('page') || '1', 10)
          const search = searchParams.get('search') || ''
          const filter = searchParams.get('filter') || 'all'
          const pageSize = 50
          const offset = (page - 1) * pageSize

          // Fetch units
          const unitsResponse = await fetch(
            `${env.POSTGREST_URL}/rpc/admin_list_units`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${postgrestToken}`,
              },
              body: JSON.stringify({
                p_search: search || null,
                p_limit: pageSize,
                p_offset: offset,
              }),
            }
          )

          if (!unitsResponse.ok) {
            throw new Error('Kunde inte hämta enheter')
          }

          let items = await unitsResponse.json()

          // Apply client-side filter for unused/missing abbreviation
          if (filter === 'unused') {
            items = items.filter((u: { ingredient_count: number }) => u.ingredient_count === 0)
          } else if (filter === 'missing_abbreviation') {
            items = items.filter((u: { abbreviation: string }) => !u.abbreviation)
          }

          // Fetch total count
          const countResponse = await fetch(
            `${env.POSTGREST_URL}/rpc/admin_count_units`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${postgrestToken}`,
              },
              body: JSON.stringify({
                p_search: search || null,
              }),
            }
          )

          if (!countResponse.ok) {
            throw new Error('Kunde inte hämta antal enheter')
          }

          const total = await countResponse.json()
          const totalPages = Math.ceil(total / pageSize)

          return Response.json({
            items,
            total: filter === 'all' ? total : items.length,
            page,
            pageSize,
            totalPages: filter === 'all' ? totalPages : 1,
          })
        } catch (error) {
          logger.error({ err: error instanceof Error ? error : String(error) }, 'Get units error')
          return Response.json(
            { error: 'Kunde inte hämta enheter' },
            { status: 500 }
          )
        }
      },

      // POST - Create a new unit or merge units
      POST: async ({ request, context }) => {
        try {
          const { postgrestToken } = context

          const body = await request.json()

          // Handle merge action
          if (body.action === 'merge') {
            const { sourceId, targetId } = body

            if (!sourceId || !targetId) {
              return Response.json({ error: 'Käll-ID och mål-ID krävs' }, { status: 400 })
            }

            // Update all ingredients from source unit to target unit
            const updateRes = await fetch(
              `${env.POSTGREST_URL}/ingredients?unit_id=eq.${sourceId}`,
              {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${postgrestToken}`,
                },
                body: JSON.stringify({ unit_id: targetId }),
              }
            )

            if (!updateRes.ok) {
              throw new Error('Kunde inte flytta ingredienser')
            }

            // Delete source unit
            const deleteRes = await fetch(`${env.POSTGREST_URL}/units?id=eq.${sourceId}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${postgrestToken}` },
            })

            if (!deleteRes.ok) {
              throw new Error('Kunde inte ta bort källenhet')
            }

            logger.info({ sourceId, targetId }, 'Units merged')
            return Response.json({ success: true })
          }

          // Normal create
          const { name, plural, abbreviation } = body

          if (!name || !name.trim()) {
            return Response.json({ error: 'Namn krävs' }, { status: 400 })
          }

          if (!plural || !plural.trim()) {
            return Response.json({ error: 'Pluralform krävs' }, { status: 400 })
          }

          const response = await fetch(`${env.POSTGREST_URL}/units`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${postgrestToken}`,
              Prefer: 'return=minimal',
            },
            body: JSON.stringify({
              name: name.trim(),
              plural: plural.trim(),
              abbreviation: (abbreviation || '').trim(),
            }),
          })

          if (!response.ok) {
            const errorText = await response.text()
            // Check for duplicate key error
            if (errorText.includes('duplicate key') || errorText.includes('unique constraint')) {
              return Response.json(
                { error: 'En enhet med detta namn finns redan' },
                { status: 400 }
              )
            }
            throw new Error(errorText || 'Kunde inte skapa enhet')
          }

          logger.info({ name: name.trim() }, 'Unit created')
          return Response.json({ success: true })
        } catch (error) {
          logger.error({ err: error instanceof Error ? error : String(error) }, 'Create unit error')
          return Response.json(
            { error: error instanceof Error ? error.message : 'Kunde inte skapa enhet' },
            { status: 500 }
          )
        }
      },

      // PATCH - Update a unit
      PATCH: async ({ request, context }) => {
        try {
          const { postgrestToken } = context

          const body = await request.json()
          const { id, name, plural, abbreviation } = body

          if (!id || !name || !name.trim() || !plural || !plural.trim()) {
            return Response.json(
              { error: 'ID, namn och pluralform krävs' },
              { status: 400 }
            )
          }

          const response = await fetch(`${env.POSTGREST_URL}/units?id=eq.${id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${postgrestToken}`,
            },
            body: JSON.stringify({
              name: name.trim(),
              plural: plural.trim(),
              abbreviation: (abbreviation || '').trim(),
            }),
          })

          if (!response.ok) {
            const errorText = await response.text()
            // Check for duplicate key error
            if (errorText.includes('duplicate key') || errorText.includes('unique constraint')) {
              return Response.json(
                { error: 'En enhet med detta namn finns redan' },
                { status: 400 }
              )
            }
            throw new Error(errorText || 'Kunde inte uppdatera enhet')
          }

          logger.info({ id, name: name.trim() }, 'Unit updated')
          return Response.json({ success: true })
        } catch (error) {
          logger.error({ err: error instanceof Error ? error : String(error) }, 'Update unit error')
          return Response.json(
            { error: error instanceof Error ? error.message : 'Kunde inte uppdatera enhet' },
            { status: 500 }
          )
        }
      },

      // DELETE - Delete a unit
      DELETE: async ({ request, context }) => {
        try {
          const { postgrestToken } = context

          const { searchParams } = new URL(request.url)
          const id = searchParams.get('id')

          if (!id) {
            return Response.json({ error: 'ID krävs' }, { status: 400 })
          }

          const response = await fetch(`${env.POSTGREST_URL}/units?id=eq.${id}`, {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${postgrestToken}`,
            },
          })

          if (!response.ok) {
            const errorText = await response.text()
            throw new Error(errorText || 'Kunde inte ta bort enhet')
          }

          logger.info({ id }, 'Unit deleted')
          return Response.json({ success: true })
        } catch (error) {
          logger.error({ err: error instanceof Error ? error : String(error) }, 'Delete unit error')
          return Response.json(
            { error: error instanceof Error ? error.message : 'Kunde inte ta bort enhet' },
            { status: 500 }
          )
        }
      },
    },
  },
})
