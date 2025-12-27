import type { Metadata } from 'next'
import { getRecipes } from '@/lib/api'
import { getSession, signPostgrestToken } from '@/lib/auth'
import { RecipeGrid } from '@/components/recipe-grid'
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
    title: query ? `Sök: ${query} - Mina recept` : 'Sök recept',
    description: query
      ? `Sökresultat för "${query}"`
      : 'Sök efter dina favoritrecept',
  }
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams
  const query = params.q || ''

  const session = await getSession()
  const token = session ? await signPostgrestToken(session.email) : undefined

  // Search only user's recipes when logged in
  const ownerEmail = session ? session.email : undefined

  const recipes = query
    ? await getRecipes({ search: query, owner: ownerEmail, token })
    : []

  return (
    <div className="space-y-8">
      {/* Results with query */}
      {query && (
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
