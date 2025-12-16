import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getRecipes } from '@/lib/api'
import { getSession } from '@/lib/auth'
import { RecipeGrid } from '@/components/recipe-grid'

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>
}

export async function generateMetadata({
  searchParams,
}: SearchPageProps): Promise<Metadata> {
  const params = await searchParams
  const query = params.q || ''

  return {
    title: query ? `Mina recept - Sök: ${query}` : 'Sök i mina recept',
    description: query
      ? `Sökresultat för "${query}" i mina recept`
      : 'Sök bland dina egna recept',
  }
}

export default async function MyRecipesSearchPage({ searchParams }: SearchPageProps) {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  const params = await searchParams
  const query = params.q || ''

  const recipes = query
    ? await getRecipes({ search: query, owner: session.email })
    : []

  return (
    <div className="space-y-8">
      {/* Results with query */}
      {query && (
        <>
          <div>
            <h1 className="mb-2 text-3xl font-bold text-foreground">
              Sökresultat i <Link href="/mina-recept" className="text-primary hover:underline">mina recept</Link> för "{query}"
            </h1>
            <p className="text-lg text-muted-foreground">
              {recipes.length === 0 && 'Inga recept hittades'}
              {recipes.length === 1 && '1 recept hittades'}
              {recipes.length > 1 && `${recipes.length} recept hittades`}
            </p>
          </div>

          <RecipeGrid recipes={recipes} />
        </>
      )}

      {/* Empty state when no query */}
      {!query && (
        <div className="flex min-h-[500px] items-center justify-center">
          <div className="max-w-md text-center">
            <h1 className="mb-4 text-3xl font-bold text-foreground">
              Sök i mina recept
            </h1>
            <p className="mb-2 text-lg text-muted-foreground">
              Använd sökfältet i menyn ovan för att hitta bland dina egna recept
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
