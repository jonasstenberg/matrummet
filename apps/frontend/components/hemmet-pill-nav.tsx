'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useRef, useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/hemmet/hushall', label: 'Hushåll' },
  { href: '/hemmet/medlemmar', label: 'Medlemmar' },
  { href: '/hemmet/bjud-in', label: 'Bjud in' },
]

export function HemmetPillNav() {
  const pathname = usePathname()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [hasOverflow, setHasOverflow] = useState(false)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const checkOverflow = () => {
      setHasOverflow(el.scrollWidth > el.clientWidth)
    }

    checkOverflow()
    // Re-check on resize
    const observer = new ResizeObserver(checkOverflow)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <nav aria-label="Hemmet">
      <div
        ref={scrollRef}
        className={cn(
          'overflow-x-auto',
          hasOverflow && 'mask-x-from-5% mask-x-to-95%'
        )}
      >
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
      </div>
    </nav>
  )
}
