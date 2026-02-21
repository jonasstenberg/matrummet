import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_main/alla-recept/')({
  beforeLoad: () => {
    throw redirect({ to: '/' })
  },
})
