import { createFileRoute } from '@tanstack/react-router'
import { deleteCookie } from '@tanstack/react-start/server'
import { logger as rootLogger } from '@/lib/logger'

const logger = rootLogger.child({ module: 'api:auth:logout' })

export const Route = createFileRoute('/api/auth/logout')({
  server: {
    handlers: {
      POST: async () => {
        try {
          deleteCookie('auth-token')
          return Response.json({ success: true })
        } catch (error) {
          logger.error({ err: error instanceof Error ? error : String(error) }, 'Logout error')
          return Response.json(
            { error: 'Ett fel uppstod vid utloggning' },
            { status: 500 },
          )
        }
      },
    },
  },
})
