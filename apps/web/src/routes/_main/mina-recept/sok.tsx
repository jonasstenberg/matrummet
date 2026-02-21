import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'

export const Route = createFileRoute('/_main/mina-recept/sok')({
  validateSearch: (search) =>
    z.object({ q: z.string().optional().catch(undefined) }).parse(search),
  beforeLoad: ({ search }) => {
    throw redirect({ to: '/sok', search: search.q ? { q: search.q } : {} })
  },
})
