import type { Metadata, Viewport } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'
import { SwRegister } from '@/components/sw-register'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-heading',
})

export const metadata: Metadata = {
  title: {
    default: 'Matrummet - Din digitala receptsamling',
    template: '%s | Matrummet',
  },
  description: 'Samla, organisera och dela dina favoritrecept på ett ställe. Svensk recepthantering med smart sökning och inköpslistor.',
  keywords: ['recept', 'receptsamling', 'matlagning', 'svensk mat', 'inköpslista', 'måltidsplanering', 'recept app'],
  authors: [{ name: 'Matrummet' }],
  creator: 'Matrummet',
  metadataBase: new URL('https://matrummet.se'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'sv_SE',
    url: 'https://matrummet.se',
    siteName: 'Matrummet',
    title: 'Matrummet - Din digitala receptsamling',
    description: 'Samla, organisera och dela dina favoritrecept på ett ställe. Svensk recepthantering med smart sökning och inköpslistor.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Matrummet - Din digitala receptsamling',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Matrummet - Din digitala receptsamling',
    description: 'Samla, organisera och dela dina favoritrecept på ett ställe. Svensk recepthantering med smart sökning och inköpslistor.',
    images: ['/og-image.png'],
  },
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.svg',
    apple: '/icons/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Matrummet',
  },
  robots: {
    index: true,
    follow: true,
  },
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
        <SwRegister />
        <Toaster />
        <div className="flex min-h-screen flex-col">
          {children}
        </div>
      </body>
    </html>
  )
}
