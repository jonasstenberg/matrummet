import { createFileRoute } from '@tanstack/react-router'
import { setCookie } from '@tanstack/react-start/server'
import { env } from '@/lib/env'

export const Route = createFileRoute('/api/auth/google')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const clientId = env.GOOGLE_CLIENT_ID

        if (!clientId) {
          return Response.json(
            { error: 'Google OAuth is not configured' },
            { status: 500 },
          )
        }

        const url = new URL(request.url)
        const returnUrl = url.searchParams.get('returnUrl') || '/'

        const host = request.headers.get('host')
        const proto = request.headers.get('x-forwarded-proto') || 'https'
        const origin = host ? `${proto}://${host}` : url.origin
        const redirectUri = `${origin}/api/auth/callback/google`

        const nonce = crypto.randomUUID()

        const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
        googleAuthUrl.searchParams.set('client_id', clientId)
        googleAuthUrl.searchParams.set('redirect_uri', redirectUri)
        googleAuthUrl.searchParams.set('response_type', 'code')
        googleAuthUrl.searchParams.set('scope', 'openid email profile')
        googleAuthUrl.searchParams.set('access_type', 'offline')
        googleAuthUrl.searchParams.set('prompt', 'select_account')
        googleAuthUrl.searchParams.set('state', nonce)

        setCookie('oauth-state', JSON.stringify({ nonce, returnUrl }), {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 10,
          path: '/',
        })

        return new Response(null, {
          status: 302,
          headers: { Location: googleAuthUrl.toString() },
        })
      },
    },
  },
})
