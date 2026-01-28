'use client'

import { useState } from 'react'
import { Cookie } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  getConsent,
  setConsent,
  hasConsent,
  resetConsent,
  DEFAULT_CONSENT,
  type CookieConsent,
} from '@/lib/cookie-consent'

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(() => {
    if (typeof window === 'undefined') return false
    return !hasConsent()
  })
  const [showDetails, setShowDetails] = useState(false)
  const [consent, setConsentState] = useState<CookieConsent>(
    () => getConsent() ?? DEFAULT_CONSENT
  )

  const handleAcceptAll = () => {
    const allAccepted: CookieConsent = {
      necessary: true,
      payment: true,
    }
    setConsent(allAccepted)
    setVisible(false)
  }

  const handleSaveChoice = () => {
    setConsent(consent)
    setVisible(false)
  }

  const handleRejectNonEssential = () => {
    const minimal: CookieConsent = {
      necessary: true,
      payment: false,
    }
    setConsent(minimal)
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 animate-in slide-in-from-bottom bg-card border-t border-border shadow-lg">
      <div className="container mx-auto max-w-4xl px-4 py-4">
        <div className="flex flex-col gap-4">
          {/* Header */}
          <div className="flex items-start gap-3">
            <Cookie className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div className="flex-1">
              <h2 className="text-base font-semibold">Vi använder cookies</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Den här webbplatsen använder cookies för att säkerställa att du
                får bästa möjliga upplevelse. Nödvändiga cookies krävs för att
                webbplatsen ska fungera.
              </p>
            </div>
          </div>

          {/* Details toggle */}
          <div>
            <Button
              variant="link"
              size="sm"
              onClick={() => setShowDetails(!showDetails)}
              className="h-auto p-0 text-sm"
            >
              {showDetails ? 'Dölj detaljer' : 'Visa detaljer'}
            </Button>
          </div>

          {/* Cookie categories (expanded) */}
          {showDetails && (
            <div className="flex flex-col gap-3 border-t border-border pt-3">
              {/* Necessary cookies */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="font-medium text-sm">Nödvändiga cookies</div>
                  <div className="text-xs text-muted-foreground">
                    Krävs för att webbplatsen ska fungera, inklusive inloggning
                    och sessionshantering
                  </div>
                </div>
                <Switch checked={true} disabled />
              </div>

              {/* Payment cookies */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="font-medium text-sm">Betalningscookies</div>
                  <div className="text-xs text-muted-foreground">
                    Krävs för betalningar via Stripe
                  </div>
                </div>
                <Switch
                  checked={consent.payment}
                  onCheckedChange={(checked) =>
                    setConsentState({ ...consent, payment: checked })
                  }
                />
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleAcceptAll}>Acceptera alla</Button>
            <Button variant="outline" onClick={handleSaveChoice}>
              Spara val
            </Button>
            <Button
              variant="ghost"
              onClick={handleRejectNonEssential}
              className="text-sm"
            >
              Avvisa icke nödvändiga
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Button for footer that allows users to change cookie preferences.
 * Resets consent and reloads the page to show the banner again.
 */
export function CookieSettingsButton() {
  const handleClick = () => {
    resetConsent()
    window.location.reload()
  }

  return (
    <button
      onClick={handleClick}
      className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline cursor-pointer transition-colors"
    >
      Cookie-inställningar
    </button>
  )
}
