import { NextRequest, NextResponse } from 'next/server'
import { getSession, signPostgrestToken } from '@/lib/auth'
import { env } from '@/lib/env'

// POST - Set or clear canonical_food_id on an existing food
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

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    const token = await signPostgrestToken(session.email, session.role)

    const response = await fetch(`${env.POSTGREST_URL}/rpc/set_food_canonical`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        p_food_id: id,
        p_canonical_food_id: canonicalFoodId ?? null,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(errorText || 'Failed to set canonical food')
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Set canonical food error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to set canonical food' },
      { status: 500 }
    )
  }
}
