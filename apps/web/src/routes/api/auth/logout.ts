import { createFileRoute } from '@tanstack/react-router'
import { getCookie } from '@tanstack/react-start/server'
import {
  clearSessionCookies,
  revokeSingleRefreshToken,
  REFRESH_TOKEN_COOKIE,
} from '@/lib/auth'
import { logger as rootLogger } from '@/lib/logger'

const logger = rootLogger.child({ module: 'api:auth:logout' })

export const Route = createFileRoute('/api/auth/logout')({
  server: {
    handlers: {
      POST: async () => {
        try {
          // Revoke the current device's refresh token
          const refreshTokenRaw = getCookie(REFRESH_TOKEN_COOKIE)
          if (refreshTokenRaw) {
            await revokeSingleRefreshToken(refreshTokenRaw)
          }

          clearSessionCookies()
          return Response.json({ success: true })
        } catch (error) {
          logger.error({ err: error instanceof Error ? error : String(error) }, 'Logout error')
          // Still clear cookies on error
          clearSessionCookies()
          return Response.json({ success: true })
        }
      },
    },
  },
})
