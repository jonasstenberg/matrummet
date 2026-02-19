import { NextRequest, NextResponse } from 'next/server'
import { getSession, signPostgrestToken } from '@/lib/auth'
import { env } from '@/lib/env'

/**
 * GET /api/admin/ai-review/foods?q=...
 * Search approved canonical foods by name (for alias target picker)
 */
export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const q = request.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) {
    return NextResponse.json([])
  }

  const token = await signPostgrestToken(session.email, session.role)

  const res = await fetch(
    `${env.POSTGREST_URL}/foods?name=ilike.*${encodeURIComponent(q)}*&status=eq.approved&canonical_food_id=is.null&select=id,name&order=name&limit=10`,
    { headers: { Authorization: `Bearer ${token}` } }
  )

  if (!res.ok) {
    return NextResponse.json([])
  }

  const foods = await res.json()
  return NextResponse.json(foods)
}
