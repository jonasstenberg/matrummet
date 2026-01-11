"use client";

import { useAuth } from "@/components/auth-provider";
import { getUserPantry } from "@/lib/ingredient-search-actions";
import { useEffect, useState } from "react";

interface UsePantryResult {
  pantryFoodIds: Set<string>;
  isLoading: boolean;
  error: string | null;
}

export function usePantry(): UsePantryResult {
  const { user } = useAuth();
  const [pantryFoodIds, setPantryFoodIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    (async () => {
      setIsLoading(true);
      try {
        const result = await getUserPantry();
        if ("error" in result) {
          setError(result.error);
        } else {
          setPantryFoodIds(new Set(result.map((item) => item.food_id)));
        }
      } catch {
        setError("Kunde inte hämta skafferiet");
      } finally {
        setIsLoading(false);
      }
    })();
  }, [user]);

  return { pantryFoodIds, isLoading, error };
}
