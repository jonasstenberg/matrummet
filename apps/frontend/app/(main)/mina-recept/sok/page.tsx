import { redirect } from 'next/navigation'

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>
}

export default async function MyRecipesSearchRedirect({ searchParams }: SearchPageProps) {
  const params = await searchParams
  const query = params.q
  redirect(query ? `/sok?q=${encodeURIComponent(query)}` : '/sok')
}
