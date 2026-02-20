import { Platform } from 'react-native'
import { PostgrestClient } from '@matrummet/api-client'
import { mobileTokenStorage } from './token-storage'

// Android emulator uses 10.0.2.2 to reach host machine's localhost
function fixLocalhost(url: string): string {
  if (Platform.OS === 'android') {
    return url.replace('localhost', '10.0.2.2')
  }
  return url
}

// In dev: Next.js serves static files from public/ at the root URL.
// In prod: point to your CDN/storage URL (e.g. https://cdn.matrummet.se/uploads).
const IMAGE_BASE_URL = fixLocalhost(
  process.env.EXPO_PUBLIC_IMAGE_BASE_URL ?? 'http://localhost:3000/uploads'
)

export const api = new PostgrestClient({
  postgrestUrl: fixLocalhost(process.env.EXPO_PUBLIC_POSTGREST_URL ?? 'http://localhost:4444'),
  jwtSecret: process.env.EXPO_PUBLIC_JWT_SECRET ?? '',
  postgrestJwtSecret: process.env.EXPO_PUBLIC_POSTGREST_JWT_SECRET ?? '',
  tokenStorage: mobileTokenStorage,
})

/**
 * Get full image URL for a recipe image ID.
 * Images are stored as {imageId}/{size}.webp on disk.
 */
export function getImageUrl(
  image: string | null | undefined,
  size: 'thumb' | 'small' | 'medium' | 'large' | 'full' = 'medium'
): string | null {
  if (!image) return null
  const imageId = image.replace(/\.webp$/, '')
  return `${IMAGE_BASE_URL}/${imageId}/${size}.webp`
}
