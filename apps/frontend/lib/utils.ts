import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { ImageSize } from './image-processing'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Get the URL for a recipe image at a specific size.
 * Images are served via /api/images/{id}/{size}
 */
export function getImageUrl(
  image: string | null | undefined,
  size: ImageSize = 'full'
): string | null {
  if (!image) return null
  // Remove .webp extension if present (for backward compatibility)
  const imageId = image.replace(/\.webp$/, '')
  return `/api/images/${imageId}/${size}`
}

/**
 * Get srcSet string for responsive images.
 */
export function getImageSrcSet(image: string | null | undefined): string | null {
  if (!image) return null
  const imageId = image.replace(/\.webp$/, '')
  return [
    `/api/images/${imageId}/thumb 320w`,
    `/api/images/${imageId}/small 640w`,
    `/api/images/${imageId}/medium 960w`,
    `/api/images/${imageId}/large 1280w`,
    `/api/images/${imageId}/full 1920w`,
  ].join(', ')
}

// Neutral warm beige blur placeholder for food images
export const IMAGE_BLUR_DATA_URL = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMCwsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAAIAAoDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAYH/8QAIhAAAQMEAgMBAAAAAAAAAAAAAQIDBAAFBhEHIRITMUH/xAAVAQEBAAAAAAAAAAAAAAAAAAADBf/EABsRAAICAwEAAAAAAAAAAAAAAAECABEDITFB/9oADAMBEQCEEwA/AKLjzNsnxm9XK5X6VBuT8lx1EiOw44EhQ0ARsb0O/wBqoornZGBG2MCZ7sn/2Q=='
