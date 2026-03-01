import { Platform } from 'react-native'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
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
  String(process.env.EXPO_PUBLIC_IMAGE_BASE_URL ?? 'http://localhost:3000/uploads')
)

export const api = new PostgrestClient({
  postgrestUrl: fixLocalhost(String(process.env.EXPO_PUBLIC_POSTGREST_URL ?? 'http://localhost:4444')),
  jwtSecret: String(process.env.EXPO_PUBLIC_JWT_SECRET ?? ''),
  postgrestJwtSecret: String(process.env.EXPO_PUBLIC_POSTGREST_JWT_SECRET ?? ''),
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
  return `${IMAGE_BASE_URL}/${image}/${size}`
}

const IMAGE_UPLOAD_URL = fixLocalhost(
  String(process.env.EXPO_PUBLIC_IMAGE_BASE_URL ?? 'http://localhost:4006/images')
    .replace(/\/images$/, '/upload')
)

/**
 * Upload an image to the image service.
 * Converts HEIC/HEIF to JPEG before uploading (image service lacks HEIC decoder).
 * Returns the image filename on success.
 */
export async function uploadImage(uri: string): Promise<string> {
  // Convert to JPEG to avoid HEIC issues on iOS
  const imageRef = await ImageManipulator.manipulate(uri).renderAsync()
  const converted = await imageRef.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 })

  const formData = new FormData()
  formData.append('file', {
    uri: converted.uri,
    name: 'photo.jpg',
    type: 'image/jpeg',
  })

  const token = await mobileTokenStorage.getAppToken()

  const response = await fetch(IMAGE_UPLOAD_URL, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'multipart/form-data',
    },
    body: formData,
  })

  if (!response.ok) {
    throw new Error('Kunde inte ladda upp bilden')
  }

  const data = await response.json()
  return data.filename
}
