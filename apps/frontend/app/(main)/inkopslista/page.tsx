import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { getUserHomes } from '@/lib/home-api'
import { HomeSetupWizard } from '@/components/home/home-setup-wizard'

export const metadata: Metadata = {
  title: 'Inköpslista',
  description: 'Hantera dina inköpslistor.',
  robots: { index: false, follow: false },
}

export default async function ShoppingListRedirect() {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  const homes = await getUserHomes()

  if (homes.length > 0) {
    redirect(`/hem/${homes[0].home_id}/inkopslista`)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <header>
        <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground">
          Inköpslista
        </h1>
      </header>
      <HomeSetupWizard />
    </div>
  )
}
