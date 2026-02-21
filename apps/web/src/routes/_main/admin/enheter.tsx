import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { getAdminUnits } from '@/lib/admin-api'
import { EnheterClient } from '@/components/enheter-client'

const fetchAdminUnits = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ page: z.number(), search: z.string() }))
  .handler(async ({ data }) => {
    return getAdminUnits({ page: data.page, search: data.search })
  })

export const Route = createFileRoute('/_main/admin/enheter')({
  validateSearch: (search) =>
    z
      .object({
        page: z.coerce.number().optional().catch(undefined),
        search: z.string().optional().catch(undefined),
      })
      .parse(search),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) =>
    fetchAdminUnits({
      data: { page: deps.page ?? 1, search: deps.search ?? '' },
    }),
  head: () => ({ meta: [{ title: 'Enheter | Admin' }] }),
  component: PageComponent,
})

function PageComponent() {
  const data = Route.useLoaderData()
  const searchParams = Route.useSearch()

  return <EnheterClient initialData={data} page={searchParams.page ?? 1} search={searchParams.search ?? ''} />
}
