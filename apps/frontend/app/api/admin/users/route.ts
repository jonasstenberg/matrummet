import { NextRequest, NextResponse } from 'next/server'
import { getSession, signPostgrestToken } from '@/lib/auth'
import { env } from '@/lib/env'

// GET - Paginated list of users with search and role filter
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
    const page = parseInt(searchParams.get('page') || '1')
    const search = searchParams.get('search') || ''
    const role = searchParams.get('role') || null
    const pageSize = 50

    const token = await signPostgrestToken(session.email)

    // Fetch total count
    const countResponse = await fetch(
      `${env.POSTGREST_URL}/rpc/admin_count_users`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          p_search: search || null,
          p_role: role,
        }),
      }
    )

    if (!countResponse.ok) {
      throw new Error('Failed to fetch user count')
    }

    const total = await countResponse.json()

    // Fetch paginated items
    const offset = (page - 1) * pageSize
    const itemsResponse = await fetch(
      `${env.POSTGREST_URL}/rpc/admin_list_users`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          p_search: search || null,
          p_role: role,
          p_limit: pageSize,
          p_offset: offset,
        }),
      }
    )

    if (!itemsResponse.ok) {
      throw new Error('Failed to fetch users')
    }

    const items = await itemsResponse.json()

    return NextResponse.json({
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (error) {
    console.error('Get users error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}

// PATCH - Update a user's name
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
    const { id, name } = body

    if (!id || !name || !name.trim()) {
      return NextResponse.json(
        { error: 'ID and name are required' },
        { status: 400 }
      )
    }

    const token = await signPostgrestToken(session.email)

    const response = await fetch(
      `${env.POSTGREST_URL}/rpc/admin_update_user`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          p_user_id: id,
          p_name: name.trim(),
        }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(errorText || 'Failed to update user')
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Update user error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update user' },
      { status: 500 }
    )
  }
}

// DELETE - Delete a user
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    const token = await signPostgrestToken(session.email)

    const response = await fetch(
      `${env.POSTGREST_URL}/rpc/admin_delete_user`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          p_user_id: id,
        }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(errorText || 'Failed to delete user')
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete user error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete user' },
      { status: 500 }
    )
  }
}
