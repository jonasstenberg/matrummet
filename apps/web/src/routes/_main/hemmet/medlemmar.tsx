import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_main/hemmet/medlemmar')({
  beforeLoad: () => {
    throw redirect({ to: '/hushall/medlemmar', statusCode: 301 })
  },
})
