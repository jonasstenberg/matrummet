import { NextResponse } from 'next/server'
import { getSession, signPostgrestToken } from '@/lib/auth'
import { env } from '@/lib/env'

/**
 * GET /api/admin/ai-review/runs
 * Returns the latest run with its suggestions
 */
export async function GET() {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = await signPostgrestToken(session.email, session.role)

  // Get latest run + pending food count in parallel
  const [runRes, countRes] = await Promise.all([
    fetch(
      `${env.POSTGREST_URL}/ai_review_runs?order=started_at.desc&limit=1`,
      { headers: { Authorization: `Bearer ${token}` } }
    ),
    fetch(`${env.POSTGREST_URL}/foods?status=eq.pending`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Prefer: 'count=exact',
        Range: '0-0',
      },
    }),
  ])

  const pendingCount = parseInt(countRes.headers.get('content-range')?.split('/')[1] || '0')

  if (!runRes.ok) {
    return NextResponse.json({ error: 'Failed to fetch runs' }, { status: 500 })
  }

  const runs = await runRes.json()
  if (runs.length === 0) {
    return NextResponse.json({ run: null, suggestions: [], pendingCount })
  }

  const run = runs[0]

  // Get suggestions for this run
  const suggestionsRes = await fetch(
    `${env.POSTGREST_URL}/ai_review_suggestions?run_id=eq.${run.id}&order=suggested_action,food_name`,
    { headers: { Authorization: `Bearer ${token}` } }
  )

  const suggestions = suggestionsRes.ok ? await suggestionsRes.json() : []

  return NextResponse.json({ run, suggestions, pendingCount })
}
