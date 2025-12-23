"use client";

import { useAuth } from "@/components/auth-provider";
import { SearchBar } from "@/components/search-bar";
import { Button } from "@/components/ui/button";
import { isAdmin } from "@/lib/is-admin";
import { ChefHat, LogOut, Menu, Plus, Settings, User, X } from "lucide-react";
import Link from "next/link";
import { Suspense, useState } from "react";

export function Header() {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 text-xl font-bold text-primary"
        >
          <ChefHat className="h-6 w-6" />
          <h1>Stenberg&apos;s Recept</h1>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-6 md:flex">
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
            <div className="relative">
              <Button
                variant="ghost"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="gap-2"
              >
                <User className="h-4 w-4" />
                {user.name || user.email}
              </Button>

              {userMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-12 z-50 w-48 rounded-md border border-border bg-popover p-1 shadow-md">
                    <Link
                      href="/recept/nytt"
                      className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <Plus className="h-4 w-4" />
                      Nytt recept
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
                </>
              )}
            </div>
          ) : (
            <Button asChild>
              <Link href="/login">Logga in</Link>
            </Button>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? "Stäng meny" : "Öppna meny"}
        >
          {mobileMenuOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <Menu className="h-6 w-6" />
          )}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="border-t border-border bg-background md:hidden">
          <div className="container mx-auto space-y-4 px-4 py-4">
            {/* Mobile Search */}
            <Suspense
              fallback={
                <div className="w-full h-9 bg-muted rounded-md animate-pulse" />
              }
            >
              <SearchBar />
            </Suspense>

            {/* Mobile Navigation */}
            <nav className="flex flex-col gap-2">
              <Link
                href="/"
                className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
                onClick={() => setMobileMenuOpen(false)}
              >
                Hem
              </Link>

              {user ? (
                <>
                  <Link
                    href="/recept/nytt"
                    className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Nytt recept
                  </Link>
                  {isAdmin(user) && (
                    <Link
                      href="/admin/kategorier"
                      className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Admin
                    </Link>
                  )}
                  <button
                    onClick={() => {
                      logout();
                      setMobileMenuOpen(false);
                    }}
                    className="rounded-md px-3 py-2 text-left text-sm font-medium hover:bg-accent"
                  >
                    Logga ut
                  </button>
                </>
              ) : (
                <Link
                  href="/login"
                  className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Logga in
                </Link>
              )}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
