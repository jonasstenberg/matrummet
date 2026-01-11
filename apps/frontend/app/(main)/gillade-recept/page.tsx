import { RecipePageClient } from "@/components/recipe-page-client";
import { getLikedRecipes, getCategories } from "@/lib/api";
import { getSession, signPostgrestToken } from "@/lib/auth";
import { getUserPantry } from "@/lib/ingredient-search-actions";
import { buildRecipeMatchDataMap } from "@/lib/recipe-match-helpers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LikedRecipesPage() {
  const session = await getSession();

  // Protected route - redirect to login if not authenticated
  if (!session) {
    redirect("/login");
  }

  const token = await signPostgrestToken(session.email);

  // Fetch all data in parallel
  const [recipes, categories, pantryResult] = await Promise.all([
    getLikedRecipes(token),
    getCategories(),
    getUserPantry(),
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
      activeView="liked"
      isAuthenticated={true}
    />
  );
}
