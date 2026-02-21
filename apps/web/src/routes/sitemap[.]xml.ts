import { createFileRoute } from '@tanstack/react-router'
import { env } from '@/lib/env'

const BASE_URL = env.APP_URL || 'https://matrummet.se'

export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: async () => {
        interface SitemapEntry {
          loc: string
          lastmod?: string
          changefreq: string
          priority: string
        }

        const staticPages: SitemapEntry[] = [
          { loc: BASE_URL, changefreq: 'daily', priority: '1.0' },
          { loc: `${BASE_URL}/om`, changefreq: 'monthly', priority: '0.5' },
          { loc: `${BASE_URL}/integritetspolicy`, changefreq: 'yearly', priority: '0.3' },
          { loc: `${BASE_URL}/villkor`, changefreq: 'yearly', priority: '0.3' },
        ]

        let recipePages: SitemapEntry[] = []
        try {
          const res = await fetch(
            `${env.POSTGREST_URL}/featured_recipes?select=id,date_modified`,
            { cache: 'no-store' },
          )
          if (res.ok) {
            const recipes: Array<{ id: string; date_modified: string | null }> = await res.json()
            recipePages = recipes.map((recipe) => ({
              loc: `${BASE_URL}/recept/${recipe.id}`,
              lastmod: recipe.date_modified ? new Date(recipe.date_modified).toISOString().split('T')[0] : undefined,
              changefreq: 'weekly',
              priority: '0.8',
            }))
          }
        } catch {
          // Sitemap still works with static pages if PostgREST is unavailable
        }

        const allPages = [...staticPages, ...recipePages]
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages
  .map(
    (page) => `  <url>
    <loc>${page.loc}</loc>${page.lastmod ? `\n    <lastmod>${page.lastmod}</lastmod>` : ''}
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`,
  )
  .join('\n')}
</urlset>`

        return new Response(xml, {
          headers: {
            'Content-Type': 'application/xml',
            'Cache-Control': 'public, max-age=3600',
          },
        })
      },
    },
  },
})
