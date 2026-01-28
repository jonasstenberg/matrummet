'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useAuth } from '@/components/auth-provider'
import { isAdmin } from '@/lib/is-admin'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/mitt-skafferi', label: 'Mitt skafferi' },
  { href: '/inkopslista', label: 'Inköpslista' },
  { href: '/hemmet', label: 'Mitt hem' },
]

export function DesktopNav() {
  const pathname = usePathname()
  const { user } = useAuth()
  const [credits, setCredits] = useState<number | null>(null)

  useEffect(() => {
    async function fetchCredits() {
      try {
        const response = await fetch('/api/credits/balance')
        if (response.ok) {
          const data = await response.json()
          setCredits(data.balance)
        }
      } catch (error) {
        // Silent fail - badge won't show if credits can't be loaded
        console.error('Failed to load credits:', error)
      }
    }

    fetchCredits()
  }, [])

  const navLinkClass = (isActive: boolean) =>
    cn(
      'relative px-3 py-2 text-sm font-medium transition-colors rounded-md',
      'hover:bg-muted/50',
      'after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[3px] after:rounded-full after:bg-accent',
      'after:transition-transform after:duration-200 after:ease-out',
      isActive ? 'text-foreground after:scale-x-100' : 'text-muted-foreground after:scale-x-0'
    )

  const isAdminActive = pathname.startsWith('/admin')
  const isCreditsActive = pathname === '/krediter'

  return (
    <nav aria-label="Huvudnavigering">
      <div className="flex items-center gap-1">
        {/* Text nav items */}
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={navLinkClass(isActive)}
              aria-current={isActive ? 'page' : undefined}
            >
              {item.label}
            </Link>
          )
        })}

        {/* AI-krediter with icon, text, and badge */}
        <Link
          href="/krediter"
          className={cn(
            navLinkClass(isCreditsActive),
            'inline-flex items-center gap-1.5'
          )}
          aria-current={isCreditsActive ? 'page' : undefined}
        >
          <Sparkles className="h-4 w-4" />
          AI-krediter
          {credits !== null && (
            <Badge
              className="min-w-[1.25rem] h-5 px-1 text-[10px]"
              variant="default"
            >
              {credits}
            </Badge>
          )}
        </Link>

        {/* Admin nav item (admin-gated) */}
        {isAdmin(user) && (
          <Link
            href="/admin/anvandare"
            className={navLinkClass(isAdminActive)}
            aria-current={isAdminActive ? 'page' : undefined}
          >
            Admin
          </Link>
        )}
      </div>
    </nav>
  )
}
