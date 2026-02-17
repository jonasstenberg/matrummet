import type { Metadata } from 'next'
import { getBookShareInfo } from '@/lib/book-share-actions'
import { getSession } from '@/lib/auth'
import { AcceptBookShareView } from '@/components/accept-book-share-view'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

interface BookSharePageProps {
  params: Promise<{ token: string }>
}

export async function generateMetadata({ params }: BookSharePageProps): Promise<Metadata> {
  const { token } = await params
  const info = await getBookShareInfo(token)

  if (!info) {
    return {
      title: 'Delad receptbok',
      description: 'Denna delningslänk är ogiltig eller har gått ut',
    }
  }

  const title = `${info.sharer_name}s receptbok`
  const description = `${info.sharer_name} vill dela sin receptbok med dig (${info.recipe_count} recept)`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Matrummet' }],
      locale: 'sv_SE',
      siteName: 'Matrummet',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/og-image.png'],
    },
  }
}

export default async function BookSharePage({ params }: BookSharePageProps) {
  const { token } = await params
  const [info, session] = await Promise.all([
    getBookShareInfo(token),
    getSession(),
  ])

  if (!info) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
        <h1 className="mb-2 text-2xl font-bold">Länken är ogiltig</h1>
        <p className="text-muted-foreground">
          Delningslänken finns inte, har gått ut, eller har återkallats.
        </p>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
        <h1 className="mb-2 text-2xl font-bold">{info.sharer_name}s receptbok</h1>
        <p className="mb-6 text-muted-foreground">
          {info.sharer_name} vill dela sin receptbok med dig ({info.recipe_count} recept).
        </p>
        <Link
          href={`/login?redirect=/dela/bok/${token}`}
          className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Logga in för att acceptera
        </Link>
      </div>
    )
  }

  if (info.already_connected) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
        <h1 className="mb-2 text-2xl font-bold">Redan ansluten</h1>
        <p className="mb-6 text-muted-foreground">
          Du följer redan {info.sharer_name}s receptbok.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Gå till startsidan
        </Link>
      </div>
    )
  }

  return <AcceptBookShareView info={info} token={token} />
}
