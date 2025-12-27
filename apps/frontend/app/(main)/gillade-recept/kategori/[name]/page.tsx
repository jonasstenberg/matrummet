import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getLikedRecipes } from "@/lib/api";
import { getSession, signPostgrestToken } from "@/lib/auth";
import { RecipeGrid } from "@/components/recipe-grid";
import { CategoryFilter } from "@/components/category-filter";
import { RecipeViewToggle } from "@/components/recipe-view-toggle";
import { Button } from "@/components/ui/button";
import { redirect } from "next/navigation";

interface CategoryPageProps {
  params: Promise<{ name: string }>;
}

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { name } = await params;
  const categoryName = decodeURIComponent(name);

  return {
    title: `${categoryName} - Gillade recept`,
    description: `Gillade ${categoryName.toLowerCase()}-recept`,
  };
}

export default async function LikedRecipesCategoryPage({
  params,
}: CategoryPageProps) {
  const { name } = await params;
  const categoryName = decodeURIComponent(name);

  const session = await getSession();

  // Protected route - redirect to login if not authenticated
  if (!session) {
    redirect("/login");
  }

  const token = await signPostgrestToken(session.email);

  const recipes = await getLikedRecipes(token, {
    category: categoryName,
  });

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <div>
        <Button variant="ghost" asChild className="gap-2">
          <Link href="/gillade-recept">
            <ArrowLeft className="h-4 w-4" />
            Tillbaka
          </Link>
        </Button>
      </div>

      {/* Category Header */}
      <header>
        <h1 className="font-heading text-3xl font-bold text-foreground">
          {categoryName}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {recipes.length === 0 && "Inga gillade recept i denna kategori"}
          {recipes.length === 1 && "1 gillat recept"}
          {recipes.length > 1 && `${recipes.length} gillade recept`}
        </p>
      </header>

      {/* View Toggle Tabs */}
      <RecipeViewToggle
        categoryName={categoryName}
        activeView="liked"
      />

      {/* Category Filter */}
      <CategoryFilter activeCategory={categoryName} basePath="/gillade-recept" />

      {/* Recipe Grid */}
      <RecipeGrid recipes={recipes} />
    </div>
  );
}
