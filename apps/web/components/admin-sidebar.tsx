
import { Link, useLocation } from "@tanstack/react-router";
import { adminNavItems } from "@/lib/admin-nav";
import { cn } from "@/lib/utils";

export function AdminSidebar() {
  const pathname = useLocation({ select: (s) => s.pathname });

  return (
    <nav
      aria-label="Administration"
      className="sticky top-20 rounded-2xl bg-card p-1.5 shadow-(--shadow-card)"
    >
      <div className="space-y-0.5">
        {adminNavItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-[13px] transition-colors",
                isActive
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  isActive ? "text-foreground" : "text-muted-foreground/70",
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
