import { createFileRoute } from '@tanstack/react-router'
import { deleteCookie } from '@tanstack/react-start/server'

export const Route = createFileRoute('/api/auth/logout')({
  server: {
    handlers: {
      POST: async () => {
        try {
          deleteCookie('auth-token')
          return Response.json({ success: true })
        } catch (error) {
          console.error('Logout error:', error)
          return Response.json(
            { error: 'Ett fel uppstod vid utloggning' },
            { status: 500 },
          )
        }
      },
    },
  },
})
