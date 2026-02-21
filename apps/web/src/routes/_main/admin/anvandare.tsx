import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { getAdminUsers } from '@/lib/admin-api'
import { AnvandareClient } from '@/components/anvandare-client'

const fetchAdminUsers = createServerFn({ method: 'GET' })
  .inputValidator(
    z.object({
      page: z.number(),
      search: z.string(),
      role: z.enum(['user', 'admin', 'all']),
      sortBy: z.enum([
        'name',
        'email',
        'role',
        'provider',
        'recipe_count',
        'credit_balance',
      ]),
      sortDir: z.enum(['asc', 'desc']),
    }),
  )
  .handler(async ({ data }) => {
    return getAdminUsers({
      page: data.page,
      search: data.search,
      role: data.role,
      sortBy: data.sortBy,
      sortDir: data.sortDir,
    })
  })

export const Route = createFileRoute('/_main/admin/anvandare')({
  validateSearch: (search) =>
    z
      .object({
        page: z.coerce.number().optional().catch(undefined),
        search: z.string().optional().catch(undefined),
        role: z.enum(['user', 'admin', 'all']).optional().catch(undefined),
        sortBy: z
          .enum([
            'name',
            'email',
            'role',
            'provider',
            'recipe_count',
            'credit_balance',
          ])
          .optional().catch(undefined),
        sortDir: z.enum(['asc', 'desc']).optional().catch(undefined),
      })
      .parse(search),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) =>
    fetchAdminUsers({
      data: {
        page: deps.page ?? 1,
        search: deps.search ?? '',
        role: deps.role ?? 'all',
        sortBy: deps.sortBy ?? 'name',
        sortDir: deps.sortDir ?? 'asc',
      },
    }),
  head: () => ({ meta: [{ title: 'Användare | Admin' }] }),
  component: PageComponent,
})

function PageComponent() {
  const data = Route.useLoaderData()
  const searchParams = Route.useSearch()

  return (
    <AnvandareClient
      initialData={data}
      page={searchParams.page ?? 1}
      search={searchParams.search ?? ''}
      roleFilter={searchParams.role ?? 'all'}
      sortBy={searchParams.sortBy ?? 'name'}
      sortDir={searchParams.sortDir ?? 'asc'}
    />
  )
}
