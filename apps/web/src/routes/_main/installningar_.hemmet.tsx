import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_main/installningar_/hemmet')({
  beforeLoad: () => {
    throw redirect({ to: '/hushall', statusCode: 301 })
  },
})
