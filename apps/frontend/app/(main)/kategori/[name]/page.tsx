import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getRecipes } from '@/lib/api'
import { RecipeGrid } from '@/components/recipe-grid'
import { CategoryFilter } from '@/components/category-filter'
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
  const recipes = await getRecipes({ category: categoryName })

  return (
    <div className="space-y-8">
      {/* Back Link */}
      <div>
        <Button variant="ghost" asChild className="gap-2">
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
            Tillbaka till alla recept
          </Link>
        </Button>
      </div>

      {/* Category Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">{categoryName}</h1>
        <p className="mt-2 text-muted-foreground">
          {recipes.length === 0 && 'Inga recept i denna kategori'}
          {recipes.length === 1 && '1 recept'}
          {recipes.length > 1 && `${recipes.length} recept`}
        </p>
      </div>

      {/* Category Filter */}
      <CategoryFilter activeCategory={categoryName} />

      {/* Recipe Grid */}
      <RecipeGrid recipes={recipes} />
    </div>
  )
}
