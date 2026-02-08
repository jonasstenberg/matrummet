import { NextRequest, NextResponse } from 'next/server'
import { signToken } from '@/lib/auth'
import { env } from '@/lib/env'

interface GoogleTokenResponse {
  access_token: string
  id_token: string
  token_type: string
  expires_in: number
}

interface GoogleUserInfo {
  id: string
  email: string
  verified_email: boolean
  name: string
  given_name?: string
  family_name?: string
  picture?: string
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const state = searchParams.get('state')

  // Get origin from Host header (set by nginx) with forwarded protocol
  const host = request.headers.get('host')
  const proto = request.headers.get('x-forwarded-proto') || 'https'
  const origin = host ? `${proto}://${host}` : request.nextUrl.origin

  // Verify state and get returnUrl from cookie
  let returnUrl = '/'
  const oauthStateCookie = request.cookies.get('oauth-state')?.value
  if (oauthStateCookie && state) {
    try {
      const { nonce, returnUrl: storedReturnUrl } = JSON.parse(oauthStateCookie)
      // Verify CSRF nonce matches
      if (nonce === state && storedReturnUrl && typeof storedReturnUrl === 'string') {
        // Ensure returnUrl is a relative path (security: prevent open redirect)
        returnUrl = storedReturnUrl.startsWith('/') ? storedReturnUrl : '/'
      }
    } catch {
      // Invalid cookie data, use default
    }
  }

  if (error) {
    console.error('Google OAuth error:', error)
    return NextResponse.redirect(`${origin}/login?error=oauth_error`)
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code`)
  }

  const clientId = env.GOOGLE_CLIENT_ID
  const clientSecret = env.GOOGLE_SECRET

  if (!clientId || !clientSecret) {
    console.error('Google OAuth credentials not configured')
    return NextResponse.redirect(`${origin}/login?error=config_error`)
  }

  const redirectUri = `${origin}/api/auth/callback/google`

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text()
      console.error('Token exchange failed:', errorData)
      return NextResponse.redirect(`${origin}/login?error=token_error`)
    }

    const tokens: GoogleTokenResponse = await tokenResponse.json()

    // Get user info from Google
    const userInfoResponse = await fetch(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      }
    )

    if (!userInfoResponse.ok) {
      console.error('Failed to get user info')
      return NextResponse.redirect(`${origin}/login?error=userinfo_error`)
    }

    const googleUser: GoogleUserInfo = await userInfoResponse.json()

    // Call PostgREST signup_provider to create/get user
    const postgrestResponse = await fetch(
      `${env.POSTGREST_URL}/rpc/signup_provider`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          p_name: googleUser.name,
          p_email: googleUser.email,
          p_provider: 'google',
        }),
      }
    )

    if (!postgrestResponse.ok) {
      const errorText = await postgrestResponse.text()
      console.error('signup_provider failed:', errorText)
      return NextResponse.redirect(`${origin}/login?error=signup_error`)
    }

    const user = await postgrestResponse.json()

    // Sign JWT with user's email, name, and role
    const token = await signToken({
      email: user.email,
      name: user.name,
      role: user.role,
    })

    // Create redirect response (use returnUrl from OAuth state)
    const response = NextResponse.redirect(`${origin}${returnUrl}`)

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

    // Clear the oauth-state cookie
    response.cookies.delete('oauth-state')

    return response
  } catch (error) {
    console.error('Google OAuth callback error:', error)
    return NextResponse.redirect(`${origin}/login?error=unknown_error`)
  }
}
