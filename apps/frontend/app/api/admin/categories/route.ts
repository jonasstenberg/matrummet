import { NextRequest, NextResponse } from 'next/server'
import { getSession, signPostgrestToken } from '@/lib/auth'
import { env } from '@/lib/env'

// GET - List all categories with recipe count
export async function GET() {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch categories with recipe count
    const response = await fetch(
      `${env.POSTGREST_URL}/categories?select=id,name,recipe_categories(count)&order=name`
    )

    if (!response.ok) {
      throw new Error('Failed to fetch categories')
    }

    const data = await response.json()

    // Transform the data to include recipe_count
    const categoriesWithCount = data.map((cat: any) => ({
      id: cat.id,
      name: cat.name,
      recipe_count: cat.recipe_categories?.[0]?.count ?? 0,
    }))

    return NextResponse.json(categoriesWithCount)
  } catch (error) {
    console.error('Get categories error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    )
  }
}

// POST - Create a new category
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

    const response = await fetch(`${env.POSTGREST_URL}/categories`, {
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
      throw new Error(errorText || 'Failed to create category')
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Create category error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create category' },
      { status: 500 }
    )
  }
}

// PATCH - Update a category
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

    const response = await fetch(`${env.POSTGREST_URL}/categories?id=eq.${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: name.trim() }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(errorText || 'Failed to update category')
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Update category error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update category' },
      { status: 500 }
    )
  }
}

// DELETE - Delete a category
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

    const response = await fetch(`${env.POSTGREST_URL}/categories?id=eq.${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(errorText || 'Failed to delete category')
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete category error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete category' },
      { status: 500 }
    )
  }
}
