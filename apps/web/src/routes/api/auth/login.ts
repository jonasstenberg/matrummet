import { createFileRoute } from '@tanstack/react-router'
import { setCookie } from '@tanstack/react-start/server'
import { signToken } from '@/lib/auth'
import { env } from '@/lib/env'

export const Route = createFileRoute('/api/auth/login')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json()
          const { email, password } = body

          if (!email || !password) {
            return Response.json(
              { error: 'E-post och lösenord krävs' },
              { status: 400 },
            )
          }

          const postgrestResponse = await fetch(`${env.POSTGREST_URL}/rpc/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              login_email: email,
              login_password: password,
            }),
          })

          if (!postgrestResponse.ok) {
            if (postgrestResponse.status === 401 || postgrestResponse.status === 400) {
              return Response.json(
                { error: 'Fel e-post eller lösenord' },
                { status: 401 },
              )
            }
            throw new Error('Inloggning misslyckades')
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

          return Response.json({
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
        } catch (error) {
          console.error('Login error:', error)
          return Response.json(
            { error: 'Ett fel uppstod vid inloggning' },
            { status: 500 },
          )
        }
      },
    },
  },
})
