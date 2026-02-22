import { createFileRoute } from '@tanstack/react-router'
import { deleteCookie } from '@tanstack/react-start/server'
import { apiAuthMiddleware } from '@/lib/middleware'
import { env } from '@/lib/env'
import { logger as rootLogger } from '@/lib/logger'
const logger = rootLogger.child({ module: 'api:user:delete-account' })

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
              logger.error({ status: postgrestResponse.status, errorData, email: context.session?.email }, 'PostgREST delete_account error')
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
              logger.error({ status: postgrestResponse.status, err: parseError instanceof Error ? parseError : String(parseError), email: context.session?.email }, 'PostgREST delete_account error (non-JSON)')
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
          logger.error({ err: error instanceof Error ? error : String(error), email: context.session?.email }, 'Account deletion error')
          return Response.json(
            { error: 'Ett fel uppstod vid radering av konto' },
            { status: 500 },
          )
        }
      },
    },
  },
})
