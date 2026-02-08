import type { Metadata } from 'next'
import { getHomeInfo } from '@/lib/home-api'
import { HushallClient } from '@/components/home/hushall-client'
import { HomeSetupWizard } from '@/components/home/home-setup-wizard'

export const metadata: Metadata = {
  title: 'Hushåll',
  description: 'Hantera ditt hushåll, medlemmar och inbjudningar.',
}

export default async function HushallPage() {
  const { home } = await getHomeInfo()

  if (!home) {
    return <HomeSetupWizard />
  }

  return (
    <>
      <header>
        <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground">
          Hushåll
        </h1>
      </header>
      <HushallClient home={home} />
    </>
  )
}
