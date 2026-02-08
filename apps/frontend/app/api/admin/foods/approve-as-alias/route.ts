import { NextRequest, NextResponse } from 'next/server'
import { getSession, signPostgrestToken } from '@/lib/auth'
import { env } from '@/lib/env'

// POST - Approve a pending food as an alias of a canonical food
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { id, canonicalFoodId } = body

    if (!id || !canonicalFoodId) {
      return NextResponse.json(
        { error: 'Both id and canonicalFoodId are required' },
        { status: 400 }
      )
    }

    const token = await signPostgrestToken(session.email, session.role)

    const response = await fetch(`${env.POSTGREST_URL}/rpc/approve_food_as_alias`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        p_food_id: id,
        p_canonical_food_id: canonicalFoodId,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(errorText || 'Failed to approve food as alias')
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Approve food as alias error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to approve food as alias' },
      { status: 500 }
    )
  }
}
