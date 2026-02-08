import { NextRequest, NextResponse } from 'next/server'
import { validatePasswordResetToken } from '@/lib/api'

interface ValidateTokenRequest {
  token: string
}

export async function POST(request: NextRequest) {
  try {
    const body: ValidateTokenRequest = await request.json()
    const { token } = body

    if (!token) {
      return NextResponse.json(
        { valid: false, error: 'Token saknas' },
        { status: 400 }
      )
    }

    const result = await validatePasswordResetToken(token)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Token validation error:', error)
    return NextResponse.json(
      { valid: false, error: 'Ett fel uppstod' },
      { status: 500 }
    )
  }
}
