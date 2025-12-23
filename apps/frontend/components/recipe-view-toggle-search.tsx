"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

interface RecipeViewToggleSearchProps {
  isLoggedIn: boolean;
  showAll?: boolean;
  className?: string;
}

export function RecipeViewToggleSearch({
  isLoggedIn,
  showAll = false,
  className,
}: RecipeViewToggleSearchProps) {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") || "";

  // Don't render if not logged in
  if (!isLoggedIn) {
    return null;
  }

  // Build URLs preserving the search query using routes
  const mineUrl = query ? `/sok?q=${encodeURIComponent(query)}` : "/sok";
  const allUrl = query
    ? `/alla-recept/sok?q=${encodeURIComponent(query)}`
    : "/alla-recept/sok";

  return (
    <div className={cn("flex gap-2", className)}>
      <Link
        href={mineUrl}
        className={cn(
          "rounded-full px-4 py-2 text-sm font-medium transition-colors",
          !showAll
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        )}
      >
        Mina recept
      </Link>
      <Link
        href={allUrl}
        className={cn(
          "rounded-full px-4 py-2 text-sm font-medium transition-colors",
          showAll
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        )}
      >
        Alla recept
      </Link>
    </div>
  );
}
