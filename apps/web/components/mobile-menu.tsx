
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
import { BookOpen, CalendarDays, Home, LogOut, Menu, PenLine, Settings, ShoppingCart, Sparkles, UtensilsCrossed, UserCog } from "@/lib/icons";
import { Link, useLocation } from "@tanstack/react-router";
import type { FileRouteTypes } from '@/src/routeTree.gen'
import { useState } from "react";

function mobileNavClass(isActive: boolean) {
  return cn(
    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-accent text-accent-foreground font-semibold'
      : 'hover:bg-accent/50'
  )
}

function MobileNavItem({ to, icon: Icon, children, isActive, onClick }: {
  to: FileRouteTypes['to']
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
  isActive: boolean
  onClick: () => void
}) {
  return (
    <Link
      to={to}
      className={mobileNavClass(isActive)}
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
  const pathname = useLocation({ select: (s) => s.pathname });

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
              to="/recept/nytt"
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
                  <Link
                    to="/hem/$homeId/skafferi"
                    params={{ homeId: home.home_id }}
                    className={mobileNavClass(pathname === `/hem/${home.home_id}/skafferi`)}
                    aria-current={pathname === `/hem/${home.home_id}/skafferi` ? 'page' : undefined}
                    onClick={() => setOpen(false)}
                  >
                    <UtensilsCrossed className="h-4 w-4" />
                    Skafferi
                  </Link>
                  <Link
                    to="/hem/$homeId/inkopslista"
                    params={{ homeId: home.home_id }}
                    className={mobileNavClass(pathname.startsWith(`/hem/${home.home_id}/inkopslista`))}
                    aria-current={pathname.startsWith(`/hem/${home.home_id}/inkopslista`) ? 'page' : undefined}
                    onClick={() => setOpen(false)}
                  >
                    <ShoppingCart className="h-4 w-4" />
                    Inköpslista
                  </Link>
                  <Link
                    to="/hem/$homeId/matplan"
                    params={{ homeId: home.home_id }}
                    className={mobileNavClass(pathname.startsWith(`/hem/${home.home_id}/matplan`))}
                    aria-current={pathname.startsWith(`/hem/${home.home_id}/matplan`) ? 'page' : undefined}
                    onClick={() => setOpen(false)}
                  >
                    <CalendarDays className="h-4 w-4" />
                    Veckoplanerare
                  </Link>
                </div>
              ))
            ) : (
              <>
                <MobileNavItem
                  to="/mitt-skafferi"
                  icon={UtensilsCrossed}
                  isActive={pathname === '/mitt-skafferi'}
                  onClick={() => setOpen(false)}
                >
                  Skafferi
                </MobileNavItem>
                <MobileNavItem
                  to="/inkopslista"
                  icon={ShoppingCart}
                  isActive={pathname === '/inkopslista'}
                  onClick={() => setOpen(false)}
                >
                  Inköpslista
                </MobileNavItem>
                <MobileNavItem
                  to="/matplan"
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
              to="/hushall"
              icon={Home}
              isActive={pathname === '/hushall'}
              onClick={() => setOpen(false)}
            >
              Hantera hushåll
            </MobileNavItem>
            <MobileNavItem
              to="/installningar/delning"
              icon={BookOpen}
              isActive={pathname === '/installningar/delning'}
              onClick={() => setOpen(false)}
            >
              Dela receptbok
            </MobileNavItem>
            <MobileNavItem
              to="/ai-poang"
              icon={Sparkles}
              isActive={pathname === '/ai-poang'}
              onClick={() => setOpen(false)}
            >
              AI-poäng
            </MobileNavItem>
            {isAdmin(user) && (
              <MobileNavItem
                to="/admin/anvandare"
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
              to="/installningar"
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
