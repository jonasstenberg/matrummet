import { NextResponse } from 'next/server'
import { getSession, signPostgrestToken } from '@/lib/auth'
import { env } from '@/lib/env'

export async function POST() {
  try {
    // Validate session
    const session = await getSession()
    if (!session) {
      return NextResponse.json(
        { error: 'Ej autentiserad' },
        { status: 401 }
      )
    }

    // Create a PostgREST token for the authenticated user
    const postgrestToken = await signPostgrestToken(session.email)

    // Call PostgREST delete_account endpoint
    const postgrestResponse = await fetch(
      `${env.POSTGREST_URL}/rpc/delete_account`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${postgrestToken}`,
        },
        body: JSON.stringify({}),
      }
    )

    if (!postgrestResponse.ok) {
      let errorMessage = 'Ett fel uppstod vid radering av konto'

      try {
        const errorData = await postgrestResponse.json()
        const dbMessage = errorData?.message || ''

        if (dbMessage.includes('not-authenticated')) {
          errorMessage = 'Ej autentiserad'
        } else if (dbMessage.includes('user-not-found')) {
          errorMessage = 'Användaren hittades inte'
        }
      } catch {
        // If parsing fails, use default error message
      }

      return NextResponse.json(
        { error: errorMessage },
        { status: 400 }
      )
    }

    // Clear the auth cookie on success
    const response = NextResponse.json({ success: true })
    response.cookies.delete('auth-token')

    return response
  } catch (error) {
    console.error('Account deletion error:', error)
    return NextResponse.json(
      { error: 'Ett fel uppstod vid radering av konto' },
      { status: 500 }
    )
  }
}
