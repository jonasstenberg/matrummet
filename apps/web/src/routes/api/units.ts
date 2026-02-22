import { createFileRoute } from '@tanstack/react-router'
import { getSession, signPostgrestToken } from '@/lib/auth'
import { env } from '@/lib/env'
import { logger as rootLogger } from '@/lib/logger'
const logger = rootLogger.child({ module: 'api:units' })

type Unit = {
  id: string
  name: string
  plural: string
  abbreviation: string
  rank: number
}

export const Route = createFileRoute('/api/units')({
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
          const session = await getSession()

          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
          }

          if (session) {
            const token = await signPostgrestToken(session.email)
            headers.Authorization = `Bearer ${token}`
          }

          const response = await fetch(`${env.POSTGREST_URL}/rpc/search_units`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              p_query: query,
              p_limit: limit,
            }),
          })

          if (!response.ok) {
            logger.error({ status: response.status, statusText: response.statusText }, 'PostgREST error')
            return Response.json([])
          }

          const data: Unit[] = await response.json()

          // Format as { display, value } objects
          const formattedData = data.map((unit) => ({
            display: unit.abbreviation
              ? `${unit.abbreviation} (${unit.name})`
              : unit.name,
            value: unit.abbreviation || unit.name,
          }))

          return Response.json(formattedData)
        } catch (error) {
          logger.error({ err: error instanceof Error ? error : String(error) }, 'Error fetching units')
          return Response.json([])
        }
      },
    },
  },
})
