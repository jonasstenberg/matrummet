
import type { ComponentType } from 'react'
import { Link } from '@tanstack/react-router'
import { useLocation } from '@tanstack/react-router'
import type { FileRouteTypes } from '@/src/routeTree.gen'
import { cn } from '@/lib/utils'
import { User, Lock, Key, Download, Trash2, Share2 } from '@/lib/icons'

type NavLink = { href: FileRouteTypes['to']; label: string; icon: ComponentType<{ className?: string }> }

const settingsLinks: NavLink[] = [
  { href: '/installningar', label: 'Profil', icon: User },
  { href: '/installningar/sakerhet', label: 'Säkerhet', icon: Lock },
  { href: '/installningar/delning', label: 'Delning', icon: Share2 },
  { href: '/installningar/api-nycklar', label: 'API-nycklar', icon: Key },
  { href: '/installningar/data', label: 'Data', icon: Download },
]

const dangerLinks: NavLink[] = [
  { href: '/installningar/konto', label: 'Konto', icon: Trash2 },
]

export function SettingsSidebar() {
  const { pathname } = useLocation()

  return (
    <nav aria-label="Inställningar" className="sticky top-20 space-y-4">
      <div className="rounded-2xl bg-card shadow-(--shadow-card)">
        {settingsLinks.map((link, i) => {
          const isActive = pathname === link.href
          const Icon = link.icon

          return (
            <Link
              key={link.href}
              to={link.href}
              className={cn(
                'flex items-center gap-3 px-4 py-3 text-[15px] transition-colors',
                i > 0 && 'border-t border-border/40',
                isActive
                  ? 'font-medium text-foreground bg-muted/40'
                  : 'text-muted-foreground hover:bg-muted/30 hover:text-foreground'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="h-4 w-4 shrink-0 opacity-60" />
              {link.label}
            </Link>
          )
        })}
      </div>

      <div className="rounded-2xl bg-card shadow-(--shadow-card)">
        {dangerLinks.map((link) => {
          const isActive = pathname === link.href
          const Icon = link.icon

          return (
            <Link
              key={link.href}
              to={link.href}
              className={cn(
                'flex items-center gap-3 rounded-2xl px-4 py-3 text-[15px] text-destructive transition-colors',
                isActive
                  ? 'font-medium bg-destructive/5'
                  : 'hover:bg-destructive/5'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {link.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
