import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { HomeSettingsClient } from './home-settings-client'
import { getUserHomes, getHomeInfo } from '@/lib/home-api'

export const metadata: Metadata = {
  title: 'Heminställningar',
  description: 'Hantera ditt hem, medlemmar och inbjudningar.',
  robots: { index: false, follow: false },
}

interface PageProps {
  params: Promise<{ homeId: string }>
}

export default async function HomeSettingsPage({ params }: PageProps) {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  const { homeId } = await params
  const homes = await getUserHomes()
  const currentHome = homes.find((h) => h.home_id === homeId)

  if (!currentHome) {
    redirect('/hushall')
  }

  // Fetch full home info with members
  const { home, userEmail } = await getHomeInfo(homeId)

  if (!home) {
    redirect('/hushall')
  }

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
