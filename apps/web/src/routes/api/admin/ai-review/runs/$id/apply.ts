import { createFileRoute } from '@tanstack/react-router'
import { apiAdminMiddleware } from '@/lib/middleware'
import { env } from '@/lib/env'
import { logger as rootLogger } from '@/lib/logger'

const logger = rootLogger.child({ module: 'api:admin:ai-review-apply' })

const VALID_DECISIONS = ['approve_alias', 'approve_new', 'reject_food', 'delete_food', 'skip']

/**
 * POST /api/admin/ai-review/runs/$id/apply
 * Apply admin decisions to suggestions.
 * Body: { decisions: Array<{ id: string, action: string }> }
 */
export const Route = createFileRoute('/api/admin/ai-review/runs/$id/apply')({
  server: {
    middleware: [apiAdminMiddleware],
    handlers: {
      POST: async ({ request, params, context }) => {
        const { postgrestToken } = context

        const runId = params.id

        let body: { decisions?: Array<{ id: string; action: string; targetFoodId?: string; targetFoodName?: string }> }
        try {
          body = await request.json()
        } catch {
          return Response.json({ error: 'Invalid request body' }, { status: 400 })
        }

        const decisions = body.decisions ?? []
        if (decisions.length === 0) {
          return Response.json({ error: 'No decisions specified' }, { status: 400 })
        }

        const invalid = decisions.find(d => !VALID_DECISIONS.includes(d.action))
        if (invalid) {
          return Response.json({ error: `Invalid action: ${invalid.action}` }, { status: 400 })
        }

        const results = { applied: 0, skipped: 0, errors: 0 }

        for (const { id: suggestionId, action, targetFoodId, targetFoodName } of decisions) {
          // If admin overrides to alias with a manual target, update suggestion first
          if (action === 'approve_alias' && targetFoodId) {
            const patchRes = await fetch(
              `${env.POSTGREST_URL}/ai_review_suggestions?id=eq.${suggestionId}`,
              {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${postgrestToken}`,
                },
                body: JSON.stringify({
                  target_food_id: targetFoodId,
                  target_food_name: targetFoodName ?? null,
                }),
              }
            )
            if (!patchRes.ok) {
              const errText = await patchRes.text()
              logger.error({ err: errText, suggestionId, runId }, 'Failed to set alias target')
              results.errors++
              continue
            }
          }

          const res = await fetch(`${env.POSTGREST_URL}/rpc/apply_ai_review_suggestion`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${postgrestToken}`,
            },
            body: JSON.stringify({ p_suggestion_id: suggestionId, p_decision: action }),
          })
          if (res.ok) {
            if (action === 'skip') {
              results.skipped++
            } else {
              results.applied++
            }
          } else {
            const errText = await res.text()
            logger.error({ err: errText, action, suggestionId, runId }, 'Failed to apply suggestion')
            results.errors++
          }
        }

        // Update run status
        await fetch(`${env.POSTGREST_URL}/rpc/update_ai_review_run_status`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${postgrestToken}`,
          },
          body: JSON.stringify({ p_run_id: runId }),
        })

        return Response.json(results)
      },
    },
  },
})
