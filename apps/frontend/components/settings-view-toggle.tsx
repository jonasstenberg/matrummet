"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";

type SettingsView = "profil" | "sakerhet" | "api-nycklar";

interface SettingsViewToggleProps {
  activeView: SettingsView;
  className?: string;
}

export function SettingsViewToggle({
  activeView,
  className,
}: SettingsViewToggleProps) {
  const linkBaseClass = "relative pb-3 text-sm font-medium transition-colors";
  const activeClass = "text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-warm";
  const inactiveClass = "text-muted-foreground hover:text-foreground";

  return (
    <nav aria-label="Inställningar" className={cn("flex gap-6 border-b border-border", className)}>
      <Link
        href="/installningar"
        className={cn(linkBaseClass, activeView === "profil" ? activeClass : inactiveClass)}
      >
        Profil
      </Link>
      <Link
        href="/installningar/sakerhet"
        className={cn(linkBaseClass, activeView === "sakerhet" ? activeClass : inactiveClass)}
      >
        Säkerhet
      </Link>
      <Link
        href="/installningar/api-nycklar"
        className={cn(linkBaseClass, activeView === "api-nycklar" ? activeClass : inactiveClass)}
      >
        API-nycklar
      </Link>
    </nav>
  );
}
