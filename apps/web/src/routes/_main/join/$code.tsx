import { createFileRoute, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { JoinHomeClient } from '@/components/join-home-client'

const checkJoinAuth = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ code: z.string() }))
  .handler(async ({ data: { code } }) => {
    const session = await getSession()
    if (!session) {
      throw redirect({
        to: '/login',
        search: { returnUrl: `/join/${code}` },
      })
    }
    return session
  })

export const Route = createFileRoute('/_main/join/$code')({
  beforeLoad: async ({ params }) => {
    const session = await checkJoinAuth({ data: { code: params.code } })
    return { session }
  },
  loader: ({ context, params }) => ({
    code: params.code,
    userEmail: context.session.email,
  }),
  head: () => ({
    meta: [
      { title: 'Gå med i hushåll' },
      {
        name: 'description',
        content:
          'Du har blivit inbjuden att gå med i ett hushåll på Matrummet',
      },
      { property: 'og:title', content: 'Gå med i hushåll' },
      {
        property: 'og:description',
        content:
          'Du har blivit inbjuden att gå med i ett hushåll på Matrummet',
      },
      { property: 'og:type', content: 'website' },
      { property: 'og:image', content: '/og-image.png' },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { property: 'og:image:alt', content: 'Matrummet' },
      { property: 'og:locale', content: 'sv_SE' },
      { property: 'og:site_name', content: 'Matrummet' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: 'Gå med i hushåll' },
      {
        name: 'twitter:description',
        content:
          'Du har blivit inbjuden att gå med i ett hushåll på Matrummet',
      },
      { name: 'twitter:image', content: '/og-image.png' },
    ],
  }),
  component: JoinPage,
})

function JoinPage() {
  const { code, userEmail } = Route.useLoaderData()

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <JoinHomeClient code={code} userEmail={userEmail} />
    </div>
  )
}
