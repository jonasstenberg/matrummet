import { join } from 'path'

/**
 * Get the directory path for storing uploaded files.
 * Uses public/uploads relative to the app directory.
 */
export function getDataFilesDir(): string {
  return join(process.cwd(), 'public', 'uploads')
}
