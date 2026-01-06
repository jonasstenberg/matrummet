import { CategoryFilter } from "@/components/category-filter";
import { RecipeGrid } from "@/components/recipe-grid";
import { RecipeGridSkeleton } from "@/components/recipe-grid-skeleton";
import { RecipeViewToggle } from "@/components/recipe-view-toggle";
import { getLikedRecipes, getCategories } from "@/lib/api";
import { getSession, signPostgrestToken } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ categories?: string }>;
}

async function LikedRecipeList({
  token,
  categories,
}: {
  token: string;
  categories?: string[];
}) {
  const recipes = await getLikedRecipes(token, { categories });
  return <RecipeGrid recipes={recipes} />;
}

export default async function LikedRecipesPage({ searchParams }: PageProps) {
  const session = await getSession();

  // Protected route - redirect to login if not authenticated
  if (!session) {
    redirect("/login");
  }

  const token = await signPostgrestToken(session.email);

  const params = await searchParams;
  const activeCategories = params.categories?.split(",").filter(Boolean);

  // Fetch categories for the filter
  const categories = await getCategories();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <header>
        <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground">
          Gillade recept
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Recept du har sparat
        </p>
      </header>

      {/* View Toggle Tabs */}
      <Suspense fallback={null}>
        <RecipeViewToggle activeView="liked" />
      </Suspense>

      {/* Category Filter */}
      <CategoryFilter categories={categories} />

      <Suspense fallback={<RecipeGridSkeleton />}>
        <LikedRecipeList token={token} categories={activeCategories} />
      </Suspense>
    </div>
  );
}
