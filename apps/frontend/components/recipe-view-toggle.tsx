"use client";

import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth-provider";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

interface RecipeViewToggleProps {
  activeView?: "mine" | "all" | "liked";
  className?: string;
}

export function RecipeViewToggle({
  activeView = "mine",
  className,
}: RecipeViewToggleProps) {
  const { user } = useAuth();
  const searchParams = useSearchParams();

  // Don't render if not logged in
  if (!user) {
    return null;
  }

  // Preserve all filter params (categories, pantry, minMatch) when switching views
  const queryString = searchParams.toString();
  const suffix = queryString ? `?${queryString}` : "";

  // Build URLs for each view
  const allUrl = `/${suffix}`;
  const mineUrl = `/mina-recept${suffix}`;
  const likedUrl = `/gillade-recept${suffix}`;

  const linkBaseClass = "relative pb-3 text-sm font-medium transition-colors";
  const activeClass = "text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-warm";
  const inactiveClass = "text-muted-foreground hover:text-foreground";

  return (
    <nav aria-label="Receptvisning" className={cn("flex gap-6 border-b border-border", className)}>
      <Link
        href={allUrl}
        className={cn(linkBaseClass, activeView === "all" ? activeClass : inactiveClass)}
      >
        Alla recept
      </Link>
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
    </nav>
  );
}
