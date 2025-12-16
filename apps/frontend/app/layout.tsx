import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

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
      <body className={inter.className}>
        <div className="flex min-h-screen flex-col">
          {children}
        </div>
      </body>
    </html>
  )
}
