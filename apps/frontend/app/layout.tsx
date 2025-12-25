import type { Metadata } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'
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
      </body>
    </html>
  )
}
