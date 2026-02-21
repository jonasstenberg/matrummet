import { createFileRoute } from '@tanstack/react-router'
import { apiAdminMiddleware } from '@/lib/middleware'
import { env } from '@/lib/env'

/**
 * GET /api/admin/ai-review/foods?q=...
 * Search approved canonical foods by name (for alias target picker)
 */
export const Route = createFileRoute('/api/admin/ai-review/foods')({
  server: {
    middleware: [apiAdminMiddleware],
    handlers: {
      GET: async ({ request, context }) => {
        const { postgrestToken } = context

        const { searchParams } = new URL(request.url)
        const q = searchParams.get('q')?.trim()
        if (!q || q.length < 2) {
          return Response.json([])
        }

        const res = await fetch(
          `${env.POSTGREST_URL}/foods?name=ilike.*${encodeURIComponent(q)}*&status=eq.approved&canonical_food_id=is.null&select=id,name&order=name&limit=10`,
          { headers: { Authorization: `Bearer ${postgrestToken}` } }
        )

        if (!res.ok) {
          return Response.json([])
        }

        const foods = await res.json()
        return Response.json(foods)
      },
    },
  },
})
