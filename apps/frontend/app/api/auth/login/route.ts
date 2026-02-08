import { NextRequest, NextResponse } from 'next/server'
import { signToken } from '@/lib/auth'
import { env } from '@/lib/env'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'E-post och lösenord krävs' },
        { status: 400 }
      )
    }

    // Call PostgREST login endpoint
    const postgrestResponse = await fetch(`${env.POSTGREST_URL}/rpc/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        login_email: email,
        login_password: password,
      }),
    })

    if (!postgrestResponse.ok) {
      if (postgrestResponse.status === 401 || postgrestResponse.status === 400) {
        return NextResponse.json(
          { error: 'Fel e-post eller lösenord' },
          { status: 401 }
        )
      }
      throw new Error('Inloggning misslyckades')
    }

    const user = await postgrestResponse.json()

    // Sign JWT with user's email, name, and role
    const token = await signToken({
      email: user.email,
      name: user.name,
      role: user.role,
    })

    // Create response with user data
    const response = NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        measures_system: user.measures_system,
        provider: user.provider,
        owner: user.owner,
        role: user.role,
      },
    })

    // Set httpOnly cookie
    response.cookies.set({
      name: 'auth-token',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    })

    return response
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Ett fel uppstod vid inloggning' },
      { status: 500 }
    )
  }
}
