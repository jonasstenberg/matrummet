"use client";

import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth-provider";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

interface RecipeViewToggleSearchProps {
  showAll?: boolean;
  className?: string;
}

export function RecipeViewToggleSearch({
  showAll = false,
  className,
}: RecipeViewToggleSearchProps) {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const query = searchParams.get("q") || "";

  // Don't render if not logged in
  if (!user) {
    return null;
  }

  // Build URLs preserving the search query using routes
  const allUrl = query ? `/sok?q=${encodeURIComponent(query)}` : "/sok";
  const mineUrl = query
    ? `/mina-recept/sok?q=${encodeURIComponent(query)}`
    : "/mina-recept/sok";

  return (
    <div className={cn("flex gap-2", className)}>
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
    </div>
  );
}
