import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { getAdminFoods, getPendingFoodCount } from '@/lib/admin-api'
import { MatvarorClient } from '@/components/matvaror-client'

const fetchFoodsData = createServerFn({ method: 'GET' })
  .inputValidator(
    z.object({
      page: z.number(),
      search: z.string(),
      status: z.enum(['pending', 'approved', 'rejected', 'all']),
      alias: z.enum(['all', 'is_alias', 'has_aliases', 'standalone']),
    }),
  )
  .handler(async ({ data }) => {
    const [foods, pendingCount] = await Promise.all([
      getAdminFoods({
        page: data.page,
        search: data.search,
        status: data.status,
        alias: data.alias,
      }),
      getPendingFoodCount(),
    ])
    return { foods, pendingCount }
  })

export const Route = createFileRoute('/_main/admin/matvaror')({
  validateSearch: (search) =>
    z
      .object({
        page: z.coerce.number().optional().catch(undefined),
        search: z.string().optional().catch(undefined),
        status: z
          .enum(['pending', 'approved', 'rejected', 'all'])
          .optional().catch(undefined),
        alias: z
          .enum(['all', 'is_alias', 'has_aliases', 'standalone'])
          .optional().catch(undefined),
      })
      .parse(search),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) =>
    fetchFoodsData({
      data: {
        page: deps.page ?? 1,
        search: deps.search ?? '',
        status: deps.status ?? 'pending',
        alias: deps.alias ?? 'all',
      },
    }),
  head: () => ({ meta: [{ title: 'Matvaror | Admin' }] }),
  component: PageComponent,
})

function PageComponent() {
  const { foods: data, pendingCount } = Route.useLoaderData()
  const searchParams = Route.useSearch()

  return (
    <MatvarorClient
      initialData={data}
      page={searchParams.page ?? 1}
      search={searchParams.search ?? ''}
      statusFilter={searchParams.status ?? 'pending'}
      aliasFilter={searchParams.alias ?? 'all'}
      pendingCount={pendingCount}
    />
  )
}
