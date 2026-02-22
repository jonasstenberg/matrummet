import { createFileRoute } from '@tanstack/react-router'
import { env } from '@/lib/env'
import { logger as rootLogger } from '@/lib/logger'
const logger = rootLogger.child({ module: 'api:categories' })

export const Route = createFileRoute('/api/categories')({
  server: {
    handlers: {
      GET: async () => {
        try {
          const response = await fetch(
            `${env.POSTGREST_URL}/categories?select=name,category_groups(name,sort_order)&order=name`,
          )

          if (!response.ok) {
            return Response.json(
              { error: 'Failed to fetch categories' },
              { status: 500 },
            )
          }

          const data: Array<{
            name: string
            category_groups: { name: string; sort_order: number } | null
          }> = await response.json()

          // Group categories by their group
          const groupMap = new Map<string, { sort_order: number; categories: string[] }>()

          for (const cat of data) {
            const groupName = cat.category_groups?.name ?? 'Övrigt'
            const sortOrder = cat.category_groups?.sort_order ?? 99

            if (!groupMap.has(groupName)) {
              groupMap.set(groupName, { sort_order: sortOrder, categories: [] })
            }
            groupMap.get(groupName)!.categories.push(cat.name)
          }

          // Return grouped structure sorted by sort_order
          const grouped = Array.from(groupMap.entries())
            .sort((a, b) => a[1].sort_order - b[1].sort_order)
            .map(([name, { sort_order, categories }]) => ({
              name,
              sort_order,
              categories: categories.sort((a, b) => a.localeCompare(b, 'sv')),
            }))

          return Response.json(grouped)
        } catch (error) {
          logger.error({ err: error instanceof Error ? error : String(error) }, 'Error fetching categories')
          return Response.json(
            { error: 'Failed to fetch categories' },
            { status: 500 },
          )
        }
      },
    },
  },
})
