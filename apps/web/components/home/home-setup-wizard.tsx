
import { useRouter } from '@tanstack/react-router'
import { HomeCreateDialog } from './home-create-dialog'
import { Home } from '@/lib/icons'
import { createHome } from '@/lib/home-actions'

export function HomeSetupWizard() {
  const router = useRouter()

  async function handleCreateHome(name: string) {
    const result = await createHome(name)
    if ('error' in result) throw new Error(result.error)
    router.invalidate()
  }

  return (
    <div className="flex flex-col items-center py-16 space-y-6">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
        <Home className="h-8 w-8 text-primary" />
      </div>

      <div className="text-center space-y-2 max-w-sm">
        <h2 className="text-xl font-semibold">
          Kom igång med ditt hushåll
        </h2>
        <p className="text-sm text-muted-foreground">
          Skapa ett hushåll för att dela recept och inköpslistor med familj och
          vänner.
        </p>
      </div>

      <HomeCreateDialog
        onCreateHome={handleCreateHome}
        trigger={
          <button
            type="button"
            className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Skapa hushåll
          </button>
        }
      />

      <p className="text-xs text-muted-foreground/60">
        Har du fått en inbjudan? Klicka på länken i meddelandet för att gå med.
      </p>
    </div>
  )
}
