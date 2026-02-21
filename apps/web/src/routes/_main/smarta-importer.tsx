import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_main/smarta-importer')({
  beforeLoad: () => {
    throw redirect({ to: '/ai-poang', statusCode: 301 })
  },
})
