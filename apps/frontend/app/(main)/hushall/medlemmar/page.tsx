import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getHomeInfo } from '@/lib/home-api'
import { MedlemmarClient } from '@/components/home/medlemmar-client'

export default async function MedlemmarPage() {
  const { home, userEmail } = await getHomeInfo()

  if (!home) {
    redirect('/hushall')
  }

  return (
    <>
      <header>
        <Link
          href="/hushall"
          className="inline-flex items-center gap-1 text-sm text-primary mb-3 -ml-1 transition-colors hover:text-primary/80"
        >
          <ChevronLeft className="h-4 w-4" />
          Hushåll
        </Link>
        <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground">
          Medlemmar
        </h1>
      </header>
      <MedlemmarClient home={home} userEmail={userEmail} />
    </>
  )
}
