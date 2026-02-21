import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { ShareBookSection } from '@/components/share-book-section'
import { BookShareConnectionsList } from '@/components/book-share-connections-list'
import { getSharedBooks } from '@/lib/book-share-actions'

const fetchSharedBooks = createServerFn({ method: 'GET' }).handler(async () => {
  return getSharedBooks()
})

export const Route = createFileRoute('/_main/installningar/delning')({
  loader: () => fetchSharedBooks(),
  head: () => ({ meta: [{ title: 'Delning' }] }),
  component: PageComponent,
})

function PageComponent() {
  const connections = Route.useLoaderData()

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
