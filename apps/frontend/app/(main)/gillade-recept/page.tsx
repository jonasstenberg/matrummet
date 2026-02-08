import type { Metadata } from 'next'
import { RecipePageClient } from "@/components/recipe-page-client";
import { getLikedRecipesWithCount, getCategories } from "@/lib/api";
import { getSession, signPostgrestToken } from "@/lib/auth";
import { getUserPantry } from "@/lib/ingredient-search-actions";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: 'Gillade recept',
  description: 'Dina sparade favoritrecept',
}

export const dynamic = "force-dynamic";

const PAGE_SIZE = 24;

export default async function LikedRecipesPage({
  searchParams,
}: {
  searchParams: Promise<{ offset?: string }>
}) {
  const session = await getSession();

  // Protected route - redirect to login if not authenticated
  if (!session) {
    redirect("/login");
  }

  const token = await signPostgrestToken(session.email);
  const { offset: offsetParam } = await searchParams;
  const initialLimit = offsetParam ? Math.max(PAGE_SIZE, parseInt(offsetParam, 10)) : PAGE_SIZE;

  // Fetch all data in parallel
  const [recipeResult, categories, pantryResult] = await Promise.all([
    getLikedRecipesWithCount(token, { limit: initialLimit }),
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
      activeView="liked"
      isAuthenticated={true}
      totalCount={recipeResult.totalCount}
      pageSize={PAGE_SIZE}
    />
  );
}
