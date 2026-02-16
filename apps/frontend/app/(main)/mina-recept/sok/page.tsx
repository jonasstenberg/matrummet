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
    title: query ? `Sök: ${query} - Mina recept` : 'Sök mina recept',
    description: query
      ? `Sökresultat för "${query}"`
      : 'Sök efter dina favoritrecept',
    robots: { index: false, follow: false },
  }
}

async function SearchResults({ query }: { query: string }) {
  const session = await getSession()

  // Redirect to main search if not authenticated
  if (!session) {
    redirect(`/sok${query ? `?q=${encodeURIComponent(query)}` : ''}`)
  }

  const token = await signPostgrestToken(session.email)

  const recipes = query
    ? await getRecipes({ search: query, owner: session.email, token })
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
        <RecipeViewToggleSearch />
      </header>

      <RecipeGrid recipes={recipes} />
    </>
  )
}

export default async function MyRecipesSearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams
  const query = params.q || ''

  return (
    <div className="space-y-8">
      {/* Results with query */}
      {query && (
        <Suspense fallback={<RecipeGridSkeleton count={6} />}>
          <SearchResults query={query} />
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
