import { NextRequest, NextResponse } from 'next/server'
import { getSession, signPostgrestToken } from '@/lib/auth'
import { env } from '@/lib/env'

// GET - List units with pagination, search, and filter
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
    const page = parseInt(searchParams.get('page') || '1', 10)
    const search = searchParams.get('search') || ''
    const filter = searchParams.get('filter') || 'all'
    const pageSize = 50
    const offset = (page - 1) * pageSize

    const token = await signPostgrestToken(session.email, session.role)

    // Fetch units
    const unitsResponse = await fetch(
      `${env.POSTGREST_URL}/rpc/admin_list_units`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          p_search: search || null,
          p_limit: pageSize,
          p_offset: offset,
        }),
      }
    )

    if (!unitsResponse.ok) {
      throw new Error('Failed to fetch units')
    }

    let items = await unitsResponse.json()

    // Apply client-side filter for unused/missing abbreviation
    if (filter === 'unused') {
      items = items.filter((u: { ingredient_count: number }) => u.ingredient_count === 0)
    } else if (filter === 'missing_abbreviation') {
      items = items.filter((u: { abbreviation: string }) => !u.abbreviation)
    }

    // Fetch total count
    const countResponse = await fetch(
      `${env.POSTGREST_URL}/rpc/admin_count_units`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          p_search: search || null,
        }),
      }
    )

    if (!countResponse.ok) {
      throw new Error('Failed to fetch unit count')
    }

    const total = await countResponse.json()
    const totalPages = Math.ceil(total / pageSize)

    return NextResponse.json({
      items,
      total: filter === 'all' ? total : items.length,
      page,
      pageSize,
      totalPages: filter === 'all' ? totalPages : 1,
    })
  } catch (error) {
    console.error('Get units error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch units' },
      { status: 500 }
    )
  }
}

// POST - Create a new unit or merge units
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
    const token = await signPostgrestToken(session.email, session.role)

    // Handle merge action
    if (body.action === 'merge') {
      const { sourceId, targetId } = body

      if (!sourceId || !targetId) {
        return NextResponse.json({ error: 'sourceId and targetId are required' }, { status: 400 })
      }

      // Update all ingredients from source unit to target unit
      const updateRes = await fetch(
        `${env.POSTGREST_URL}/ingredients?unit_id=eq.${sourceId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ unit_id: targetId }),
        }
      )

      if (!updateRes.ok) {
        throw new Error('Failed to transfer ingredients')
      }

      // Delete source unit
      const deleteRes = await fetch(`${env.POSTGREST_URL}/units?id=eq.${sourceId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!deleteRes.ok) {
        throw new Error('Failed to delete source unit')
      }

      return NextResponse.json({ success: true })
    }

    // Normal create
    const { name, plural, abbreviation } = body

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    if (!plural || !plural.trim()) {
      return NextResponse.json({ error: 'Plural is required' }, { status: 400 })
    }

    const response = await fetch(`${env.POSTGREST_URL}/units`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        name: name.trim(),
        plural: plural.trim(),
        abbreviation: (abbreviation || '').trim(),
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      // Check for duplicate key error
      if (errorText.includes('duplicate key') || errorText.includes('unique constraint')) {
        return NextResponse.json(
          { error: 'En enhet med detta namn finns redan' },
          { status: 400 }
        )
      }
      throw new Error(errorText || 'Failed to create unit')
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Create unit error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create unit' },
      { status: 500 }
    )
  }
}

// PATCH - Update a unit
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
    const { id, name, plural, abbreviation } = body

    if (!id || !name || !name.trim() || !plural || !plural.trim()) {
      return NextResponse.json(
        { error: 'ID, name, and plural are required' },
        { status: 400 }
      )
    }

    const token = await signPostgrestToken(session.email, session.role)

    const response = await fetch(`${env.POSTGREST_URL}/units?id=eq.${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: name.trim(),
        plural: plural.trim(),
        abbreviation: (abbreviation || '').trim(),
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      // Check for duplicate key error
      if (errorText.includes('duplicate key') || errorText.includes('unique constraint')) {
        return NextResponse.json(
          { error: 'En enhet med detta namn finns redan' },
          { status: 400 }
        )
      }
      throw new Error(errorText || 'Failed to update unit')
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Update unit error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update unit' },
      { status: 500 }
    )
  }
}

// DELETE - Delete a unit
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

    const token = await signPostgrestToken(session.email, session.role)

    const response = await fetch(`${env.POSTGREST_URL}/units?id=eq.${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(errorText || 'Failed to delete unit')
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete unit error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete unit' },
      { status: 500 }
    )
  }
}
