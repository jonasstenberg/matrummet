import { createFileRoute } from '@tanstack/react-router'
import { apiAuthMiddleware } from '@/lib/middleware'
import { getRecipes } from '@/lib/api'
import { recipesToMarkdown } from '@/lib/export-markdown'

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
          console.error('Export error:', error)
          return Response.json(
            { error: 'Ett fel uppstod vid export' },
            { status: 500 },
          )
        }
      },
    },
  },
})
