"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";

interface RecipeViewToggleProps {
  isLoggedIn: boolean;
  categoryName?: string;
  showAll?: boolean;
  className?: string;
}

export function RecipeViewToggle({
  isLoggedIn,
  categoryName,
  showAll = false,
  className,
}: RecipeViewToggleProps) {
  // Don't render if not logged in
  if (!isLoggedIn) {
    return null;
  }

  // Build URLs for "mine" and "all" views
  const mineUrl = categoryName
    ? `/kategori/${encodeURIComponent(categoryName)}`
    : "/";
  const allUrl = categoryName
    ? `/alla-recept/kategori/${encodeURIComponent(categoryName)}`
    : "/alla-recept";

  return (
    <nav aria-label="Receptvisning" className={cn("flex gap-6 border-b border-border", className)}>
      <Link
        href={mineUrl}
        className={cn(
          "relative pb-3 text-sm font-medium transition-colors",
          !showAll
            ? "text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-warm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        Mina recept
      </Link>
      <Link
        href={allUrl}
        className={cn(
          "relative pb-3 text-sm font-medium transition-colors",
          showAll
            ? "text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-warm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        Alla recept
      </Link>
    </nav>
  );
}
