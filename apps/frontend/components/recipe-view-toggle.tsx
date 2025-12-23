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
