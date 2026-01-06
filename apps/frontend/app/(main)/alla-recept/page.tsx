import { CategoryFilter } from "@/components/category-filter";
import { RecipeGrid } from "@/components/recipe-grid";
import { RecipeGridSkeleton } from "@/components/recipe-grid-skeleton";
import { RecipeViewToggle } from "@/components/recipe-view-toggle";
import { getRecipes, getCategories } from "@/lib/api";
import { getSession, signPostgrestToken } from "@/lib/auth";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ categories?: string }>;
}

async function RecipeList({
  token,
  categories,
}: {
  token?: string;
  categories?: string[];
}) {
  const recipes = await getRecipes({ token, categories });
  return <RecipeGrid recipes={recipes} />;
}

export default async function AllRecipesPage({ searchParams }: PageProps) {
  const session = await getSession();
  const token = session ? await signPostgrestToken(session.email) : undefined;

  const params = await searchParams;
  const activeCategories = params.categories?.split(",").filter(Boolean);

  // Fetch categories for the filter
  const categories = await getCategories();

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
      <CategoryFilter categories={categories} />

      <Suspense fallback={<RecipeGridSkeleton />}>
        <RecipeList token={token} categories={activeCategories} />
      </Suspense>
    </div>
  );
}
