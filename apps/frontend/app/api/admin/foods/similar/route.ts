import { NextRequest, NextResponse } from 'next/server'
import { getSession, signPostgrestToken } from '@/lib/auth'
import { env } from '@/lib/env'

// GET - Find similar foods
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const name = searchParams.get('name')
    const limit = parseInt(searchParams.get('limit') || '5', 10)

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const token = await signPostgrestToken(session.email, session.role)

    const response = await fetch(`${env.POSTGREST_URL}/rpc/find_similar_foods`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        p_name: name,
        p_limit: limit,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(errorText || 'Failed to find similar foods')
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Find similar foods error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to find similar foods' },
      { status: 500 }
    )
  }
}
