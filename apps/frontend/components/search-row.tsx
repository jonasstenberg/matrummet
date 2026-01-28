"use client";

import { SearchBar } from "@/components/search-bar";
import { Suspense } from "react";

export function SearchRow() {
  return (
    <div className="w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto max-w-7xl px-4 py-3">
        <div className="mx-auto max-w-2xl">
          <Suspense
            fallback={
              <div className="w-full h-10 bg-muted rounded-full animate-pulse" />
            }
          >
            <SearchBar className="w-full" />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
