import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import Link from 'next/link'
import { getSession } from '@/lib/auth'
import { env } from '@/lib/env'
import { RecipeGrid } from '@/components/recipe-grid'
import { RecipeGridSkeleton } from '@/components/recipe-grid-skeleton'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { Plus } from 'lucide-react'
import type { Recipe } from '@/lib/types'

export const metadata: Metadata = {
  title: 'Mina recept',
  description: 'Hantera och redigera dina egna recept',
}

export const dynamic = 'force-dynamic'

async function getMyRecipes(userEmail: string): Promise<Recipe[]> {
  const params = new URLSearchParams()
  params.set('owner', `eq.${userEmail}`)
  params.set('order', 'date_modified.desc')

  const res = await fetch(`${env.POSTGREST_URL}/recipes_and_categories?${params}`, {
    cache: 'no-store',
  })

  if (!res.ok) throw new Error('Failed to fetch recipes')
  return res.json()
}

async function MyRecipeList({ userEmail }: { userEmail: string }) {
  try {
    const recipes = await getMyRecipes(userEmail)

    if (recipes.length === 0) {
      return (
        <div className="flex min-h-[400px] items-center justify-center rounded-lg border border-dashed">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-foreground">
              Du har inga recept ännu
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Skapa ditt första recept för att komma igång.
            </p>
            <Button asChild className="mt-4">
              <Link href="/recept/nytt">
                <Plus className="mr-2 h-4 w-4" />
                Skapa recept
              </Link>
            </Button>
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-lg text-muted-foreground">
            {recipes.length === 1 && '1 recept'}
            {recipes.length > 1 && `${recipes.length} recept`}
          </p>
          <Button asChild>
            <Link href="/recept/nytt">
              <Plus className="mr-2 h-4 w-4" />
              Skapa nytt recept
            </Link>
          </Button>
        </div>
        <RecipeGrid recipes={recipes} />
      </div>
    )
  } catch (error) {
    return (
      <Alert variant="destructive">
        <p>Det gick inte att hämta dina recept. Försök igen senare.</p>
      </Alert>
    )
  }
}

export default async function MyRecipesPage() {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          Mina recept
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Hantera och redigera dina egna recept
        </p>
      </header>

      <Suspense fallback={<RecipeGridSkeleton />}>
        <MyRecipeList userEmail={session.email} />
      </Suspense>
    </div>
  )
}
