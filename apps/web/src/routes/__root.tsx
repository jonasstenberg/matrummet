/// <reference types="vite/client" />
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'
import * as React from 'react'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource-variable/playfair-display'
import { SwRegister } from '@/components/sw-register'
import { Toaster } from '@/components/ui/sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import appCss from '@/styles/globals.css?url'

export const Route = createRootRoute({
  errorComponent: RootErrorComponent,
  notFoundComponent: RootNotFoundComponent,
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
      },
      { title: 'Matrummet - Din digitala receptsamling' },
      {
        name: 'description',
        content:
          'Samla, organisera och dela dina favoritrecept på ett ställe. Svensk recepthantering med smart sökning och inköpslistor.',
      },
      { name: 'keywords', content: 'recept,receptsamling,matlagning,svensk mat,inköpslista,måltidsplanering,recept app' },
      { property: 'og:type', content: 'website' },
      { property: 'og:locale', content: 'sv_SE' },
      { property: 'og:url', content: 'https://matrummet.se' },
      { property: 'og:site_name', content: 'Matrummet' },
      { property: 'og:title', content: 'Matrummet - Din digitala receptsamling' },
      {
        property: 'og:description',
        content:
          'Samla, organisera och dela dina favoritrecept på ett ställe. Svensk recepthantering med smart sökning och inköpslistor.',
      },
      { property: 'og:image', content: 'https://matrummet.se/og-image.png' },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: 'Matrummet - Din digitala receptsamling' },
      {
        name: 'twitter:description',
        content:
          'Samla, organisera och dela dina favoritrecept på ett ställe. Svensk recepthantering med smart sökning och inköpslistor.',
      },
      { name: 'twitter:image', content: 'https://matrummet.se/og-image.png' },
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
      { name: 'apple-mobile-web-app-title', content: 'Matrummet' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'manifest', href: '/manifest.json' },
      { rel: 'icon', href: '/favicon.svg' },
      { rel: 'apple-touch-icon', href: '/icons/icon-192.png' },
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv">
      <head>
        <HeadContent />
      </head>
      <body className="font-sans">
        <SwRegister />
        <Toaster />
        <div className="flex min-h-screen flex-col">{children}</div>
        <Scripts />
      </body>
    </html>
  )
}

function RootErrorComponent({ error, reset }: ErrorComponentProps) {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Något gick fel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {error.message || 'Ett oväntat fel inträffade.'}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button onClick={reset} className="flex-1">
              Försök igen
            </Button>
            <Button variant="outline" className="flex-1" asChild>
              <Link to="/">Gå till startsidan</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function RootNotFoundComponent() {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sidan hittades inte</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Sidan du letar efter finns inte eller har flyttats.
          </p>
          <Button asChild>
            <Link to="/">Gå till startsidan</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
