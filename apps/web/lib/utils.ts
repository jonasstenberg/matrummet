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
  return `/api/images/${image}/${size}`
}

/**
 * Get srcSet string for responsive images.
 */
export function getImageSrcSet(image: string | null | undefined): string | null {
  if (!image) return null
  return [
    `/api/images/${image}/thumb 320w`,
    `/api/images/${image}/small 640w`,
    `/api/images/${image}/medium 960w`,
    `/api/images/${image}/large 1280w`,
    `/api/images/${image}/full 1920w`,
  ].join(', ')
}

/**
 * Build a URL with search params, filtering out undefined values.
 */
export function buildSearchUrl(pathname: string, params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter((e): e is [string, string] => e[1] !== undefined)
  if (entries.length === 0) return pathname
  return `${pathname}?${new URLSearchParams(entries)}`
}

// Neutral warm beige blur placeholder for food images
export const IMAGE_BLUR_DATA_URL = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMCwsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAAIAAoDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAYH/8QAIhAAAQMEAgMBAAAAAAAAAAAAAQIDBAAFBhEHIRITMUH/xAAVAQEBAAAAAAAAAAAAAAAAAAADBf/EABsRAAICAwEAAAAAAAAAAAAAAAECABEDITFB/9oADAMBEQCEEwA/AKLjzNsnxm9XK5X6VBuT8lx1EiOw44EhQ0ARsb0O/wBqoornZGBG2MCZ7sn/2Q=='
