import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_main/mina-recept/')({
  beforeLoad: () => {
    throw redirect({ to: '/' })
  },
})
