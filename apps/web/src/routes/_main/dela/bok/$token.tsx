import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { Link } from '@tanstack/react-router'
import { getBookShareInfo } from '@/lib/book-share-actions'
import { getSession } from '@/lib/auth'
import { AcceptBookShareView } from '@/components/accept-book-share-view'

const fetchBookShare = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ token: z.string() }))
  .handler(async ({ data: { token } }) => {
    const [info, session] = await Promise.all([
      getBookShareInfo(token),
      getSession(),
    ])

    return {
      info,
      isAuthenticated: !!session,
      token,
    }
  })

export const Route = createFileRoute('/_main/dela/bok/$token')({
  loader: ({ params }) =>
    fetchBookShare({ data: { token: params.token } }),
  head: ({ loaderData }) => {
    if (!loaderData?.info) {
      return {
        meta: [
          { title: 'Delad receptbok' },
          {
            name: 'description',
            content: 'Denna delningslänk är ogiltig eller har gått ut',
          },
        ],
      }
    }

    const { info } = loaderData
    const title = `${info.sharer_name}s receptbok`
    const description = `${info.sharer_name} vill dela sin receptbok med dig (${info.recipe_count} recept)`

    return {
      meta: [
        { title },
        { name: 'description', content: description },
        { property: 'og:title', content: title },
        { property: 'og:description', content: description },
        { property: 'og:type', content: 'website' },
        { property: 'og:image', content: '/og-image.png' },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
        { property: 'og:image:alt', content: 'Matrummet' },
        { property: 'og:locale', content: 'sv_SE' },
        { property: 'og:site_name', content: 'Matrummet' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: title },
        { name: 'twitter:description', content: description },
        { name: 'twitter:image', content: '/og-image.png' },
      ],
    }
  },
  component: BookSharePage,
})

function BookSharePage() {
  const { info, isAuthenticated, token } = Route.useLoaderData()

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

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
        <h1 className="mb-2 text-2xl font-bold">
          {info.sharer_name}s receptbok
        </h1>
        <p className="mb-6 text-muted-foreground">
          {info.sharer_name} vill dela sin receptbok med dig (
          {info.recipe_count} recept).
        </p>
        <Link
          to="/login"
          search={{ returnUrl: `/dela/bok/${token}` }}
          className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
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
          to="/"
          className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Gå till startsidan
        </Link>
      </div>
    )
  }

  return <AcceptBookShareView info={info} token={token} />
}
