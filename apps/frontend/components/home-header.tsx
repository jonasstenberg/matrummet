'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/components/auth-provider'

export function HomeHeader() {
  const { user } = useAuth()
  const isLoggedIn = !!user

  const title = isLoggedIn ? 'Mina recept' : 'Alla recept'
  const subtitle = isLoggedIn
    ? 'Dina egna recept'
    : 'Utforska och upptäck recept'

  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground">
          {title}
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">{subtitle}</p>
      </div>
      {isLoggedIn && (
        <Button asChild className="bg-warm text-warm-foreground hover:bg-warm/90 shrink-0">
          <Link href="/recept/nytt">Lägg till recept</Link>
        </Button>
      )}
    </header>
  )
}
