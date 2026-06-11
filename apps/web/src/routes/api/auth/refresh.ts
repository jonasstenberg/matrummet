import { createFileRoute } from '@tanstack/react-router'
import { getCookie, setCookie } from '@tanstack/react-start/server'
import {
  rotateRefreshToken,
  setSessionCookies,
  getAccessTokenCookieOptions,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from '@/lib/auth'
import { logger as rootLogger } from '@/lib/logger'

const logger = rootLogger.child({ module: 'api:auth:refresh' })

export const Route = createFileRoute('/api/auth/refresh')({
  server: {
    handlers: {
      /**
       * Refresh endpoint for both web (cookie) and mobile (body) clients.
       * Web: reads refresh token from cookie (used by getSession() transparent refresh
       *      is the primary path; this endpoint is a fallback).
       * Mobile: accepts { refresh_token } in request body, returns new tokens.
       */
      POST: async ({ request }) => {
        try {
          let refreshTokenRaw: string | null = null
          let isMobileClient = false

          // Try request body first (mobile)
          const contentType = request.headers.get('content-type')
          if (contentType?.includes('application/json')) {
            try {
              const body = await request.clone().json()
              if (body?.refresh_token && typeof body.refresh_token === 'string') {
                refreshTokenRaw = body.refresh_token
                isMobileClient = true
              }
            } catch {
              // Not valid JSON
            }
          }

          // Fall back to cookie (web)
          if (!refreshTokenRaw) {
            refreshTokenRaw = getCookie(REFRESH_TOKEN_COOKIE) ?? null
          }

          if (!refreshTokenRaw) {
            return Response.json(
              { error: 'Refresh token required' },
              { status: 400 },
            )
          }

          const result = await rotateRefreshToken(refreshTokenRaw)

          if (!result) {
            // Token invalid, expired, or revoked beyond the grace window.
            // Never clear cookies here — that could overwrite a concurrent
            // response's fresh cookies with deleted ones.
            logger.debug('Refresh token rotation returned no session')
            return Response.json(
              { error: 'Invalid or expired refresh token' },
              { status: 401 },
            )
          }

          // refreshRaw is null on grace-window reuse: a concurrent request won
          // the rotation, so its refresh token must be left untouched.
          if (isMobileClient) {
            // Mobile: return tokens in body (refresh_token omitted on grace
            // reuse — the client keeps its stored token)
            logger.debug({ email: result.session.email }, 'Mobile token refreshed')
            return Response.json({
              access_token: result.accessToken,
              ...(result.refreshRaw ? { refresh_token: result.refreshRaw } : {}),
            })
          }

          // Web: set cookies
          if (result.refreshRaw) {
            setSessionCookies(result.accessToken, result.refreshRaw)
          } else {
            setCookie(ACCESS_TOKEN_COOKIE, result.accessToken, getAccessTokenCookieOptions())
          }
          logger.debug({ email: result.session.email }, 'Web token refreshed via API')
          return Response.json({ success: true })
        } catch (error) {
          logger.error({ err: error instanceof Error ? error : String(error) }, 'Token refresh error')
          return Response.json(
            { error: 'Token refresh failed' },
            { status: 500 },
          )
        }
      },
    },
  },
})
