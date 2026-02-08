import type { Metadata } from 'next'
import { RecipePageClient } from "@/components/recipe-page-client";
import { LandingPage } from "@/components/landing-page";
import { getRecipesWithCount, getCategories, getFeaturedRecipes } from "@/lib/api";
import { getSession, signPostgrestToken } from "@/lib/auth";
import { getUserPantry } from "@/lib/ingredient-search-actions";

export const metadata: Metadata = {
  title: 'Matrummet',
  description: 'Din personliga receptsamling',
}

// ISR: Revalidate every 60 seconds for public (logged-out) content
// Authenticated content bypasses cache via token-based fetches
export const revalidate = 60;

const PAGE_SIZE = 24;

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ offset?: string }>
}) {
  const session = await getSession();

  // Show landing page for non-authenticated users
  if (!session) {
    const featuredRecipes = await getFeaturedRecipes(4);
    return <LandingPage recipes={featuredRecipes} />;
  }

  const token = await signPostgrestToken(session.email);
  const { offset: offsetParam } = await searchParams;
  const initialLimit = offsetParam ? Math.max(PAGE_SIZE, parseInt(offsetParam, 10)) : PAGE_SIZE;

  // When logged in: show all recipes (public + private via RLS)
  const [recipeResult, categories, pantryResult] = await Promise.all([
    getRecipesWithCount({ token, limit: initialLimit }),
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
      activeView="all"
      isAuthenticated={true}
      totalCount={recipeResult.totalCount}
      pageSize={PAGE_SIZE}
    />
  );
}
