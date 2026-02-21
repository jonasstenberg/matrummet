import { createFileRoute } from '@tanstack/react-router'
import { deleteCookie } from '@tanstack/react-start/server'
import { apiAuthMiddleware } from '@/lib/middleware'
import { env } from '@/lib/env'

interface DeleteAccountBody {
  password: string | null
  deleteData: boolean
}

export const Route = createFileRoute('/api/user/delete-account')({
  server: {
    middleware: [apiAuthMiddleware],
    handlers: {
      POST: async ({ request, context }) => {
        try {
          const { postgrestToken } = context

          // Parse request body
          let body: DeleteAccountBody
          try {
            body = await request.json()
          } catch {
            body = { password: null, deleteData: false }
          }

          // Call PostgREST delete_account endpoint with password
          const postgrestResponse = await fetch(
            `${env.POSTGREST_URL}/rpc/delete_account`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${postgrestToken}`,
              },
              body: JSON.stringify({
                p_password: body.password,
                p_delete_data: body.deleteData ?? false,
              }),
            },
          )

          if (!postgrestResponse.ok) {
            let errorMessage = 'Ett fel uppstod vid radering av konto'

            try {
              const errorData = await postgrestResponse.json()
              console.error('PostgREST delete_account error:', postgrestResponse.status, JSON.stringify(errorData))
              const dbMessage = errorData?.message || ''

              if (dbMessage.includes('not-authenticated')) {
                errorMessage = 'Ej autentiserad'
              } else if (dbMessage.includes('user-not-found')) {
                errorMessage = 'Användaren hittades inte'
              } else if (dbMessage.includes('invalid-password')) {
                errorMessage = 'Fel lösenord'
              } else if (dbMessage.includes('password-required')) {
                errorMessage = 'Lösenord krävs'
              }
            } catch (parseError) {
              console.error('PostgREST delete_account error (non-JSON):', postgrestResponse.status, parseError)
            }

            return Response.json(
              { error: errorMessage },
              { status: 400 },
            )
          }

          // Clear the auth cookie on success
          deleteCookie('auth-token')

          return Response.json({ success: true })
        } catch (error) {
          console.error('Account deletion error:', error)
          return Response.json(
            { error: 'Ett fel uppstod vid radering av konto' },
            { status: 500 },
          )
        }
      },
    },
  },
})
