'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { HomeCreateDialog } from './home-create-dialog'
import { Home } from 'lucide-react'

interface HomeSetupWizardProps {
  onCreateHome: (name: string) => Promise<void>
}

export function HomeSetupWizard({
  onCreateHome,
}: HomeSetupWizardProps) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold">Kom igång med ditt hem</h2>
        <p className="text-muted-foreground">
          Skapa ett hem för att dela recept och inköpslistor med familj och vänner.
        </p>
      </div>

      <Card className="relative overflow-hidden hover:border-primary/50 transition-colors cursor-pointer max-w-md mx-auto">
        <CardHeader>
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 mb-2">
            <Home className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-lg">Skapa nytt hem</CardTitle>
          <CardDescription>
            Starta ett nytt hem och bjud in familjemedlemmar eller vänner.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <HomeCreateDialog
            onCreateHome={onCreateHome}
            trigger={
              <button className="absolute inset-0 w-full h-full opacity-0 cursor-pointer">
                Skapa nytt hem
              </button>
            }
          />
        </CardContent>
      </Card>

      <p className="text-center text-sm text-muted-foreground">
        Har du fått en inbjudan? Klicka på länken i meddelandet för att gå med.
      </p>
    </div>
  )
}
