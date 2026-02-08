import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['sharp'],
  outputFileTracingIncludes: {
    '/*': ['node_modules/sharp/**/*'],
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 31536000,
  },

  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
        ],
      },
    ]
  },

  async redirects() {
    return [
      {
        source: '/installningar/hemmet',
        destination: '/hushall',
        permanent: true,
      },
      {
        source: '/hemmet',
        destination: '/hushall',
        permanent: true,
      },
      {
        source: '/hemmet/hushall',
        destination: '/hushall',
        permanent: true,
      },
      {
        source: '/hemmet/medlemmar',
        destination: '/hushall/medlemmar',
        permanent: true,
      },
    ]
  },
}

export default nextConfig
