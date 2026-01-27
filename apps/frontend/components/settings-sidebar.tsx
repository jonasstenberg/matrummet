'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'

const settingsLinks = [
  { href: '/installningar', label: 'Profil' },
  { href: '/installningar/sakerhet', label: 'Säkerhet' },
  { href: '/installningar/api-nycklar', label: 'API-nycklar' },
]

const dangerLinks = [{ href: '/installningar/konto', label: 'Konto' }]

export function SettingsSidebar() {
  const pathname = usePathname()

  const getLinkStyles = (href: string, isDanger = false) => {
    const isActive = pathname === href

    if (isDanger) {
      return cn(
        'block px-3 py-2 rounded-md text-sm transition-colors',
        isActive
          ? 'bg-destructive/10 text-destructive font-medium'
          : 'text-destructive hover:text-destructive hover:bg-destructive/10'
      )
    }

    return cn(
      'block px-3 py-2 rounded-md text-sm transition-colors',
      isActive
        ? 'bg-muted text-foreground font-medium'
        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
    )
  }

  return (
    <nav aria-label="Inställningar" className="sticky top-20 space-y-6">
      <div className="space-y-1">
        {settingsLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={getLinkStyles(link.href)}
            aria-current={pathname === link.href ? 'page' : undefined}
          >
            {link.label}
          </Link>
        ))}
      </div>

      <div className="space-y-1">
        <Separator />
        <p className="px-3 pt-4 pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Farlig zon
        </p>
        {dangerLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={getLinkStyles(link.href, true)}
            aria-current={pathname === link.href ? 'page' : undefined}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
