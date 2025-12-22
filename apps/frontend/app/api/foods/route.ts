import { NextRequest, NextResponse } from 'next/server'
import { getSession, signPostgrestToken } from '@/lib/auth'
import { env } from '@/lib/env'

interface FoodResult {
  id: string
  name: string
  status?: string
  is_own_pending?: boolean
}

interface FoodWithDisplay extends FoodResult {
  displayName: string
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q') || ''
  const limit = parseInt(searchParams.get('limit') || '10', 10)

  // Return empty array if query is too short
  if (!query || query.length < 1) {
    return NextResponse.json([])
  }

  try {
    // Get user session (optional - unauthenticated users still work)
    const session = await getSession()

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    // If authenticated, pass JWT token so RLS works
    if (session) {
      const token = await signPostgrestToken(session.email)
      headers.Authorization = `Bearer ${token}`
    }

    const response = await fetch(`${env.POSTGREST_URL}/rpc/search_foods`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        p_query: query,
        p_limit: limit,
      }),
    })

    if (!response.ok) {
      console.error('PostgREST error:', response.status, response.statusText)
      return NextResponse.json([])
    }

    const data: FoodResult[] = await response.json()

    // Map the response to include displayName with "(väntar godkännande)" suffix for pending foods
    const mappedData: FoodWithDisplay[] = data.map((food) => ({
      ...food,
      displayName:
        food.status === 'pending' || food.is_own_pending
          ? `${food.name} (väntar godkännande)`
          : food.name,
    }))

    return NextResponse.json(mappedData)
  } catch (error) {
    console.error('Error fetching foods:', error)
    return NextResponse.json([])
  }
}
