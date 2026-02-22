import { createFileRoute } from '@tanstack/react-router'
import { apiAuthMiddleware } from '@/lib/middleware'
import { getRecipes } from '@/lib/api'
import { recipesToMarkdown } from '@/lib/export-markdown'
import { logger as rootLogger } from '@/lib/logger'
const logger = rootLogger.child({ module: 'api:user:export' })

export const Route = createFileRoute('/api/user/export')({
  server: {
    middleware: [apiAuthMiddleware],
    handlers: {
      GET: async ({ context }) => {
        try {
          const { session, postgrestToken } = context
          const recipes = await getRecipes({ owner: session.email, token: postgrestToken, limit: 10000 })
          const markdown = recipesToMarkdown(recipes)

          return new Response(markdown, {
            headers: {
              'Content-Type': 'text/markdown; charset=utf-8',
              'Content-Disposition': 'attachment; filename="mina-recept.md"',
            },
          })
        } catch (error) {
          logger.error({ err: error, email: context.session?.email }, 'Export error')
          return Response.json(
            { error: 'Ett fel uppstod vid export' },
            { status: 500 },
          )
        }
      },
    },
  },
})
