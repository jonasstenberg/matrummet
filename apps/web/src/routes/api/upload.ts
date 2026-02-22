import { createFileRoute } from '@tanstack/react-router'
import { apiAuthMiddleware } from '@/lib/middleware'
import { logger as rootLogger } from '@/lib/logger'
const logger = rootLogger.child({ module: 'api:upload' })

export const Route = createFileRoute('/api/upload')({
  server: {
    middleware: [apiAuthMiddleware],
    handlers: {
      POST: async ({ request }) => {
        try {
          const imageServiceUrl =
            process.env.IMAGE_SERVICE_URL || 'http://localhost:4006'

          // Forward auth headers and form data to image service
          const headers = new Headers()
          const cookie = request.headers.get('cookie')
          if (cookie) headers.set('cookie', cookie)
          const auth = request.headers.get('authorization')
          if (auth) headers.set('authorization', auth)

          const response = await fetch(`${imageServiceUrl}/upload`, {
            method: 'POST',
            headers,
            body: await request.formData(),
          })

          const data = await response.json()
          return Response.json(data, { status: response.status })
        } catch (error) {
          logger.error({ err: error }, 'Upload proxy error')
          return Response.json(
            { error: 'Uppladdning misslyckades' },
            { status: 500 },
          )
        }
      },
    },
  },
})
