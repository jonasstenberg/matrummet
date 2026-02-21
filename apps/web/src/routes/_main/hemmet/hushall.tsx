import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_main/hemmet/hushall')({
  beforeLoad: () => {
    throw redirect({ to: '/hushall', statusCode: 301 })
  },
})
