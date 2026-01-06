import { NextRequest, NextResponse } from 'next/server'
import { getSession, signPostgrestToken } from '@/lib/auth'
import { env } from '@/lib/env'

// GET - Get recipes that use a specific food
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
    const foodId = searchParams.get('foodId')

    if (!foodId) {
      return NextResponse.json({ error: 'foodId is required' }, { status: 400 })
    }

    const token = await signPostgrestToken(session.email)

    // First get ingredients with this food_id
    const ingredientsResponse = await fetch(
      `${env.POSTGREST_URL}/ingredients?food_id=eq.${foodId}&select=recipe_id`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )

    if (!ingredientsResponse.ok) {
      throw new Error('Failed to fetch ingredients')
    }

    const ingredients = await ingredientsResponse.json()

    // Get unique recipe IDs
    const recipeIds = [...new Set(ingredients.map((i: { recipe_id: string }) => i.recipe_id))]

    if (recipeIds.length === 0) {
      return NextResponse.json([])
    }

    // Fetch recipes by IDs
    const recipesResponse = await fetch(
      `${env.POSTGREST_URL}/recipes?id=in.(${recipeIds.join(',')})&select=id,name&order=name`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )

    if (!recipesResponse.ok) {
      throw new Error('Failed to fetch recipes')
    }

    const recipes = await recipesResponse.json()

    return NextResponse.json(recipes)
  } catch (error) {
    console.error('Get recipes for food error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch recipes' },
      { status: 500 }
    )
  }
}
