import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getRecipes } from '@/lib/api'
import { getSession } from '@/lib/auth'
import { RecipeGrid } from '@/components/recipe-grid'
import { CategoryFilter } from '@/components/category-filter'
import { RecipeViewToggle } from '@/components/recipe-view-toggle'
import { Button } from '@/components/ui/button'

interface CategoryPageProps {
  params: Promise<{ name: string }>
}

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { name } = await params
  const categoryName = decodeURIComponent(name)

  return {
    title: `${categoryName} - Recept`,
    description: `Alla ${categoryName.toLowerCase()}-recept`,
  }
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { name } = await params
  const categoryName = decodeURIComponent(name)

  const session = await getSession()
  const isLoggedIn = !!session

  // When logged in, show user's recipes. When not logged in, show all.
  const ownerEmail = isLoggedIn ? session.email : undefined

  const recipes = await getRecipes({
    category: categoryName,
    owner: ownerEmail,
  })

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <div>
        <Button variant="ghost" asChild className="gap-2">
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
            Tillbaka
          </Link>
        </Button>
      </div>

      {/* Category Header */}
      <header>
        <h1 className="font-heading text-3xl font-bold text-foreground">{categoryName}</h1>
        <p className="mt-2 text-muted-foreground">
          {recipes.length === 0 && 'Inga recept i denna kategori'}
          {recipes.length === 1 && '1 recept'}
          {recipes.length > 1 && `${recipes.length} recept`}
        </p>
      </header>

      {/* View Toggle Tabs */}
      <RecipeViewToggle isLoggedIn={isLoggedIn} categoryName={categoryName} />

      {/* Category Filter */}
      <CategoryFilter activeCategory={categoryName} />

      {/* Recipe Grid */}
      <RecipeGrid recipes={recipes} />
    </div>
  )
}
