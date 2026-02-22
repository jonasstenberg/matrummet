import { createFileRoute } from '@tanstack/react-router'
import { env } from '@/lib/env'
import { logger as rootLogger } from '@/lib/logger'

const logger = rootLogger.child({ module: 'api:auth:reset-password' })

interface PostgRESTError {
  code: string
  details: string | null
  hint: string | null
  message: string
}

const ERROR_MESSAGES = {
  'invalid-or-expired-token':
    'Ogiltig eller utgången återställningslänk. Begär en ny.',
  'password-not-meet-requirements':
    'Lösenordet måste vara minst 8 tecken och innehålla versaler, gemener och siffror',
} as const

type KnownErrorCode = keyof typeof ERROR_MESSAGES

function isKnownErrorCode(code: string): code is KnownErrorCode {
  return code in ERROR_MESSAGES
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const Route = createFileRoute('/api/auth/reset-password/complete')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json()
          const { token, password } = body

          if (!token || !UUID_REGEX.test(token)) {
            return Response.json(
              { error: 'Ogiltig eller saknad token' },
              { status: 400 },
            )
          }

          if (!password) {
            return Response.json(
              { error: 'Lösenord är obligatoriskt' },
              { status: 400 },
            )
          }

          const postgrestResponse = await fetch(
            `${env.POSTGREST_URL}/rpc/complete_password_reset`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                p_token: token,
                p_new_password: password,
              }),
            },
          )

          if (!postgrestResponse.ok) {
            let errorData: PostgRESTError | null = null
            try {
              errorData = await postgrestResponse.json()
            } catch {
              logger.error({ status: postgrestResponse.status }, 'Password reset completion failed with non-JSON response')
              return Response.json(
                { error: 'Kunde inte återställa lösenordet' },
                { status: 500 },
              )
            }

            logger.error({ detail: errorData }, 'Password reset completion failed')

            if (errorData?.message && isKnownErrorCode(errorData.message)) {
              return Response.json(
                { error: ERROR_MESSAGES[errorData.message] },
                { status: 400 },
              )
            }

            return Response.json(
              { error: 'Kunde inte återställa lösenordet' },
              { status: 500 },
            )
          }

          return Response.json({ success: true })
        } catch (error) {
          logger.error({ err: error instanceof Error ? error : String(error) }, 'Password reset completion error')
          return Response.json({ error: 'Ett fel uppstod' }, { status: 500 })
        }
      },
    },
  },
})
