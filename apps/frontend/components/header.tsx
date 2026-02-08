"use client";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/user-avatar";
import { isAdmin } from "@/lib/is-admin";
import {
  ChefHat,
  LogOut,
  Menu,
  UserCog,
  Plus,
  Sparkles,
  UtensilsCrossed,
  ShoppingCart,
  Home,
  Shield,
} from "@/lib/icons";
import dynamic from "next/dynamic";
import Link from "next/link";

// Dynamic import with ssr: false to prevent hydration mismatch from Radix UI's dynamic IDs
const MobileMenu = dynamic(
  () => import("./mobile-menu").then((m) => m.MobileMenu),
  {
    ssr: false,
    loading: () => (
      <button aria-label="Öppna meny" className="md:hidden">
        <Menu className="h-6 w-6" />
      </button>
    ),
  }
);

export function Header() {
  const { user, logout, credits } = useAuth();

  return (
    <header className="sticky top-0 z-50 w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto max-w-7xl px-4">
        <div className="flex h-16 items-center gap-6">
          {/* Logo */}
          <Link href="/" className="flex flex-shrink-0 items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warm">
              <ChefHat className="h-5 w-5 text-warm-foreground" />
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="font-heading text-xl font-semibold text-foreground">
                Matrummet&apos;s
              </span>
              <span className="text-xs font-medium tracking-[0.2em] text-warm">
                RECEPT
              </span>
            </div>
          </Link>

          {/* Spacer to push items to right */}
          <div className="flex-1" />

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <>
                {/* Smart imports link */}
                <Link
                  href="/smarta-importer"
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted/50"
                >
                  <Sparkles className="h-4 w-4" />
                  Smarta importer
                  {credits !== null && (
                    <Badge
                      className="min-w-[1.25rem] h-5 px-1 text-[10px] justify-center"
                      variant="default"
                    >
                      {credits}
                    </Badge>
                  )}
                </Link>

                {/* Admin Link */}
                {isAdmin(user) && (
                  <Link
                    href="/admin/anvandare"
                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted/50"
                  >
                    <Shield className="h-4 w-4" />
                    Admin
                  </Link>
                )}

                {/* Add Recipe Button */}
                <Button variant="outline" asChild>
                  <Link href="/recept/nytt">
                    <Plus className="h-4 w-4 mr-2" />
                    Lägg till recept
                  </Link>
                </Button>

                {/* User Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      aria-label="Användarmeny"
                    >
                      <UserAvatar user={user} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" sideOffset={8}>
                    <DropdownMenuLabel className="flex items-center gap-3 p-3">
                      <UserAvatar user={user} className="h-10 w-10" />
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {user.name || "Användare"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {user.email}
                        </span>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link
                        href="/mitt-skafferi"
                        className="flex items-center gap-2"
                      >
                        <UtensilsCrossed className="h-4 w-4" />
                        Mitt skafferi
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link
                        href="/inkopslista"
                        className="flex items-center gap-2"
                      >
                        <ShoppingCart className="h-4 w-4" />
                        Inköpslista
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/hushall" className="flex items-center gap-2">
                        <Home className="h-4 w-4" />
                        Hushåll
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link
                        href="/installningar"
                        className="flex items-center gap-2"
                      >
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
              </>
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
