"use client";

import { useAuth } from "@/components/auth-provider";
import { SearchBar } from "@/components/search-bar";
import { Button } from "@/components/ui/button";
import { isAdmin } from "@/lib/is-admin";
import { ChefHat, LogOut, Menu, Settings, User, UserCog } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";

// Dynamic import with ssr: false to prevent hydration mismatch from Radix UI's dynamic IDs
const MobileMenu = dynamic(() => import("./mobile-menu").then((m) => m.MobileMenu), {
  ssr: false,
  loading: () => (
    <button aria-label="Öppna meny" className="md:hidden">
      <Menu className="h-6 w-6" />
    </button>
  ),
});

export function Header() {
  const { user, logout } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }

    if (userMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [userMenuOpen]);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-3"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warm">
            <ChefHat className="h-5 w-5 text-warm-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="font-heading text-xl font-semibold text-foreground">Stenberg&apos;s</span>
            <span className="text-xs font-medium tracking-[0.2em] text-warm">RECEPT</span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav aria-label="Huvudnavigering" className="hidden items-center gap-6 md:flex">
          {/* Search Bar */}
          <Suspense
            fallback={
              <div className="w-96 h-10 bg-muted rounded-full animate-pulse" />
            }
          >
            <SearchBar className="w-96" />
          </Suspense>
        </nav>

        {/* Desktop Auth Section */}
        <div className="hidden items-center gap-4 md:flex">
          {user ? (
            <div ref={userMenuRef} className="relative">
              <Button
                variant="ghost"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="gap-2"
              >
                <User className="h-4 w-4" />
                {user.name || user.email}
              </Button>

              {userMenuOpen && (
                <div className="absolute right-0 top-12 z-50 w-48 rounded-md border border-border bg-popover p-1 shadow-md">
                    <Link
                      href="/installningar"
                      className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <UserCog className="h-4 w-4" />
                      Inställningar
                    </Link>
                    {isAdmin(user) && (
                      <Link
                        href="/admin/kategorier"
                        className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <Settings className="h-4 w-4" />
                        Admin
                      </Link>
                    )}
                    <button
                      onClick={() => {
                        logout();
                        setUserMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                    >
                      <LogOut className="h-4 w-4" />
                      Logga ut
                    </button>
                  </div>
              )}
            </div>
          ) : (
            <Button asChild>
              <Link href="/login">Logga in</Link>
            </Button>
          )}
        </div>

        {/* Mobile Menu */}
        <MobileMenu />
      </div>
    </header>
  );
}
