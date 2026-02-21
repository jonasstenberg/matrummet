import { createFileRoute } from '@tanstack/react-router'
import { apiAdminMiddleware } from '@/lib/middleware'
import { env } from '@/lib/env'

/**
 * GET /api/admin/ai-review/runs
 * Returns the latest run with its suggestions
 */
export const Route = createFileRoute('/api/admin/ai-review/runs')({
  server: {
    middleware: [apiAdminMiddleware],
    handlers: {
      GET: async ({ context }) => {
        const { postgrestToken } = context

        // Get latest run + pending food count in parallel
        const [runRes, countRes] = await Promise.all([
          fetch(
            `${env.POSTGREST_URL}/ai_review_runs?order=started_at.desc&limit=1`,
            { headers: { Authorization: `Bearer ${postgrestToken}` } }
          ),
          fetch(`${env.POSTGREST_URL}/foods?status=eq.pending`, {
            headers: {
              Authorization: `Bearer ${postgrestToken}`,
              Prefer: 'count=exact',
              Range: '0-0',
            },
          }),
        ])

        const pendingCount = parseInt(countRes.headers.get('content-range')?.split('/')[1] || '0')

        if (!runRes.ok) {
          return Response.json({ error: 'Failed to fetch runs' }, { status: 500 })
        }

        const runs = await runRes.json()
        if (runs.length === 0) {
          return Response.json({ run: null, suggestions: [], pendingCount })
        }

        const run = runs[0]

        // Get suggestions for this run
        const suggestionsRes = await fetch(
          `${env.POSTGREST_URL}/ai_review_suggestions?run_id=eq.${run.id}&order=suggested_action,food_name`,
          { headers: { Authorization: `Bearer ${postgrestToken}` } }
        )

        const suggestions = suggestionsRes.ok ? await suggestionsRes.json() : []

        return Response.json({ run, suggestions, pendingCount })
      },
    },
  },
})
