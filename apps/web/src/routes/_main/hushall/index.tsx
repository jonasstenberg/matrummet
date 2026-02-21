import { createFileRoute, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getUserHomes } from '@/lib/home-api'
import { HomeSetupWizard } from '@/components/home/home-setup-wizard'
import { HushallOverview } from '@/components/home/hushall-overview'

const fetchHushall = createServerFn({ method: 'GET' }).handler(async () => {
  const homes = await getUserHomes()

  return { homes }
})

export const Route = createFileRoute('/_main/hushall/')({
  beforeLoad: ({ context }) => {
    if (!context.session) {
      throw redirect({ to: '/login' })
    }
    return { session: context.session }
  },
  loader: () => fetchHushall(),
  head: () => ({
    meta: [
      { title: 'Hushåll' },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
  component: HushallPage,
})

function HushallPage() {
  const { homes } = Route.useLoaderData()

  if (homes.length === 0) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <HomeSetupWizard />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <header>
        <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground">
          Hushåll
        </h1>
      </header>
      <HushallOverview homes={homes} />
    </div>
  )
}
