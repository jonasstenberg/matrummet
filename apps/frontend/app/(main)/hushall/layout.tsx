import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function HushallLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  if (!session) {
    redirect('/login')
  }

  return <div className="max-w-2xl mx-auto space-y-6">{children}</div>
}
