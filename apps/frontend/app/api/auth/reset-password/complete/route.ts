import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/lib/env'

// PostgREST error response structure
interface PostgRESTError {
  code: string
  details: string | null
  hint: string | null
  message: string
}

// Error codes from complete_password_reset PostgreSQL function
// These are the exact strings used in RAISE EXCEPTION statements
const ERROR_MESSAGES = {
  'invalid-or-expired-token':
    'Ogiltig eller utgången återställningslänk. Begär en ny.',
  'password-not-meet-requirements':
    'Lösenordet måste vara minst 8 tecken och innehålla versaler, gemener och siffror',
} as const

type KnownErrorCode = keyof typeof ERROR_MESSAGES

function isKnownErrorCode(code: string): code is KnownErrorCode {
  return code in ERROR_MESSAGES
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, password } = body

    if (!token || !UUID_REGEX.test(token)) {
      return NextResponse.json(
        { error: 'Ogiltig eller saknad token' },
        { status: 400 }
      )
    }

    if (!password) {
      return NextResponse.json(
        { error: 'Lösenord är obligatoriskt' },
        { status: 400 }
      )
    }

    // Call PostgREST RPC function
    const postgrestResponse = await fetch(
      `${env.POSTGREST_URL}/rpc/complete_password_reset`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          p_token: token,
          p_new_password: password,
        }),
      }
    )

    if (!postgrestResponse.ok) {
      // PostgREST returns JSON error responses with code, message, details, hint
      let errorData: PostgRESTError | null = null
      try {
        errorData = await postgrestResponse.json()
      } catch {
        // If response is not JSON, log and return generic error
        console.error(
          'Password reset completion failed with non-JSON response:',
          postgrestResponse.status
        )
        return NextResponse.json(
          { error: 'Kunde inte återställa lösenordet' },
          { status: 500 }
        )
      }

      console.error('Password reset completion failed:', errorData)

      // PostgREST returns the RAISE EXCEPTION message in the 'message' field
      // Check if it matches one of our known error codes
      if (errorData?.message && isKnownErrorCode(errorData.message)) {
        return NextResponse.json(
          { error: ERROR_MESSAGES[errorData.message] },
          { status: 400 }
        )
      }

      // Unknown error - return generic message
      return NextResponse.json(
        { error: 'Kunde inte återställa lösenordet' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Password reset completion error:', error)
    return NextResponse.json({ error: 'Ett fel uppstod' }, { status: 500 })
  }
}
