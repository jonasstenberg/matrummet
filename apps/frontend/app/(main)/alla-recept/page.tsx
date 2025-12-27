import { CategoryFilter } from "@/components/category-filter";
import { RecipeGrid } from "@/components/recipe-grid";
import { RecipeGridSkeleton } from "@/components/recipe-grid-skeleton";
import { RecipeViewToggle } from "@/components/recipe-view-toggle";
import { getRecipes } from "@/lib/api";
import { getSession, signPostgrestToken } from "@/lib/auth";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

async function RecipeList({ token }: { token?: string }) {
  const recipes = await getRecipes({ token });
  return <RecipeGrid recipes={recipes} />;
}

export default async function AllRecipesPage() {
  const session = await getSession();
  const token = session ? await signPostgrestToken(session.email) : undefined;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <header>
        <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground">
          Alla recept
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Utforska och upptäck recept
        </p>
      </header>

      {/* View Toggle Tabs */}
      <Suspense fallback={null}>
        <RecipeViewToggle activeView="all" />
      </Suspense>

      {/* Category Filter */}
      <Suspense fallback={<div className="h-10" />}>
        <CategoryFilter basePath="/alla-recept" />
      </Suspense>

      <Suspense fallback={<RecipeGridSkeleton />}>
        <RecipeList token={token} />
      </Suspense>
    </div>
  );
}
