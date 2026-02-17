import type { Metadata } from 'next'
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { JoinHomeClient } from './join-home-client'

export const metadata: Metadata = {
  title: 'Gå med i hushåll',
  description: 'Du har blivit inbjuden att gå med i ett hushåll på Matrummet',
  openGraph: {
    title: 'Gå med i hushåll',
    description: 'Du har blivit inbjuden att gå med i ett hushåll på Matrummet',
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Matrummet' }],
    locale: 'sv_SE',
    siteName: 'Matrummet',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Gå med i hushåll',
    description: 'Du har blivit inbjuden att gå med i ett hushåll på Matrummet',
    images: ['/og-image.png'],
  },
}

interface JoinPageProps {
  params: Promise<{ code: string }>
}

export default async function JoinPage({ params }: JoinPageProps) {
  const { code } = await params
  const session = await getSession()

  if (!session) {
    // Redirect to login with return URL
    const returnUrl = encodeURIComponent(`/join/${code}`)
    redirect(`/login?returnUrl=${returnUrl}`)
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <JoinHomeClient code={code} userEmail={session.email} />
    </div>
  )
}
