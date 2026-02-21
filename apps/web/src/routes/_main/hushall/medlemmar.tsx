import { createFileRoute, redirect, Link } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getHomeInfo } from '@/lib/home-api'
import { ChevronLeft } from '@/lib/icons'
import { MedlemmarClient } from '@/components/home/medlemmar-client'

const fetchMedlemmar = createServerFn({ method: 'GET' }).handler(async () => {
  const { home, userEmail } = await getHomeInfo()

  if (!home) {
    throw redirect({ to: '/hushall' })
  }

  return { home, userEmail }
})

export const Route = createFileRoute('/_main/hushall/medlemmar')({
  beforeLoad: ({ context }) => {
    if (!context.session) {
      throw redirect({ to: '/login' })
    }
    return { session: context.session }
  },
  loader: () => fetchMedlemmar(),
  head: () => ({
    meta: [
      { title: 'Medlemmar' },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
  component: MedlemmarPage,
})

function MedlemmarPage() {
  const { home, userEmail } = Route.useLoaderData()

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <header>
        <Link
          to="/hushall"
          className="inline-flex items-center gap-1 text-sm text-primary mb-3 -ml-1 transition-colors hover:text-primary/80"
        >
          <ChevronLeft className="h-4 w-4" />
          Hushåll
        </Link>
        <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground">
          Medlemmar
        </h1>
      </header>
      <MedlemmarClient home={home} userEmail={userEmail} />
    </div>
  )
}
