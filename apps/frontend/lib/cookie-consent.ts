export interface CookieConsent {
  necessary: true // Always true, cannot be toggled off
  functional: boolean // Login session cookies (auth-token)
  payment: boolean // Stripe payment cookies
}

export const CONSENT_KEY = 'cookie-consent'

export const DEFAULT_CONSENT: CookieConsent = {
  necessary: true,
  functional: true, // On by default since login requires it
  payment: false, // Off by default
}

/**
 * Get stored cookie consent from localStorage.
 * @returns CookieConsent object if stored, null if no consent stored yet
 */
export function getConsent(): CookieConsent | null {
  if (typeof window === 'undefined') return null

  try {
    const stored = localStorage.getItem(CONSENT_KEY)
    if (!stored) return null

    const parsed = JSON.parse(stored) as CookieConsent
    return parsed
  } catch {
    return null
  }
}

/**
 * Store cookie consent to localStorage.
 */
export function setConsent(consent: CookieConsent): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify(consent))
  } catch {
    // Silently fail if localStorage is unavailable
  }
}

/**
 * Check if user has already provided consent (interacted with banner).
 */
export function hasConsent(): boolean {
  if (typeof window === 'undefined') return false

  return localStorage.getItem(CONSENT_KEY) !== null
}

/**
 * Check if user has consented to payment cookies.
 * Use this before initiating Stripe checkout.
 */
export function hasPaymentConsent(): boolean {
  const consent = getConsent()
  return consent !== null && consent.payment === true
}

/**
 * Reset consent (removes from localStorage).
 * Used for "change preferences" flow.
 */
export function resetConsent(): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.removeItem(CONSENT_KEY)
  } catch {
    // Silently fail if localStorage is unavailable
  }
}
