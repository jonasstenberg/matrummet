import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Get the URL for a recipe image.
 * Images are served via /api/images/ which reads from /data/files/
 */
export function getImageUrl(image: string | null | undefined): string | null {
  if (!image) return null
  return `/api/images/${image}`
}

// Neutral warm beige blur placeholder for food images
export const IMAGE_BLUR_DATA_URL = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMCwsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAAIAAoDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAYH/8QAIhAAAQMEAgMBAAAAAAAAAAAAAQIDBAAFBhEHIRITMUH/xAAVAQEBAAAAAAAAAAAAAAAAAAADBf/EABsRAAICAwEAAAAAAAAAAAAAAAECABEDITFB/9oADAMBEQCEEwA/AKLjzNsnxm9XK5X6VBuT8lx1EiOw44EhQ0ARsb0O/wBqoornZGBG2MCZ7sn/2Q=='
