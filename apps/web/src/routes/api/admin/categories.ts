import { createFileRoute } from '@tanstack/react-router'
import { apiAdminMiddleware } from '@/lib/middleware'
import { env } from '@/lib/env'

export const Route = createFileRoute('/api/admin/categories')({
  server: {
    middleware: [apiAdminMiddleware],
    handlers: {
      // GET - List all categories with recipe count
      GET: async () => {
        try {
          // Fetch categories with recipe count and group info
          const response = await fetch(
            `${env.POSTGREST_URL}/categories?select=id,name,group_id,recipe_categories(count),category_groups(name,sort_order)&order=name`
          )

          if (!response.ok) {
            throw new Error('Kunde inte hämta kategorier')
          }

          const data: Array<{
            id: number
            name: string
            group_id: string | null
            recipe_categories: Array<{ count: number }>
            category_groups: { name: string; sort_order: number } | null
          }> = await response.json()

          // Transform the data to include recipe_count and group_name
          const categoriesWithCount = data.map((cat) => ({
            id: cat.id,
            name: cat.name,
            group_id: cat.group_id,
            recipe_count: cat.recipe_categories?.[0]?.count ?? 0,
            group_name: cat.category_groups?.name ?? null,
            group_sort_order: cat.category_groups?.sort_order ?? 99,
          }))

          return Response.json(categoriesWithCount)
        } catch (error) {
          console.error('Get categories error:', error)
          return Response.json(
            { error: 'Kunde inte hämta kategorier' },
            { status: 500 }
          )
        }
      },

      // POST - Create a new category or merge categories
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

            // Move all recipe_categories from source to target
            // First, get existing recipe_categories for target to avoid duplicates
            const existingRes = await fetch(
              `${env.POSTGREST_URL}/recipe_categories?category_id=eq.${targetId}&select=recipe_id`,
              {
                headers: { Authorization: `Bearer ${postgrestToken}` },
              }
            )

            const existingRecipes: Array<{ recipe_id: string }> = existingRes.ok ? await existingRes.json() : []
            const existingRecipeIds = new Set(existingRecipes.map((r) => r.recipe_id))

            // Get source recipe_categories
            const sourceRes = await fetch(
              `${env.POSTGREST_URL}/recipe_categories?category_id=eq.${sourceId}&select=recipe_id`,
              {
                headers: { Authorization: `Bearer ${postgrestToken}` },
              }
            )

            const sourceRecipes: Array<{ recipe_id: string }> = sourceRes.ok ? await sourceRes.json() : []

            // Insert non-duplicate associations
            const toInsert = sourceRecipes.filter((r) => !existingRecipeIds.has(r.recipe_id))
            if (toInsert.length > 0) {
              const insertRes = await fetch(`${env.POSTGREST_URL}/recipe_categories`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${postgrestToken}`,
                  Prefer: 'return=minimal',
                },
                body: JSON.stringify(
                  toInsert.map((r) => ({ recipe_id: r.recipe_id, category_id: targetId }))
                ),
              })

              if (!insertRes.ok) {
                throw new Error('Kunde inte flytta receptkopplingar')
              }
            }

            // Delete source recipe_categories
            await fetch(`${env.POSTGREST_URL}/recipe_categories?category_id=eq.${sourceId}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${postgrestToken}` },
            })

            // Delete source category
            const deleteRes = await fetch(`${env.POSTGREST_URL}/categories?id=eq.${sourceId}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${postgrestToken}` },
            })

            if (!deleteRes.ok) {
              throw new Error('Kunde inte ta bort källkategori')
            }

            return Response.json({ success: true })
          }

          // Normal create
          const { name, group_id } = body

          if (!name || !name.trim()) {
            return Response.json({ error: 'Namn krävs' }, { status: 400 })
          }

          const createBody: Record<string, string> = { name: name.trim() }
          if (group_id) {
            createBody.group_id = group_id
          }

          const response = await fetch(`${env.POSTGREST_URL}/categories`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${postgrestToken}`,
              Prefer: 'return=minimal',
            },
            body: JSON.stringify(createBody),
          })

          if (!response.ok) {
            const errorText = await response.text()
            throw new Error(errorText || 'Kunde inte skapa kategori')
          }

          return Response.json({ success: true })
        } catch (error) {
          console.error('Create category error:', error)
          return Response.json(
            { error: error instanceof Error ? error.message : 'Kunde inte skapa kategori' },
            { status: 500 }
          )
        }
      },

      // PATCH - Update a category (name and/or group_id)
      PATCH: async ({ request, context }) => {
        try {
          const { postgrestToken } = context

          const body = await request.json()
          const { id, name, group_id } = body

          if (!id) {
            return Response.json({ error: 'ID krävs' }, { status: 400 })
          }

          // Build update payload - at least one field must be provided
          const updateBody: Record<string, string | null> = {}
          if (name !== undefined) {
            if (!name || !name.trim()) {
              return Response.json({ error: 'Namn kan inte vara tomt' }, { status: 400 })
            }
            updateBody.name = name.trim()
          }
          if (group_id !== undefined) {
            updateBody.group_id = group_id || null
          }

          if (Object.keys(updateBody).length === 0) {
            return Response.json({ error: 'Inga fält att uppdatera' }, { status: 400 })
          }

          const response = await fetch(`${env.POSTGREST_URL}/categories?id=eq.${id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${postgrestToken}`,
            },
            body: JSON.stringify(updateBody),
          })

          if (!response.ok) {
            const errorText = await response.text()
            throw new Error(errorText || 'Kunde inte uppdatera kategori')
          }

          return Response.json({ success: true })
        } catch (error) {
          console.error('Update category error:', error)
          return Response.json(
            { error: error instanceof Error ? error.message : 'Kunde inte uppdatera kategori' },
            { status: 500 }
          )
        }
      },

      // DELETE - Delete a category
      DELETE: async ({ request, context }) => {
        try {
          const { postgrestToken } = context

          const { searchParams } = new URL(request.url)
          const id = searchParams.get('id')

          if (!id) {
            return Response.json({ error: 'ID krävs' }, { status: 400 })
          }

          const response = await fetch(`${env.POSTGREST_URL}/categories?id=eq.${id}`, {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${postgrestToken}`,
            },
          })

          if (!response.ok) {
            const errorText = await response.text()
            throw new Error(errorText || 'Kunde inte ta bort kategori')
          }

          return Response.json({ success: true })
        } catch (error) {
          console.error('Delete category error:', error)
          return Response.json(
            { error: error instanceof Error ? error.message : 'Kunde inte ta bort kategori' },
            { status: 500 }
          )
        }
      },
    },
  },
})
