"use client";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { DesktopNav } from "@/components/desktop-nav";
import { UserAvatar } from "@/components/user-avatar";
import { ChefHat, LogOut, Menu, UserCog } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";

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

  return (
    <header className="sticky top-0 z-50 w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto max-w-7xl px-4">
        <div className="flex h-16 items-center gap-6">
          {/* Logo */}
          <Link
            href="/"
            className="flex flex-shrink-0 items-center gap-3"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warm">
              <ChefHat className="h-5 w-5 text-warm-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="font-heading text-xl font-semibold text-foreground">Matrummet&apos;s</span>
              <span className="text-xs font-medium tracking-[0.2em] text-warm">RECEPT</span>
            </div>
          </Link>

          {/* Desktop Nav */}
          {user && (
            <div className="hidden md:flex items-center">
              <DesktopNav />
            </div>
          )}

          {/* Spacer to push items to right */}
          <div className="flex-1" />

          {/* Desktop User Dropdown */}
          <div className="hidden md:flex items-center">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" aria-label="Användarmeny">
                    <UserAvatar user={user} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={8}>
                  <DropdownMenuItem asChild>
                    <Link href="/installningar" className="flex items-center gap-2">
                      <UserCog className="h-4 w-4" />
                      Inställningar
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={logout}
                    className="flex items-center gap-2"
                  >
                    <LogOut className="h-4 w-4" />
                    Logga ut
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="outline" asChild>
                  <Link href="/login">Logga in</Link>
                </Button>
                <Button asChild>
                  <Link href="/registrera">Skapa konto</Link>
                </Button>
              </div>
            )}
          </div>

          {/* Mobile Menu / Mobile Auth */}
          {user ? (
            <MobileMenu />
          ) : (
            <div className="md:hidden flex items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/login">Logga in</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/registrera">Skapa konto</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
