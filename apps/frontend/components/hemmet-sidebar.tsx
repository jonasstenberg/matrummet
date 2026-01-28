'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const hemmetLinks = [
  { href: '/hemmet/hushall', label: 'Hushåll' },
  { href: '/hemmet/medlemmar', label: 'Medlemmar' },
  { href: '/hemmet/bjud-in', label: 'Bjud in' },
]

export function HemmetSidebar() {
  const pathname = usePathname()

  const getLinkStyles = (href: string) => {
    const isActive = pathname === href

    return cn(
      'block px-3 py-2 rounded-md text-sm transition-colors',
      isActive
        ? 'bg-secondary/10 text-secondary font-medium'
        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
    )
  }

  return (
    <nav aria-label="Hemmet" className="sticky top-20 space-y-1">
      {hemmetLinks.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={getLinkStyles(link.href)}
          aria-current={pathname === link.href ? 'page' : undefined}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  )
}
