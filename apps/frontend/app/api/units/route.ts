import { NextRequest, NextResponse } from 'next/server'
import { getSession, signPostgrestToken } from '@/lib/auth'
import { env } from '@/lib/env'

type Unit = {
  id: string
  name: string
  plural: string
  abbreviation: string
  rank: number
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
    const session = await getSession()

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (session) {
      const token = await signPostgrestToken(session.email)
      headers.Authorization = `Bearer ${token}`
    }

    const response = await fetch(`${env.POSTGREST_URL}/rpc/search_units`, {
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

    const data: Unit[] = await response.json()

    // Format as { display, value } objects
    const formattedData = data.map((unit) => ({
      display: unit.abbreviation
        ? `${unit.abbreviation} (${unit.name})`
        : unit.name,
      value: unit.abbreviation || unit.name,
    }))

    return NextResponse.json(formattedData)
  } catch (error) {
    console.error('Error fetching units:', error)
    return NextResponse.json([])
  }
}
