"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { adminNavItems } from "@/lib/admin-nav";
import { cn } from "@/lib/utils";

export function AdminSidebar() {
  const pathname = usePathname();

  const getLinkStyles = (href: string) => {
    const isActive = pathname === href;

    return cn(
      "block px-3 py-2 rounded-md text-sm transition-colors",
      isActive
        ? "bg-muted text-foreground font-medium"
        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
    );
  };

  return (
    <nav aria-label="Administration" className="sticky top-20 space-y-1">
      {adminNavItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={getLinkStyles(item.href)}
          aria-current={pathname === item.href ? "page" : undefined}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
