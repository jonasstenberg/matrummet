import type { Metadata, Viewport } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'
import { CookieConsentBanner } from '@/components/cookie-consent-banner'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-heading',
})

export const metadata: Metadata = {
  title: 'Recept',
  description: 'Hantera dina favoritrecept',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="sv">
      <body className={`${inter.className} ${playfair.variable}`}>
        <div className="flex min-h-screen flex-col">
          {children}
        </div>
        <CookieConsentBanner />
      </body>
    </html>
  )
}
