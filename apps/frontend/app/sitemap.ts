import type { MetadataRoute } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_URL || 'https://matrummet.se'
const POSTGREST_URL = process.env.POSTGREST_URL || 'http://localhost:4444'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${BASE_URL}/om`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/integritetspolicy`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/villkor`, changeFrequency: 'yearly', priority: 0.3 },
  ]

  let recipePages: MetadataRoute.Sitemap = []
  try {
    const res = await fetch(
      `${POSTGREST_URL}/featured_recipes?select=id,date_modified`,
      { cache: 'no-store' },
    )
    if (res.ok) {
      const recipes: Array<{ id: string; date_modified: string | null }> = await res.json()
      recipePages = recipes.map((recipe) => ({
        url: `${BASE_URL}/recept/${recipe.id}`,
        lastModified: recipe.date_modified ? new Date(recipe.date_modified) : undefined,
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      }))
    }
  } catch {
    // Sitemap still works with static pages if PostgREST is unavailable
  }

  return [...staticPages, ...recipePages]
}
