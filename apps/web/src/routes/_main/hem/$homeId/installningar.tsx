import { createFileRoute, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { getUserHomes, getHomeInfo } from '@/lib/home-api'
import { HomeSettingsClient } from '@/components/home-settings-client'

const fetchHomeSettings = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ homeId: z.string() }))
  .handler(async ({ data: { homeId } }) => {
    const homes = await getUserHomes()
    const currentHome = homes.find((h) => h.home_id === homeId)

    if (!currentHome) {
      throw redirect({ to: '/hushall' })
    }

    // Fetch full home info with members
    const { home, userEmail } = await getHomeInfo(homeId)

    if (!home) {
      throw redirect({ to: '/hushall' })
    }

    return { home, userEmail }
  })

export const Route = createFileRoute('/_main/hem/$homeId/installningar')({
  loader: ({ params }) =>
    fetchHomeSettings({ data: { homeId: params.homeId } }),
  head: () => ({
    meta: [
      { title: 'Heminställningar' },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
  component: HomeSettingsPage,
})

function HomeSettingsPage() {
  const { home, userEmail } = Route.useLoaderData()

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <header>
        <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground">
          Heminställningar
        </h1>
      </header>
      <HomeSettingsClient home={home} userEmail={userEmail} />
    </div>
  )
}
