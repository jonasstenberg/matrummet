import { NextRequest, NextResponse } from 'next/server'
import { signToken } from '@/lib/auth'
import { env } from '@/lib/env'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, password } = body

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Namn, e-post och lösenord krävs' },
        { status: 400 }
      )
    }

    // Call PostgREST signup endpoint
    const response = await fetch(`${env.POSTGREST_URL}/rpc/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_name: name,
        p_email: email,
        p_password: password,
        p_provider: null,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()

      if (response.status === 400) {
        // Check for common error messages
        if (errorText.includes('already exists') || errorText.includes('duplicate')) {
          return NextResponse.json(
            { error: 'E-postadressen är redan registrerad' },
            { status: 400 }
          )
        }
        if (errorText.includes('password') || errorText.includes('lösenord')) {
          return NextResponse.json(
            { error: 'Lösenordet uppfyller inte kraven: minst 8 tecken, en versal, en gemen och en siffra' },
            { status: 400 }
          )
        }
      }

      return NextResponse.json(
        { error: 'Registrering misslyckades' },
        { status: response.status }
      )
    }

    const user = await response.json()

    // Automatically log them in by signing JWT
    const token = await signToken({
      email: user.email,
      name: user.name,
      role: user.role,
    })

    // Create response with user data
    const apiResponse = NextResponse.json({
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

    // Set httpOnly cookie using object format on the response
    apiResponse.cookies.set({
      name: 'auth-token',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    })

    return apiResponse
  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json(
      { error: 'Ett fel uppstod vid registrering' },
      { status: 500 }
    )
  }
}
