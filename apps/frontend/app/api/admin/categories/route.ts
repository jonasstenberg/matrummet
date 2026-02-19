import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
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

    // Fetch categories with recipe count and group info
    const response = await fetch(
      `${env.POSTGREST_URL}/categories?select=id,name,group_id,recipe_categories(count),category_groups(name,sort_order)&order=name`
    )

    if (!response.ok) {
      throw new Error('Failed to fetch categories')
    }

    const data: Array<{
      id: number
      name: string
      group_id: string | null
      recipe_categories: Array<{ count: number }>
      category_groups: { name: string; sort_order: number } | null
    }> = await response.json()

    // Transform the data to include recipe_count and group_name
    const categoriesWithCount = data.map((cat) => ({
      id: cat.id,
      name: cat.name,
      group_id: cat.group_id,
      recipe_count: cat.recipe_categories?.[0]?.count ?? 0,
      group_name: cat.category_groups?.name ?? null,
      group_sort_order: cat.category_groups?.sort_order ?? 99,
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

// POST - Create a new category or merge categories
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

      // Move all recipe_categories from source to target
      // First, get existing recipe_categories for target to avoid duplicates
      const existingRes = await fetch(
        `${env.POSTGREST_URL}/recipe_categories?category_id=eq.${targetId}&select=recipe_id`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )

      const existingRecipes: Array<{ recipe_id: string }> = existingRes.ok ? await existingRes.json() : []
      const existingRecipeIds = new Set(existingRecipes.map((r) => r.recipe_id))

      // Get source recipe_categories
      const sourceRes = await fetch(
        `${env.POSTGREST_URL}/recipe_categories?category_id=eq.${sourceId}&select=recipe_id`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )

      const sourceRecipes: Array<{ recipe_id: string }> = sourceRes.ok ? await sourceRes.json() : []

      // Insert non-duplicate associations
      const toInsert = sourceRecipes.filter((r) => !existingRecipeIds.has(r.recipe_id))
      if (toInsert.length > 0) {
        const insertRes = await fetch(`${env.POSTGREST_URL}/recipe_categories`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            Prefer: 'return=minimal',
          },
          body: JSON.stringify(
            toInsert.map((r) => ({ recipe_id: r.recipe_id, category_id: targetId }))
          ),
        })

        if (!insertRes.ok) {
          throw new Error('Failed to transfer recipe associations')
        }
      }

      // Delete source recipe_categories
      await fetch(`${env.POSTGREST_URL}/recipe_categories?category_id=eq.${sourceId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      // Delete source category
      const deleteRes = await fetch(`${env.POSTGREST_URL}/categories?id=eq.${sourceId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!deleteRes.ok) {
        throw new Error('Failed to delete source category')
      }

      revalidateTag('categories', 'max')
      return NextResponse.json({ success: true })
    }

    // Normal create
    const { name, group_id } = body

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const createBody: Record<string, string> = { name: name.trim() }
    if (group_id) {
      createBody.group_id = group_id
    }

    const response = await fetch(`${env.POSTGREST_URL}/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(createBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(errorText || 'Failed to create category')
    }

    revalidateTag('categories', 'max')
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Create category error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create category' },
      { status: 500 }
    )
  }
}

// PATCH - Update a category (name and/or group_id)
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
    const { id, name, group_id } = body

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    // Build update payload - at least one field must be provided
    const updateBody: Record<string, string | null> = {}
    if (name !== undefined) {
      if (!name || !name.trim()) {
        return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })
      }
      updateBody.name = name.trim()
    }
    if (group_id !== undefined) {
      updateBody.group_id = group_id || null
    }

    if (Object.keys(updateBody).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const token = await signPostgrestToken(session.email, session.role)

    const response = await fetch(`${env.POSTGREST_URL}/categories?id=eq.${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(updateBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(errorText || 'Failed to update category')
    }

    revalidateTag('categories', 'max')
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

    const token = await signPostgrestToken(session.email, session.role)

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

    revalidateTag('categories', 'max')
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete category error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete category' },
      { status: 500 }
    )
  }
}
