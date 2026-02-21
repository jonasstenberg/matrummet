import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { checkAuth } from '@/lib/middleware'
import { getUserHomes } from '@/lib/home-api'
import { HomeProvider } from '@/lib/home-context'

const fetchHome = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ homeId: z.string() }))
  .handler(async ({ data: { homeId } }) => {
    const homes = await getUserHomes()
    const home = homes.find((h) => h.home_id === homeId)

    if (!home) {
      throw redirect({ to: '/hushall' })
    }

    return { homeId, homeName: home.home_name }
  })

export const Route = createFileRoute('/_main/hem/$homeId')({
  beforeLoad: async () => {
    const session = await checkAuth()
    return { session }
  },
  loader: ({ params }) => fetchHome({ data: { homeId: params.homeId } }),
  component: HomeLayout,
})

function HomeLayout() {
  const { homeId, homeName } = Route.useLoaderData()

  return (
    <HomeProvider homeId={homeId} homeName={homeName}>
      <Outlet />
    </HomeProvider>
  )
}
