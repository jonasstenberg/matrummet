import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/lib/env'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json(
        { error: 'E-post är obligatoriskt' },
        { status: 400 }
      )
    }

    // Get the app URL for the reset link
    const appUrl = env.APP_URL || request.nextUrl.origin

    // Call PostgREST RPC function
    const postgrestResponse = await fetch(
      `${env.POSTGREST_URL}/rpc/request_password_reset`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          p_email: email,
          p_app_url: appUrl,
        }),
      }
    )

    if (!postgrestResponse.ok) {
      // Log error for debugging but don't expose details to client
      console.error(
        'Password reset request failed:',
        await postgrestResponse.text()
      )
    }

    // Always return success for security (don't reveal if email exists)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Password reset error:', error)
    // Still return success for security
    return NextResponse.json({ success: true })
  }
}
