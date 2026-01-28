"use client";

import { SearchBar } from "@/components/search-bar";
import { useEffect, useRef, useState, Suspense } from "react";

export function SearchRow() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const isMobile = window.innerWidth < 768;

      // Update scroll shadow state (desktop only)
      setIsScrolled(currentScrollY > 10);

      // Mobile scroll-away behavior
      if (isMobile) {
        const scrollDelta = currentScrollY - lastScrollY.current;

        // Scrolling down past threshold: hide
        if (scrollDelta > 0 && currentScrollY > 50) {
          setIsHidden(true);
        }
        // Scrolling up: show immediately
        else if (scrollDelta < 0) {
          setIsHidden(false);
        }
      } else {
        // Desktop: never hidden
        setIsHidden(false);
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div
      className={`
        w-full border-t border-border
        bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60
        transition-transform duration-300
        ${isHidden ? "-translate-y-full" : "translate-y-0"}
        md:sticky md:top-16 md:z-40 md:translate-y-0
        ${isScrolled ? "md:shadow-md transition-shadow duration-200" : "transition-shadow duration-200"}
      `}
    >
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
