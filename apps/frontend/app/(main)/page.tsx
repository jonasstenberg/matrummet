import { RecipePageClient } from "@/components/recipe-page-client";
import { getRecipes, getCategories } from "@/lib/api";
import { getSession, signPostgrestToken } from "@/lib/auth";
import { getUserPantry } from "@/lib/ingredient-search-actions";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getSession();
  const token = session ? await signPostgrestToken(session.email) : undefined;

  // When logged in, show user's recipes. When not logged in, show all.
  const ownerEmail = session ? session.email : undefined;

  // Fetch all data in parallel
  const [recipes, categories, pantryResult] = await Promise.all([
    getRecipes(ownerEmail ? { owner: ownerEmail, token } : { token }),
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
      activeView="mine"
      isAuthenticated={!!session}
    />
  );
}
