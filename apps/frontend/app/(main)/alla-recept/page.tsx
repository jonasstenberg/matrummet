import { CategoryFilter } from "@/components/category-filter";
import { RecipeGrid } from "@/components/recipe-grid";
import { RecipeGridSkeleton } from "@/components/recipe-grid-skeleton";
import { RecipeViewToggle } from "@/components/recipe-view-toggle";
import { getRecipes } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

async function RecipeList() {
  const recipes = await getRecipes();
  return <RecipeGrid recipes={recipes} />;
}

export default async function AllRecipesPage() {
  const session = await getSession();
  const isLoggedIn = !!session;

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            Alla recept
          </h1>
          <p className="mt-2 text-lg text-muted-foreground">
            Utforska och upptäck recept
          </p>
        </div>
        <Suspense fallback={null}>
          <RecipeViewToggle isLoggedIn={isLoggedIn} showAll />
        </Suspense>
      </header>

      {/* Category Filter */}
      <Suspense fallback={<div className="h-10" />}>
        <CategoryFilter basePath="/alla-recept" />
      </Suspense>

      <Suspense fallback={<RecipeGridSkeleton />}>
        <RecipeList />
      </Suspense>
    </div>
  );
}
