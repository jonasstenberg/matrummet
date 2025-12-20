import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/lib/env'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q') || ''
  const limit = parseInt(searchParams.get('limit') || '10', 10)

  // Return empty array if query is too short
  if (!query || query.length < 1) {
    return NextResponse.json([])
  }

  try {
    const response = await fetch(`${env.POSTGREST_URL}/rpc/search_foods`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_query: query,
        p_limit: limit,
      }),
    })

    if (!response.ok) {
      console.error('PostgREST error:', response.status, response.statusText)
      return NextResponse.json([])
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching foods:', error)
    return NextResponse.json([])
  }
}
