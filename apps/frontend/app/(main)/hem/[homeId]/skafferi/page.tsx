import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { MyPantry } from '@/components/my-pantry'
import { getUserPantry, getCommonPantryItems } from '@/lib/ingredient-search-actions'
import { getUserHomes } from '@/lib/home-api'
import { getSession } from '@/lib/auth'

export const metadata: Metadata = {
  title: 'Skafferi',
  description:
    'Hantera ingredienser i ditt skafferi. Lägg till och ta bort ingredienser för att filtrera recept.',
  robots: { index: false, follow: false },
}

interface PageProps {
  params: Promise<{ homeId: string }>
}

export default async function HomePantryPage({ params }: PageProps) {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  const { homeId } = await params

  const [pantryResult, commonItems, homes] = await Promise.all([
    getUserPantry(homeId),
    getCommonPantryItems(),
    getUserHomes(),
  ])
  const pantryItems = 'error' in pantryResult ? [] : pantryResult
  const homeName = homes.find((h) => h.home_id === homeId)?.home_name

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <header>
        <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground">Skafferi</h1>
        {homeName && (
          <p className="text-sm text-muted-foreground mt-1">{homeName}</p>
        )}
      </header>

      <MyPantry initialPantry={pantryItems} commonPantryItems={commonItems} homeId={homeId} />
    </div>
  )
}
