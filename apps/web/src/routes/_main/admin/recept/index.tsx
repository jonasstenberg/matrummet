import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { getAdminRecipes } from '@/lib/admin-api'
import { ReceptClient } from '@/components/recept-client'

const fetchAdminRecipes = createServerFn({ method: 'GET' })
  .inputValidator(
    z.object({
      page: z.number(),
      search: z.string(),
      sortBy: z.enum(['name', 'owner', 'date_published', 'date_modified']),
      sortDir: z.enum(['asc', 'desc']),
    }),
  )
  .handler(async ({ data }) => {
    return getAdminRecipes({
      page: data.page,
      search: data.search,
      sortBy: data.sortBy,
      sortDir: data.sortDir,
    })
  })

export const Route = createFileRoute('/_main/admin/recept/')({
  validateSearch: (search) =>
    z
      .object({
        page: z.coerce.number().optional().catch(undefined),
        search: z.string().optional().catch(undefined),
        sortBy: z
          .enum(['name', 'owner', 'date_published', 'date_modified'])
          .optional().catch(undefined),
        sortDir: z.enum(['asc', 'desc']).optional().catch(undefined),
      })
      .parse(search),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) =>
    fetchAdminRecipes({
      data: {
        page: deps.page ?? 1,
        search: deps.search ?? '',
        sortBy: deps.sortBy ?? 'date_published',
        sortDir: deps.sortDir ?? 'desc',
      },
    }),
  head: () => ({ meta: [{ title: 'Recept | Admin' }] }),
  component: PageComponent,
})

function PageComponent() {
  const data = Route.useLoaderData()
  const searchParams = Route.useSearch()

  return (
    <ReceptClient
      initialData={data}
      page={searchParams.page ?? 1}
      search={searchParams.search ?? ''}
      sortBy={searchParams.sortBy ?? 'date_published'}
      sortDir={searchParams.sortDir ?? 'desc'}
    />
  )
}
