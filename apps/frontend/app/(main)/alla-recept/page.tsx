import { RecipePageClient } from "@/components/recipe-page-client";
import { getRecipes, getCategories } from "@/lib/api";
import { getSession, signPostgrestToken } from "@/lib/auth";
import { getUserPantry } from "@/lib/ingredient-search-actions";

export const dynamic = "force-dynamic";

export default async function AllRecipesPage() {
  const session = await getSession();
  const token = session ? await signPostgrestToken(session.email) : undefined;

  // Fetch all data in parallel
  const [recipes, categories, pantryResult] = await Promise.all([
    getRecipes({ token }),
    getCategories(),
    session ? getUserPantry() : Promise.resolve([]),
  ]);

  // Handle pantry error case
  const pantryItems = Array.isArray(pantryResult) ? pantryResult : [];

  return (
    <RecipePageClient
      initialRecipes={recipes}
      initialPantry={pantryItems}
      categories={categories}
      activeView="all"
      isAuthenticated={!!session}
    />
  );
}
