import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { env } from '@/lib/env'
import { changePasswordSchema } from '@/lib/schemas'

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

    // Validate input
    const body = await request.json()
    const result = changePasswordSchema.safeParse(body)

    if (!result.success) {
      const firstError = result.error.issues[0]
      return NextResponse.json(
        { error: firstError.message },
        { status: 400 }
      )
    }

    const { oldPassword, newPassword } = result.data

    // Call PostgREST reset_password endpoint
    const postgrestResponse = await fetch(
      `${env.POSTGREST_URL}/rpc/reset_password`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          p_email: session.email,
          p_old_password: oldPassword,
          p_new_password: newPassword,
        }),
      }
    )

    if (!postgrestResponse.ok) {
      // Try to parse error response
      let errorMessage = 'Ett fel uppstod vid lösenordsbyte'

      try {
        const errorData = await postgrestResponse.json()
        const dbMessage = errorData?.message || ''

        // Map database errors to Swedish
        if (dbMessage.includes('incorrect-old-password')) {
          errorMessage = 'Nuvarande lösenord är felaktigt'
        } else if (dbMessage.includes('password-not-meet-requirements')) {
          errorMessage = 'Lösenordet uppfyller inte kraven'
        } else if (dbMessage.includes('no-email-found')) {
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

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Password change error:', error)
    return NextResponse.json(
      { error: 'Ett fel uppstod vid lösenordsbyte' },
      { status: 500 }
    )
  }
}
