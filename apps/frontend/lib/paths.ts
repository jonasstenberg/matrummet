import { join } from 'path'

/**
 * Get the directory path for storing uploaded files.
 * Configurable via DATA_FILES_DIR env var for production (e.g. persistent volume).
 * Defaults to public/uploads relative to the app directory for local dev.
 */
export function getDataFilesDir(): string {
  return process.env.DATA_FILES_DIR || join(process.cwd(), 'public', 'uploads')
}
