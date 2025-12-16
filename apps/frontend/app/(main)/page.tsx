import { CategoryFilter } from "@/components/category-filter";
import { RecipeGrid } from "@/components/recipe-grid";
import { RecipeGridSkeleton } from "@/components/recipe-grid-skeleton";
import { Alert } from "@/components/ui/alert";
import { getRecipes } from "@/lib/api";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

async function RecipeList() {
  try {
    const recipes = await getRecipes();
    return <RecipeGrid recipes={recipes} />;
  } catch (error) {
    return (
      <Alert variant="destructive">
        <p>Det gick inte att hämta recept. Försök igen senare.</p>
      </Alert>
    );
  }
}

export default function HomePage() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          Alla recept
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Utforska och upptäck recept
        </p>
      </header>

      {/* Category Filter */}
      <Suspense fallback={<div className="h-10" />}>
        <CategoryFilter />
      </Suspense>

      <Suspense fallback={<RecipeGridSkeleton />}>
        <RecipeList />
      </Suspense>
    </div>
  );
}
