'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useRef, useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/installningar', label: 'Profil' },
  { href: '/installningar/sakerhet', label: 'Säkerhet' },
  { href: '/installningar/delning', label: 'Delning' },
  { href: '/installningar/api-nycklar', label: 'API-nycklar' },
  { href: '/installningar/data', label: 'Data' },
  { href: '/installningar/konto', label: 'Konto' },
]

export function SettingsPillNav() {
  const pathname = usePathname()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const checkScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return

    const { scrollLeft, scrollWidth, clientWidth } = el
    setCanScrollLeft(scrollLeft > 1)
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    checkScroll()

    el.addEventListener('scroll', checkScroll)
    const observer = new ResizeObserver(checkScroll)
    observer.observe(el)

    return () => {
      el.removeEventListener('scroll', checkScroll)
      observer.disconnect()
    }
  }, [checkScroll])

  return (
    <nav aria-label="Inställningar" className="rounded-2xl bg-card p-1.5 shadow-(--shadow-card)">
      <div className="relative">
        <div
          ref={scrollRef}
          className="flex gap-1 overflow-x-auto scrollbar-none"
        >
          {navItems.map((item) => {
            const isActive = pathname === item.href
            const isDanger = item.href.includes('/konto')

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex-shrink-0 px-3.5 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap',
                  isActive && !isDanger && 'bg-muted/60 text-foreground',
                  isActive && isDanger && 'bg-destructive/10 text-destructive',
                  !isActive && !isDanger && 'text-muted-foreground hover:text-foreground',
                  !isActive && isDanger && 'text-destructive/70 hover:text-destructive'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                {item.label}
              </Link>
            )
          })}
        </div>

        <div
          className={cn(
            'pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-card to-transparent transition-opacity duration-200',
            canScrollLeft ? 'opacity-100' : 'opacity-0'
          )}
        />
        <div
          className={cn(
            'pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-card to-transparent transition-opacity duration-200',
            canScrollRight ? 'opacity-100' : 'opacity-0'
          )}
        />
      </div>
    </nav>
  )
}
