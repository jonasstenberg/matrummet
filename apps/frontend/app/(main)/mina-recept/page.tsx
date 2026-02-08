import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { RecipePageClient } from "@/components/recipe-page-client";
import { getRecipesWithCount, getCategories } from "@/lib/api";
import { getSession, signPostgrestToken } from "@/lib/auth";
import { getUserPantry } from "@/lib/ingredient-search-actions";

export const metadata: Metadata = {
  title: 'Mina recept',
  description: 'Dina egna recept',
}

// ISR: Revalidate every 60 seconds for public (logged-out) content
// Authenticated content bypasses cache via token-based fetches
export const revalidate = 60;

const PAGE_SIZE = 24;

export default async function MyRecipesPage({
  searchParams,
}: {
  searchParams: Promise<{ offset?: string }>
}) {
  const session = await getSession();

  // Redirect to home if not authenticated
  if (!session) {
    redirect('/');
  }

  const token = await signPostgrestToken(session.email);
  const { offset: offsetParam } = await searchParams;
  const initialLimit = offsetParam ? Math.max(PAGE_SIZE, parseInt(offsetParam, 10)) : PAGE_SIZE;

  // Show user's own recipes
  const [recipeResult, categories, pantryResult] = await Promise.all([
    getRecipesWithCount({ owner: session.email, token, limit: initialLimit }),
    getCategories(),
    getUserPantry(),
  ]);

  // Handle pantry error case
  const pantryItems = Array.isArray(pantryResult) ? pantryResult : [];

  return (
    <RecipePageClient
      initialRecipes={recipeResult.recipes}
      initialPantry={pantryItems}
      groupedCategories={categories}
      activeView="mine"
      isAuthenticated={true}
      totalCount={recipeResult.totalCount}
      pageSize={PAGE_SIZE}
    />
  );
}
