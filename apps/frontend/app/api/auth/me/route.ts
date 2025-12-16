import { NextResponse } from 'next/server'
import { getSession, signPostgrestToken } from '@/lib/auth'
import { env } from '@/lib/env'

export async function GET() {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ user: null })
    }

    // Create PostgREST-compatible JWT with the user's email
    const postgrestToken = await signPostgrestToken(session.email)

    // Fetch full user data from PostgREST with authentication
    const response = await fetch(
      `${env.POSTGREST_URL}/users?email=eq.${encodeURIComponent(session.email)}&select=id,name,email,measures_system,provider,owner,role`,
      {
        cache: 'no-store',
        headers: {
          'Authorization': `Bearer ${postgrestToken}`,
        },
      }
    )

    if (!response.ok) {
      return NextResponse.json({ user: null })
    }

    const users = await response.json()
    const user = users[0]

    if (!user) {
      return NextResponse.json({ user: null })
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        measures_system: user.measures_system,
        provider: user.provider,
        owner: user.owner,
        role: user.role,
      },
    })
  } catch (error) {
    console.error('Get session error:', error)
    return NextResponse.json({ user: null })
  }
}
