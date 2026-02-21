import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_main/gillade-recept')({
  beforeLoad: () => {
    throw redirect({ to: '/' })
  },
})
