"use client";

import { useState, useEffect } from "react";
import { Check, Plus } from "@/lib/icons";
import type { CategoryGroup } from "@/lib/types";

interface CategorySelectorProps {
  selectedCategories: string[];
  onChange: (categories: string[]) => void;
  groups?: string[];
  disabled?: boolean;
}

export function CategorySelector({
  selectedCategories,
  onChange,
  groups: filterGroups,
  disabled,
}: CategorySelectorProps) {
  const [allGroups, setAllGroups] = useState<CategoryGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchCategories() {
      try {
        const response = await fetch("/api/categories");
        if (!response.ok) throw new Error("Failed to fetch");
        const data: CategoryGroup[] = await response.json();
        setAllGroups(data);
      } catch (error) {
        console.error("Failed to fetch categories:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchCategories();
  }, []);

  const groups = filterGroups
    ? allGroups.filter((g) => filterGroups.includes(g.name))
    : allGroups;

  function toggleCategory(category: string) {
    if (selectedCategories.includes(category)) {
      onChange(selectedCategories.filter((c) => c !== category));
    } else {
      onChange([...selectedCategories, category]);
    }
  }

  return (
    <div className="space-y-4">
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Laddar kategorier...</p>
      ) : (
        groups.map((group) => (
          <div key={group.name}>
            <h4 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {group.name}
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {group.categories.map((category) => {
                const isSelected = selectedCategories.includes(category);
                return (
                  <button
                    key={category}
                    type="button"
                    disabled={disabled}
                    className={
                      isSelected
                        ? "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors bg-primary text-primary-foreground"
                        : "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors bg-muted hover:bg-primary hover:text-primary-foreground disabled:opacity-50"
                    }
                    onClick={() => toggleCategory(category)}
                  >
                    {isSelected ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Plus className="h-3 w-3" />
                    )}
                    {category}
                  </button>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
