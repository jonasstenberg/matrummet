import { NextRequest, NextResponse } from 'next/server'
import { getSession, signPostgrestToken, signToken } from '@/lib/auth'
import { env } from '@/lib/env'
import { updateProfileSchema } from '@/lib/schemas'

export async function PATCH(request: NextRequest) {
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
    const result = updateProfileSchema.safeParse(body)

    if (!result.success) {
      const firstError = result.error.issues[0]
      return NextResponse.json(
        { error: firstError.message },
        { status: 400 }
      )
    }

    const { name } = result.data

    // Get PostgREST token for authenticated request
    const postgrestToken = await signPostgrestToken(session.email)

    // Update user in database
    const postgrestResponse = await fetch(
      `${env.POSTGREST_URL}/users?email=eq.${encodeURIComponent(session.email)}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${postgrestToken}`,
          'Prefer': 'return=representation',
        },
        body: JSON.stringify({ name }),
      }
    )

    if (!postgrestResponse.ok) {
      const errorText = await postgrestResponse.text()
      console.error('PostgREST error:', postgrestResponse.status, errorText)
      throw new Error('Uppdatering misslyckades')
    }

    const updatedUsers = await postgrestResponse.json()
    const updatedUser = updatedUsers[0]

    if (!updatedUser) {
      throw new Error('Användaren hittades inte')
    }

    // Re-sign JWT with updated name
    const token = await signToken({
      email: updatedUser.email,
      name: updatedUser.name,
      role: updatedUser.role,
    })

    // Create response with updated user data
    const response = NextResponse.json({
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        measures_system: updatedUser.measures_system,
        provider: updatedUser.provider,
        owner: updatedUser.owner,
        role: updatedUser.role,
      },
    })

    // Set new httpOnly cookie
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
    console.error('Profile update error:', error)
    return NextResponse.json(
      { error: 'Ett fel uppstod vid uppdatering av profil' },
      { status: 500 }
    )
  }
}
