import { createFileRoute } from '@tanstack/react-router'
import { env } from '@/lib/env'

const BASE_URL = env.APP_URL || 'https://matrummet.se'

export const Route = createFileRoute('/robots.txt')({
  server: {
    handlers: {
      GET: () => {
        const content = `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /installningar/
Disallow: /hushall/
Disallow: /hem/
Disallow: /mina-recept/
Disallow: /gillade-recept/
Disallow: /mitt-skafferi/
Disallow: /inkopslista/
Disallow: /ai-poang/
Disallow: /matplan/
Disallow: /recept/nytt
Disallow: /api/
Disallow: /join/

Sitemap: ${BASE_URL}/sitemap.xml`

        return new Response(content, {
          headers: { 'Content-Type': 'text/plain' },
        })
      },
    },
  },
})
