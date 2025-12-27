import { NextRequest, NextResponse } from 'next/server'
import { getSession, signPostgrestToken } from '@/lib/auth'
import { env } from '@/lib/env'

interface DeleteAccountBody {
  password: string | null
}

export async function POST(request: NextRequest) {
  try {
    // Validate session
    const session = await getSession()
    if (!session) {
      return NextResponse.json(
        { error: 'Ej autentiserad' },
        { status: 401 }
      )
    }

    // Parse request body
    let body: DeleteAccountBody
    try {
      body = await request.json()
    } catch {
      body = { password: null }
    }

    // Create a PostgREST token for the authenticated user
    const postgrestToken = await signPostgrestToken(session.email)

    // Call PostgREST delete_account endpoint with password
    const postgrestResponse = await fetch(
      `${env.POSTGREST_URL}/rpc/delete_account`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${postgrestToken}`,
        },
        body: JSON.stringify({ p_password: body.password }),
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
        } else if (dbMessage.includes('invalid-password')) {
          errorMessage = 'Fel lösenord'
        } else if (dbMessage.includes('password-required')) {
          errorMessage = 'Lösenord krävs'
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
