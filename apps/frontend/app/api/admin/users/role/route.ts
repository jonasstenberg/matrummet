import { NextRequest, NextResponse } from 'next/server'
import { getSession, signPostgrestToken } from '@/lib/auth'
import { env } from '@/lib/env'

// PATCH - Update a user's role
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { id, role } = body

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    if (role !== 'user' && role !== 'admin') {
      return NextResponse.json(
        { error: 'Role must be "user" or "admin"' },
        { status: 400 }
      )
    }

    const token = await signPostgrestToken(session.email)

    const response = await fetch(
      `${env.POSTGREST_URL}/rpc/admin_update_user_role`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          p_user_id: id,
          p_new_role: role,
        }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(errorText || 'Failed to update user role')
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Update user role error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update user role' },
      { status: 500 }
    )
  }
}
