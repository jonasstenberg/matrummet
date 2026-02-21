import { useEffect } from 'react'

export function SwRegister() {
  useEffect(() => {
    if (import.meta.env.DEV) {
      // Unregister any existing service worker in dev to avoid stale caches
      navigator.serviceWorker?.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister()
        }
      })
      return
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Registration failed — not critical for app functionality
      })
    }
  }, [])

  return null
}
