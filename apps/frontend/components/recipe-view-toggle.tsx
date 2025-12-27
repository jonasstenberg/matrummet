"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";

interface RecipeViewToggleProps {
  isLoggedIn: boolean;
  categoryName?: string;
  activeView?: "mine" | "all" | "liked";
  className?: string;
}

export function RecipeViewToggle({
  isLoggedIn,
  categoryName,
  activeView = "mine",
  className,
}: RecipeViewToggleProps) {
  // Don't render if not logged in
  if (!isLoggedIn) {
    return null;
  }

  // Build URLs for each view
  const mineUrl = categoryName
    ? `/kategori/${encodeURIComponent(categoryName)}`
    : "/";
  const likedUrl = categoryName
    ? `/gillade-recept/kategori/${encodeURIComponent(categoryName)}`
    : "/gillade-recept";
  const allUrl = categoryName
    ? `/alla-recept/kategori/${encodeURIComponent(categoryName)}`
    : "/alla-recept";

  const linkBaseClass = "relative pb-3 text-sm font-medium transition-colors";
  const activeClass = "text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-warm";
  const inactiveClass = "text-muted-foreground hover:text-foreground";

  return (
    <nav aria-label="Receptvisning" className={cn("flex gap-6 border-b border-border", className)}>
      <Link
        href={mineUrl}
        className={cn(linkBaseClass, activeView === "mine" ? activeClass : inactiveClass)}
      >
        Mina recept
      </Link>
      <Link
        href={likedUrl}
        className={cn(linkBaseClass, activeView === "liked" ? activeClass : inactiveClass)}
      >
        Gillade recept
      </Link>
      <Link
        href={allUrl}
        className={cn(linkBaseClass, activeView === "all" ? activeClass : inactiveClass)}
      >
        Alla recept
      </Link>
    </nav>
  );
}
