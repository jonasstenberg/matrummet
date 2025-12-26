import Link from 'next/link'
import { ResetPasswordForm } from '@/components/reset-password-form'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { validatePasswordResetToken } from '@/lib/api'

interface ResetPasswordPageProps {
  params: Promise<{
    token: string
  }>
}

export default async function ResetPasswordPage({
  params,
}: ResetPasswordPageProps) {
  const { token } = await params
  const validationResult = await validatePasswordResetToken(token)

  if (!validationResult.valid) {
    return (
      <div className="space-y-6">
        <div className="space-y-2 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">
            Ogiltig återställningslänk
          </h2>
          <p className="text-sm text-muted-foreground">
            Länken har antingen utgått eller redan använts
          </p>
        </div>
        <Alert variant="destructive">
          <AlertDescription>
            Återställningslänken är ogiltig eller har utgått. Länkar är giltiga
            i 24 timmar och kan endast användas en gång.
          </AlertDescription>
        </Alert>
        <div className="space-y-3">
          <Button asChild className="w-full">
            <Link href="/login?forgot=true">Begär ny återställningslänk</Link>
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            <Link
              href="/login"
              className="text-primary hover:underline font-medium"
            >
              Tillbaka till inloggning
            </Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-semibold tracking-tight">
          Återställ lösenord
        </h2>
        <p className="text-sm text-muted-foreground">
          Ange ditt nya lösenord nedan
        </p>
      </div>
      <ResetPasswordForm token={token} />
    </div>
  )
}
