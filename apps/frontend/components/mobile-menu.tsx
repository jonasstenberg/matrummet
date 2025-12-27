"use client";

import { useAuth } from "@/components/auth-provider";
import { SearchBar } from "@/components/search-bar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { isAdmin } from "@/lib/is-admin";
import { LogOut, Menu, Settings, UserCog } from "lucide-react";
import Link from "next/link";
import { Suspense, useState } from "react";

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
          <Suspense
            fallback={
              <div className="w-full h-9 bg-muted rounded-md animate-pulse" />
            }
          >
            <SearchBar />
          </Suspense>

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
                  href="/installningar"
                  className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
                  onClick={() => setOpen(false)}
                >
                  Inställningar
                </Link>
                {isAdmin(user) && (
                  <Link
                    href="/admin/kategorier"
                    className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
                    onClick={() => setOpen(false)}
                  >
                    Admin
                  </Link>
                )}
                <button
                  onClick={() => {
                    logout();
                    setOpen(false);
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
