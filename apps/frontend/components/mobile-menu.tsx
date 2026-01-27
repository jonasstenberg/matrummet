"use client";

import { useAuth } from "@/components/auth-provider";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { isAdmin } from "@/lib/is-admin";
import { LogOut, Menu, Plus, Settings, ShoppingCart, Sparkles, UtensilsCrossed, UserCog } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export function MobileMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild className="md:hidden">
        <button aria-label="Öppna meny">
          <Menu className="h-6 w-6" />
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-80">
        <SheetHeader>
          <SheetTitle>Meny</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-6">
          <nav aria-label="Mobilmeny" className="flex flex-col gap-2">
            <Link
              href="/"
              className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
              onClick={() => setOpen(false)}
            >
              Hem
            </Link>

            {user ? (
              <>
                <Link
                  href="/recept/nytt"
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
                  onClick={() => setOpen(false)}
                >
                  <Plus className="h-4 w-4" />
                  Lägg till recept
                </Link>
                <Link
                  href="/mitt-skafferi"
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
                  onClick={() => setOpen(false)}
                >
                  <UtensilsCrossed className="h-4 w-4" />
                  Mitt skafferi
                </Link>
                <Link
                  href="/inkopslista"
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
                  onClick={() => setOpen(false)}
                >
                  <ShoppingCart className="h-4 w-4" />
                  Inköpslista
                </Link>
                <Link
                  href="/krediter"
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
                  onClick={() => setOpen(false)}
                >
                  <Sparkles className="h-4 w-4" />
                  AI-krediter
                </Link>
                <Link
                  href="/installningar"
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
                  onClick={() => setOpen(false)}
                >
                  <UserCog className="h-4 w-4" />
                  Inställningar
                </Link>
                {isAdmin(user) && (
                  <Link
                    href="/admin/kategorier"
                    className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
                    onClick={() => setOpen(false)}
                  >
                    <Settings className="h-4 w-4" />
                    Admin
                  </Link>
                )}
                <button
                  onClick={() => {
                    logout();
                    setOpen(false);
                  }}
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium hover:bg-accent"
                >
                  <LogOut className="h-4 w-4" />
                  Logga ut
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
                onClick={() => setOpen(false)}
              >
                Logga in
              </Link>
            )}
          </nav>
        </div>
      </SheetContent>
    </Sheet>
  );
}
