const CACHE_VERSION = 'v2'
const STATIC_CACHE = `static-${CACHE_VERSION}`
const IMAGE_CACHE = `images-${CACHE_VERSION}`
const FONT_CACHE = `fonts-${CACHE_VERSION}`
const PAGE_CACHE = `pages-${CACHE_VERSION}`

const ALL_CACHES = [STATIC_CACHE, IMAGE_CACHE, FONT_CACHE, PAGE_CACHE]

const IMAGE_CACHE_LIMIT = 100
const OFFLINE_URL = '/offline'

// Precache the offline page on install
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PAGE_CACHE).then((cache) => cache.add(OFFLINE_URL))
  )
  self.skipWaiting()
})

// Clean up old caches on activate
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => !ALL_CACHES.includes(key))
          .map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== 'GET') return

  // Skip API routes — auth-sensitive, should not be cached
  if (url.pathname.startsWith('/api/')) return

  // Skip PostgREST calls
  if (url.port === '4444') return

  // Next.js static assets — cache-first (content-hashed)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
    return
  }

  // Images — cache-first with size limit
  if (
    url.pathname.startsWith('/uploads/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/_next/image')
  ) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE, IMAGE_CACHE_LIMIT))
    return
  }

  // Google Fonts — cache-first
  if (
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com'
  ) {
    event.respondWith(cacheFirst(request, FONT_CACHE))
    return
  }

  // Page navigations — network-first, fall back to cache, then offline page
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstWithOffline(request))
    return
  }
})

// Cache-first: try cache, fall back to network (and cache the response)
async function cacheFirst(request, cacheName, limit) {
  const cached = await caches.match(request)
  if (cached) return cached

  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, response.clone())

      if (limit) trimCache(cacheName, limit)
    }
    return response
  } catch {
    return new Response('', { status: 408 })
  }
}

// Network-first for navigations, with offline fallback
async function networkFirstWithOffline(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(PAGE_CACHE)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await caches.match(request)
    if (cached) return cached

    const offlinePage = await caches.match(OFFLINE_URL)
    return offlinePage || new Response('Offline', { status: 503 })
  }
}

// Trim cache to a max number of entries
async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName)
  const keys = await cache.keys()
  if (keys.length > maxItems) {
    await cache.delete(keys[0])
    trimCache(cacheName, maxItems)
  }
}
