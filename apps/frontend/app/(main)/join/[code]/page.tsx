import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { JoinHomeClient } from './join-home-client'

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
