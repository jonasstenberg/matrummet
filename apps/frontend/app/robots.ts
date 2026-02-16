import type { MetadataRoute } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_URL || 'https://matrummet.se'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin/',
        '/installningar/',
        '/hushall/',
        '/mina-recept/',
        '/gillade-recept/',
        '/mitt-skafferi/',
        '/inkopslista/',
        '/smarta-importer/',
        '/recept/nytt',
        '/api/',
        '/join/',
      ],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  }
}
