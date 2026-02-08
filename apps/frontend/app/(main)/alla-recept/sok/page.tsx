import { redirect } from 'next/navigation'

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>
}

// Redirect /alla-recept/sok to /sok (all recipes search is now at /sok)
export default async function AllRecipesSearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams
  const query = params.q || ''

  redirect(`/sok${query ? `?q=${encodeURIComponent(query)}` : ''}`)
}
