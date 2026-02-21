import { createFileRoute } from '@tanstack/react-router'
import { setCookie } from '@tanstack/react-start/server'
import { signToken } from '@/lib/auth'
import { env } from '@/lib/env'

export const Route = createFileRoute('/api/auth/registrera')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json()
          const { name, email, password } = body

          if (!name || !email || !password) {
            return Response.json(
              { error: 'Namn, e-post och lösenord krävs' },
              { status: 400 },
            )
          }

          const response = await fetch(`${env.POSTGREST_URL}/rpc/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
              if (errorText.includes('already exists') || errorText.includes('duplicate')) {
                return Response.json(
                  { error: 'E-postadressen är redan registrerad' },
                  { status: 400 },
                )
              }
              if (errorText.includes('password') || errorText.includes('lösenord')) {
                return Response.json(
                  { error: 'Lösenordet uppfyller inte kraven: minst 8 tecken, en versal, en gemen och en siffra' },
                  { status: 400 },
                )
              }
            }

            return Response.json(
              { error: 'Registrering misslyckades' },
              { status: response.status },
            )
          }

          const user = await response.json()

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
          console.error('Signup error:', error)
          return Response.json(
            { error: 'Ett fel uppstod vid registrering' },
            { status: 500 },
          )
        }
      },
    },
  },
})
