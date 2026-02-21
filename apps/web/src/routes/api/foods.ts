import { createFileRoute } from '@tanstack/react-router'
import { getSession, signPostgrestToken } from '@/lib/auth'
import { env } from '@/lib/env'

interface FoodResult {
  id: string
  name: string
  rank: number
  status?: string
  is_own_pending?: boolean
}

export const Route = createFileRoute('/api/foods')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const searchParams = new URL(request.url).searchParams
        const query = searchParams.get('q') || ''
        const limit = parseInt(searchParams.get('limit') || '10', 10)

        // Return empty array if query is too short
        if (!query || query.length < 1) {
          return Response.json([])
        }

        try {
          // Get user session (optional - unauthenticated users still work)
          const session = await getSession()

          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
          }

          // If authenticated, pass JWT token so RLS works
          if (session) {
            const token = await signPostgrestToken(session.email)
            headers.Authorization = `Bearer ${token}`
          }

          const response = await fetch(`${env.POSTGREST_URL}/rpc/search_foods`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              p_query: query,
              p_limit: limit,
            }),
          })

          if (!response.ok) {
            console.error('PostgREST error:', response.status, response.statusText)
            return Response.json([])
          }

          const data: FoodResult[] = await response.json()

          // Format as { display, value } objects
          const formattedData = data.map((food) => ({
            display: food.is_own_pending ? `${food.name} (väntar)` : food.name,
            value: food.name,
          }))

          return Response.json(formattedData)
        } catch (error) {
          console.error('Error fetching foods:', error)
          return Response.json([])
        }
      },
    },
  },
})
