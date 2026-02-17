import type { Metadata } from 'next'
import { getUserHomes } from '@/lib/home-api'
import { HomeSetupWizard } from '@/components/home/home-setup-wizard'
import { HushallOverview } from '@/components/home/hushall-overview'

export const metadata: Metadata = {
  title: 'Hushåll',
  description: 'Hantera dina hushåll, medlemmar och inbjudningar.',
}

export default async function HushallPage() {
  const homes = await getUserHomes()

  if (homes.length === 0) {
    return <HomeSetupWizard />
  }

  return (
    <>
      <header>
        <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground">
          Hushåll
        </h1>
      </header>
      <HushallOverview homes={homes} />
    </>
  )
}
