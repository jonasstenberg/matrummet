import { NextRequest, NextResponse } from 'next/server'
import { getSession, signPostgrestToken } from '@/lib/auth'
import { env } from '@/lib/env'

// GET - Paginated list of foods with search
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
    const status = searchParams.get('status') || null
    const pageSize = 50

    const token = await signPostgrestToken(session.email)

    // Fetch total count
    const countResponse = await fetch(
      `${env.POSTGREST_URL}/rpc/admin_count_foods`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          p_search: search || null,
          p_status: status,
        }),
      }
    )

    if (!countResponse.ok) {
      throw new Error('Failed to fetch food count')
    }

    const total = await countResponse.json()

    // Fetch paginated items
    const offset = (page - 1) * pageSize
    const itemsResponse = await fetch(
      `${env.POSTGREST_URL}/rpc/admin_list_foods`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          p_search: search || null,
          p_status: status,
          p_limit: pageSize,
          p_offset: offset,
        }),
      }
    )

    if (!itemsResponse.ok) {
      throw new Error('Failed to fetch foods')
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
    console.error('Get foods error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch foods' },
      { status: 500 }
    )
  }
}

// POST - Create a new food
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
    const { name } = body

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const token = await signPostgrestToken(session.email)

    const response = await fetch(`${env.POSTGREST_URL}/foods`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ name: name.trim() }),
    })

    if (!response.ok) {
      const errorText = await response.text()

      // Check for duplicate key error
      if (errorText.includes('duplicate key') || errorText.includes('unique constraint')) {
        return NextResponse.json(
          { error: 'En matvara med detta namn finns redan' },
          { status: 409 }
        )
      }

      throw new Error(errorText || 'Failed to create food')
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Create food error:', error)

    if (error instanceof Error && error.message.includes('matvara med detta namn')) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create food' },
      { status: 500 }
    )
  }
}

// PATCH - Update a food
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

    const response = await fetch(`${env.POSTGREST_URL}/foods?id=eq.${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: name.trim() }),
    })

    if (!response.ok) {
      const errorText = await response.text()

      // Check for duplicate key error
      if (errorText.includes('duplicate key') || errorText.includes('unique constraint')) {
        return NextResponse.json(
          { error: 'En matvara med detta namn finns redan' },
          { status: 409 }
        )
      }

      throw new Error(errorText || 'Failed to update food')
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Update food error:', error)

    if (error instanceof Error && error.message.includes('matvara med detta namn')) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update food' },
      { status: 500 }
    )
  }
}

// DELETE - Delete a food
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

    const response = await fetch(`${env.POSTGREST_URL}/foods?id=eq.${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(errorText || 'Failed to delete food')
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete food error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete food' },
      { status: 500 }
    )
  }
}
