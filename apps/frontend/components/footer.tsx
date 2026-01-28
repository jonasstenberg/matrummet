import { CookieSettingsButton } from '@/components/cookie-consent-banner'

export function Footer() {
  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="container mx-auto max-w-7xl px-4 py-6">
        <div className="flex flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Recept</p>
          <CookieSettingsButton />
        </div>
      </div>
    </footer>
  )
}
