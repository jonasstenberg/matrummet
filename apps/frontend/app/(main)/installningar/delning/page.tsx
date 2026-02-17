import type { Metadata } from 'next'
import { ShareBookSection } from '@/components/share-book-section'
import { BookShareConnectionsList } from '@/components/book-share-connections-list'
import { getSharedBooks } from '@/lib/book-share-actions'

export const metadata: Metadata = {
  title: 'Delning',
}

export default async function SettingsSharingPage() {
  const connections = await getSharedBooks()

  return (
    <>
      <header>
        <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground">
          Delning
        </h1>
      </header>
      <ShareBookSection />
      <BookShareConnectionsList initialConnections={connections} />
    </>
  )
}
