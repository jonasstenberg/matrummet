import { createFileRoute } from '@tanstack/react-router'
import { getCookie, setCookie, deleteCookie } from '@tanstack/react-start/server'
import { signToken } from '@/lib/auth'
import { env } from '@/lib/env'
import { logger as rootLogger } from '@/lib/logger'

const logger = rootLogger.child({ module: 'api:auth:google-callback' })

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

export const Route = createFileRoute('/api/auth/callback/google')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const code = url.searchParams.get('code')
        const error = url.searchParams.get('error')
        const state = url.searchParams.get('state')

        const host = request.headers.get('host')
        const proto = request.headers.get('x-forwarded-proto') || 'https'
        const origin = host ? `${proto}://${host}` : url.origin

        // Verify state and get returnUrl from cookie
        let returnUrl = '/'
        const oauthStateCookie = getCookie('oauth-state')
        if (oauthStateCookie && state) {
          try {
            const { nonce, returnUrl: storedReturnUrl } = JSON.parse(oauthStateCookie)
            if (nonce === state && storedReturnUrl && typeof storedReturnUrl === 'string') {
              returnUrl = storedReturnUrl.startsWith('/') ? storedReturnUrl : '/'
            }
          } catch {
            // Invalid cookie data, use default
          }
        }

        if (error) {
          logger.error({ detail: error }, 'Google OAuth error')
          return new Response(null, {
            status: 302,
            headers: { Location: `${origin}/login?error=oauth_error` },
          })
        }

        if (!code) {
          return new Response(null, {
            status: 302,
            headers: { Location: `${origin}/login?error=no_code` },
          })
        }

        const clientId = env.GOOGLE_CLIENT_ID
        const clientSecret = env.GOOGLE_SECRET

        if (!clientId || !clientSecret) {
          logger.error('Google OAuth credentials not configured')
          return new Response(null, {
            status: 302,
            headers: { Location: `${origin}/login?error=config_error` },
          })
        }

        const redirectUri = `${origin}/api/auth/callback/google`

        try {
          // Exchange code for tokens
          const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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
            logger.error({ responseBody: errorData }, 'Token exchange failed')
            return new Response(null, {
              status: 302,
              headers: { Location: `${origin}/login?error=token_error` },
            })
          }

          const tokens: GoogleTokenResponse = await tokenResponse.json()

          // Get user info from Google
          const userInfoResponse = await fetch(
            'https://www.googleapis.com/oauth2/v2/userinfo',
            { headers: { Authorization: `Bearer ${tokens.access_token}` } },
          )

          if (!userInfoResponse.ok) {
            logger.error('Failed to get user info')
            return new Response(null, {
              status: 302,
              headers: { Location: `${origin}/login?error=userinfo_error` },
            })
          }

          const googleUser: GoogleUserInfo = await userInfoResponse.json()

          // Call PostgREST signup_provider to create/get user
          const postgrestResponse = await fetch(
            `${env.POSTGREST_URL}/rpc/signup_provider`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                p_name: googleUser.name,
                p_email: googleUser.email,
                p_provider: 'google',
              }),
            },
          )

          if (!postgrestResponse.ok) {
            const errorText = await postgrestResponse.text()
            logger.error({ responseBody: errorText, email: googleUser.email }, 'signup_provider failed')
            return new Response(null, {
              status: 302,
              headers: { Location: `${origin}/login?error=signup_error` },
            })
          }

          const user = await postgrestResponse.json()

          const token = await signToken({
            email: user.email,
            name: user.name,
            role: user.role,
          })

          setCookie('auth-token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7,
            path: '/',
          })

          deleteCookie('oauth-state')

          logger.info({ email: user.email }, 'Google OAuth login successful')
          return new Response(null, {
            status: 302,
            headers: { Location: `${origin}${returnUrl}` },
          })
        } catch (error) {
          logger.error({ err: error instanceof Error ? error : String(error) }, 'Google OAuth callback error')
          return new Response(null, {
            status: 302,
            headers: { Location: `${origin}/login?error=unknown_error` },
          })
        }
      },
    },
  },
})
