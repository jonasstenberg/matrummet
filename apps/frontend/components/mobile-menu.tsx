"use client";

import { useAuth } from "@/components/auth-provider";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { isAdmin } from "@/lib/is-admin";
import { cn } from "@/lib/utils";
import { CalendarDays, Home, LogOut, Menu, PenLine, Settings, ShoppingCart, Sparkles, UtensilsCrossed, UserCog } from "@/lib/icons";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

function MobileNavItem({ href, icon: Icon, children, isActive, onClick }: {
  href: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
  isActive: boolean
  onClick: () => void
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        isActive
          ? 'bg-accent text-accent-foreground font-semibold'
          : 'hover:bg-accent/50'
      )}
      aria-current={isActive ? 'page' : undefined}
      onClick={onClick}
    >
      <Icon className="h-4 w-4" />
      {children}
    </Link>
  )
}

export function MobileMenu() {
  const { user, homes, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Safety guard: only render when user exists
  if (!user) return null;

  const isAdminActive = pathname.startsWith('/admin');


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
            {/* Add recipe */}
            <MobileNavItem
              href="/recept/nytt"
              icon={PenLine}
              isActive={pathname.startsWith('/recept/nytt')}
              onClick={() => setOpen(false)}
            >
              Lägg till recept
            </MobileNavItem>

            <Separator className="my-2" />

            {/* Per-home pantry + shopping list */}
            {homes.length > 0 ? (
              homes.map((home) => (
                <div key={home.home_id}>
                  {homes.length > 1 && (
                    <div className="px-3 py-1 text-xs font-medium text-muted-foreground/70">
                      {home.home_name}
                    </div>
                  )}
                  <MobileNavItem
                    href={`/hem/${home.home_id}/skafferi`}
                    icon={UtensilsCrossed}
                    isActive={pathname === `/hem/${home.home_id}/skafferi`}
                    onClick={() => setOpen(false)}
                  >
                    Skafferi
                  </MobileNavItem>
                  <MobileNavItem
                    href={`/hem/${home.home_id}/inkopslista`}
                    icon={ShoppingCart}
                    isActive={pathname.startsWith(`/hem/${home.home_id}/inkopslista`)}
                    onClick={() => setOpen(false)}
                  >
                    Inköpslista
                  </MobileNavItem>
                  <MobileNavItem
                    href={`/hem/${home.home_id}/matplan`}
                    icon={CalendarDays}
                    isActive={pathname.startsWith(`/hem/${home.home_id}/matplan`)}
                    onClick={() => setOpen(false)}
                  >
                    Veckoplanerare
                  </MobileNavItem>
                </div>
              ))
            ) : (
              <>
                <MobileNavItem
                  href="/mitt-skafferi"
                  icon={UtensilsCrossed}
                  isActive={pathname === '/mitt-skafferi'}
                  onClick={() => setOpen(false)}
                >
                  Skafferi
                </MobileNavItem>
                <MobileNavItem
                  href="/inkopslista"
                  icon={ShoppingCart}
                  isActive={pathname === '/inkopslista'}
                  onClick={() => setOpen(false)}
                >
                  Inköpslista
                </MobileNavItem>
                <MobileNavItem
                  href="/matplan"
                  icon={CalendarDays}
                  isActive={pathname === '/matplan'}
                  onClick={() => setOpen(false)}
                >
                  Matplan
                </MobileNavItem>
              </>
            )}

            <Separator className="my-2" />

            <MobileNavItem
              href="/hushall"
              icon={Home}
              isActive={pathname === '/hushall'}
              onClick={() => setOpen(false)}
            >
              Hantera hushåll
            </MobileNavItem>
            <MobileNavItem
              href="/ai-poang"
              icon={Sparkles}
              isActive={pathname === '/ai-poang'}
              onClick={() => setOpen(false)}
            >
              AI-poäng
            </MobileNavItem>
            {isAdmin(user) && (
              <MobileNavItem
                href="/admin/anvandare"
                icon={Settings}
                isActive={isAdminActive}
                onClick={() => setOpen(false)}
              >
                Admin
              </MobileNavItem>
            )}

            {/* Separator */}
            <Separator className="my-2" />

            {/* Settings and logout */}
            <MobileNavItem
              href="/installningar"
              icon={UserCog}
              isActive={pathname === '/installningar'}
              onClick={() => setOpen(false)}
            >
              Inställningar
            </MobileNavItem>
            <button
              onClick={() => {
                logout();
                setOpen(false);
              }}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-accent/50"
            >
              <LogOut className="h-4 w-4" />
              Logga ut
            </button>
          </nav>
        </div>
      </SheetContent>
    </Sheet>
  );
}
