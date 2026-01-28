'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/hemmet/hushall', label: 'Hushåll' },
  { href: '/hemmet/medlemmar', label: 'Medlemmar' },
  { href: '/hemmet/bjud-in', label: 'Bjud in' },
]

export function HemmetPillNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Hemmet" className="overflow-x-auto">
      <div className="flex gap-2 pb-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap',
                isActive && 'bg-secondary text-secondary-foreground',
                !isActive && 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
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
