import { NextResponse } from 'next/server'

const POSTGREST_URL = process.env.POSTGREST_URL || 'http://localhost:4444'

export async function GET() {
  try {
    const response = await fetch(
      `${POSTGREST_URL}/categories?select=name&order=name`
    )

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch categories' },
        { status: 500 }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching categories:', error)
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    )
  }
}
