import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { MyPantry } from '@/components/my-pantry'
import { getUserPantry, getCommonPantryItems } from '@/lib/ingredient-search-actions'
import { getSession } from '@/lib/auth'

export const metadata: Metadata = {
  title: 'Mitt skafferi | Matrummet',
  description:
    'Hantera ingredienser i ditt skafferi. Lägg till och ta bort ingredienser för att filtrera recept.',
}

export default async function MyPantryPage() {
  const session = await getSession()

  // Protected route - redirect to login if not authenticated
  if (!session) {
    redirect('/login')
  }

  const [pantryResult, commonItems] = await Promise.all([
    getUserPantry(),
    getCommonPantryItems(),
  ])
  const pantryItems = 'error' in pantryResult ? [] : pantryResult

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-foreground">Mitt skafferi</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Lägg till ingredienser du har hemma för att enkelt filtrera recept
        </p>
      </header>

      <MyPantry initialPantry={pantryItems} commonPantryItems={commonItems} />
    </div>
  )
}
