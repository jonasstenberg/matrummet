import { createFileRoute } from '@tanstack/react-router'
import { ResetPasswordForm } from '@/components/reset-password-form'

export const Route = createFileRoute('/_auth/reset-password/$token')({
  head: () => ({
    meta: [{ title: 'Återställ lösenord | Matrummet' }],
  }),
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  const { token } = Route.useParams()
  return <ResetPasswordForm token={token} />
}
