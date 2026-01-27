import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function HomeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  if (!session) {
    redirect('/login')
  }
  return (
    <div className="max-w-4xl mx-auto">
      {children}
    </div>
  )
}
