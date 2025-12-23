import { CategoryFilter } from "@/components/category-filter";
import { RecipeGrid } from "@/components/recipe-grid";
import { RecipeGridSkeleton } from "@/components/recipe-grid-skeleton";
import { RecipeViewToggle } from "@/components/recipe-view-toggle";
import { Button } from "@/components/ui/button";
import { getRecipes } from "@/lib/api";
import { getSession } from "@/lib/auth";
import Link from "next/link";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

async function RecipeList({ ownerEmail }: { ownerEmail?: string }) {
  const recipes = await getRecipes(ownerEmail ? { owner: ownerEmail } : undefined);
  return <RecipeGrid recipes={recipes} />;
}

export default async function HomePage() {
  const session = await getSession();
  const isLoggedIn = !!session;

  // When logged in, show user's recipes. When not logged in, show all.
  const ownerEmail = isLoggedIn ? session.email : undefined;
  const title = isLoggedIn ? "Mina recept" : "Alla recept";
  const subtitle = isLoggedIn
    ? "Dina egna recept"
    : "Utforska och upptäck recept";

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            {title}
          </h1>
          <p className="mt-2 text-lg text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <RecipeViewToggle isLoggedIn={isLoggedIn} />
          {isLoggedIn && (
            <Button asChild variant="outline">
              <Link href="/recept/nytt">Lägg till recept</Link>
            </Button>
          )}
        </div>
      </header>

      {/* Category Filter */}
      <Suspense fallback={<div className="h-10" />}>
        <CategoryFilter />
      </Suspense>

      <Suspense fallback={<RecipeGridSkeleton />}>
        <RecipeList ownerEmail={ownerEmail} />
      </Suspense>
    </div>
  );
}
