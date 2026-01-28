import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getHomeInfo } from '@/lib/home-api'
import { HemmetSidebar } from '@/components/hemmet-sidebar'
import { HemmetPillNav } from '@/components/hemmet-pill-nav'

export default async function HemmetLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  if (!session) {
    redirect('/login')
  }

  // Fetch home data to determine layout
  const { home } = await getHomeInfo()

  // User has no home - show full-width setup wizard (no sidebar)
  if (!home) {
    return (
      <div className="max-w-4xl mx-auto">
        {children}
      </div>
    )
  }

  // User has a home - show sidebar layout matching settings
  return (
    <div className="max-w-6xl mx-auto">
      <div className="space-y-2 mb-8">
        <h1 className="font-heading text-3xl font-bold">Mitt hem</h1>
        <p className="text-muted-foreground">
          Hantera ditt hem och medlemmar
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-8">
        <aside className="hidden md:block">
          <HemmetSidebar />
        </aside>
        <div className="md:hidden">
          <HemmetPillNav />
        </div>
        <main className="min-w-0">
          {children}
        </main>
      </div>
    </div>
  )
}
