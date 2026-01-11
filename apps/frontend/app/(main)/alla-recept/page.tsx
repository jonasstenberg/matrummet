import { RecipePageClient } from "@/components/recipe-page-client";
import { getRecipes, getCategories } from "@/lib/api";
import { getSession, signPostgrestToken } from "@/lib/auth";
import { getUserPantry } from "@/lib/ingredient-search-actions";
import { buildRecipeMatchDataMap } from "@/lib/recipe-match-helpers";

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

  // Calculate match data server-side
  const matchDataMap = await buildRecipeMatchDataMap(pantryResult, recipes);

  return (
    <RecipePageClient
      initialRecipes={recipes}
      initialPantry={pantryItems}
      initialMatchData={matchDataMap}
      categories={categories}
      activeView="all"
      isAuthenticated={!!session}
    />
  );
}
