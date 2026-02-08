import type { Metadata } from 'next'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getRecipes } from '@/lib/api'
import { getSession, signPostgrestToken } from '@/lib/auth'
import { RecipeGrid } from '@/components/recipe-grid'
import { RecipeGridSkeleton } from '@/components/recipe-grid-skeleton'
import { RecipeViewToggleSearch } from '@/components/recipe-view-toggle-search'

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>
}

export async function generateMetadata({
  searchParams,
}: SearchPageProps): Promise<Metadata> {
  const params = await searchParams
  const query = params.q || ''

  return {
    title: query ? `Sök: ${query} - Alla recept` : 'Sök alla recept',
    description: query
      ? `Sökresultat för "${query}"`
      : 'Sök efter recept',
  }
}

async function SearchResults({ query, token }: { query: string; token: string }) {
  const recipes = query
    ? await getRecipes({ search: query, token })
    : []

  return (
    <>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-bold text-foreground">
            Sökresultat för &quot;{query}&quot;
          </h1>
          <p className="text-lg text-muted-foreground">
            {recipes.length === 0 && 'Inga recept hittades'}
            {recipes.length === 1 && '1 recept hittades'}
            {recipes.length > 1 && `${recipes.length} recept hittades`}
          </p>
        </div>
        <RecipeViewToggleSearch showAll />
      </header>

      <RecipeGrid recipes={recipes} />
    </>
  )
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const session = await getSession()

  // Require authentication
  if (!session) {
    redirect('/logga-in')
  }

  const token = await signPostgrestToken(session.email)
  const params = await searchParams
  const query = params.q || ''

  return (
    <div className="space-y-8">
      {/* Results with query */}
      {query && (
        <Suspense fallback={<RecipeGridSkeleton count={6} />}>
          <SearchResults query={query} token={token} />
        </Suspense>
      )}

      {/* Empty state when no query */}
      {!query && (
        <div className="flex min-h-[500px] items-center justify-center">
          <div className="max-w-md text-center">
            <h1 className="mb-4 text-3xl font-bold text-foreground">
              Sök efter recept
            </h1>
            <p className="mb-2 text-lg text-muted-foreground">
              Använd sökfältet i menyn ovan för att hitta dina favoritrecept
            </p>
            <p className="text-sm text-muted-foreground">
              Du kan söka efter ingredienser, rätter eller kategorier
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
