import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const response = NextResponse.json({ success: true })

    // Delete the auth cookie
    response.cookies.delete('auth-token')

    return response
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json(
      { error: 'Ett fel uppstod vid utloggning' },
      { status: 500 }
    )
  }
}
