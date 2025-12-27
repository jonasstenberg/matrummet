import { CategoryFilter } from "@/components/category-filter";
import { HomeHeader } from "@/components/home-header";
import { RecipeGrid } from "@/components/recipe-grid";
import { RecipeGridSkeleton } from "@/components/recipe-grid-skeleton";
import { RecipeViewToggle } from "@/components/recipe-view-toggle";
import { getRecipes } from "@/lib/api";
import { getSession, signPostgrestToken } from "@/lib/auth";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

async function RecipeList({ ownerEmail, token }: { ownerEmail?: string; token?: string }) {
  const recipes = await getRecipes(ownerEmail ? { owner: ownerEmail, token } : { token });
  return <RecipeGrid recipes={recipes} />;
}

export default async function HomePage() {
  const session = await getSession();
  const token = session ? await signPostgrestToken(session.email) : undefined;

  // When logged in, show user's recipes. When not logged in, show all.
  const ownerEmail = session ? session.email : undefined;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <HomeHeader />

      {/* View Toggle Tabs */}
      <RecipeViewToggle activeView="mine" />

      {/* Category Filter */}
      <Suspense fallback={<div className="h-10" />}>
        <CategoryFilter />
      </Suspense>

      <Suspense fallback={<RecipeGridSkeleton />}>
        <RecipeList ownerEmail={ownerEmail} token={token} />
      </Suspense>
    </div>
  );
}
