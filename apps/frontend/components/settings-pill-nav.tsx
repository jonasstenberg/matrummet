'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/installningar', label: 'Profil' },
  { href: '/installningar/sakerhet', label: 'Säkerhet' },
  { href: '/installningar/api-nycklar', label: 'API-nycklar' },
  { href: '/installningar/konto', label: 'Konto' },
]

export function SettingsPillNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Inställningar" className="overflow-x-auto">
      <div className="flex gap-2 pb-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          const isDanger = item.href.includes('/konto')

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap',
                isActive && !isDanger && 'bg-warm text-warm-foreground',
                isActive && isDanger && 'bg-destructive text-destructive-foreground',
                !isActive && !isDanger && 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground',
                !isActive && isDanger && 'bg-muted text-destructive hover:bg-destructive/10'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
