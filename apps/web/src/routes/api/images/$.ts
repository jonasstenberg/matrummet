import { createFileRoute } from '@tanstack/react-router'
import { logger as rootLogger } from '@/lib/logger'
const logger = rootLogger.child({ module: 'api:images' })

export const Route = createFileRoute('/api/images/$')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const imageServiceUrl =
            process.env.IMAGE_SERVICE_URL || 'http://localhost:4006'
          const url = new URL(request.url)
          // Strip /api prefix: /api/images/uuid/size -> /images/uuid/size
          const imagePath = url.pathname.replace(/^\/api/, '')

          const headers = new Headers()
          const ifNoneMatch = request.headers.get('if-none-match')
          if (ifNoneMatch) headers.set('if-none-match', ifNoneMatch)

          const response = await fetch(`${imageServiceUrl}${imagePath}`, {
            headers,
          })

          // Pass through the response with all headers
          return new Response(response.body, {
            status: response.status,
            headers: response.headers,
          })
        } catch (error) {
          logger.error({ err: error }, 'Image proxy error')
          return new Response('Internal server error', { status: 500 })
        }
      },
    },
  },
})
