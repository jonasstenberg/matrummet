import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { MyPantry } from '@/components/my-pantry'
import { getUserPantry, getCommonPantryItems } from '@/lib/ingredient-search-actions'
import { getSession } from '@/lib/auth'

export const metadata: Metadata = {
  title: 'Mitt skafferi',
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
    <div className="max-w-2xl mx-auto space-y-6">
      <header>
        <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground">Mitt skafferi</h1>
      </header>

      <MyPantry initialPantry={pantryItems} commonPantryItems={commonItems} />
    </div>
  )
}
