import { CategoryFilter } from "@/components/category-filter";
import { RecipeGrid } from "@/components/recipe-grid";
import { RecipeGridSkeleton } from "@/components/recipe-grid-skeleton";
import { getRecipes } from "@/lib/api";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

async function RecipeList() {
  const recipes = await getRecipes();
  return <RecipeGrid recipes={recipes} />;
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
