#!/usr/bin/env tsx

/**
 * Migration script to convert flat .webp images to the new directory structure
 * with multiple size variants.
 *
 * This script is self-contained and doesn't depend on other project files,
 * so it can run in production environments.
 *
 * This script:
 * 1. Scans public/uploads/ for existing .webp files (flat structure)
 * 2. For each file:
 *    - Reads the image buffer
 *    - Creates a subdirectory named after the UUID (filename without .webp)
 *    - Generates all size variants
 *    - Deletes the original flat .webp file
 * 3. Skips any directories (already migrated images)
 * 4. Logs progress and any errors
 * 5. Supports a --dry-run flag to show what would happen without making changes
 *
 * Usage:
 *   npx tsx scripts/migrate-images.ts [--dry-run]
 *   npx tsx scripts/migrate-images.ts /path/to/uploads [--dry-run]
 */

import { readdir, stat, unlink, readFile, mkdir } from 'fs/promises'
import { join, extname, basename, isAbsolute } from 'path'
import sharp from 'sharp'

// Inline image sizes and generation to make script self-contained
const IMAGE_SIZES = {
  thumb: { width: 320, height: 240 },
  small: { width: 640, height: 480 },
  medium: { width: 960, height: 720 },
  large: { width: 1280, height: 960 },
  full: { width: 1920, height: 1440 },
} as const

const WEBP_QUALITY = 85

async function generateImageVariants(
  inputBuffer: Buffer,
  outputDir: string
): Promise<void> {
  await mkdir(outputDir, { recursive: true })

  await Promise.all(
    Object.entries(IMAGE_SIZES).map(async ([sizeName, dimensions]) => {
      const outputPath = join(outputDir, `${sizeName}.webp`)
      await sharp(inputBuffer)
        .resize(dimensions.width, dimensions.height, {
          fit: 'cover',
          position: 'center',
        })
        .webp({ quality: WEBP_QUALITY })
        .toFile(outputPath)
    })
  )
}

// Parse command line arguments
function parseArgs(): { uploadsDir: string; dryRun: boolean } {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const pathArgs = args.filter((arg) => !arg.startsWith('--'))

  let uploadsDir: string
  if (pathArgs.length > 0) {
    // Use provided path
    uploadsDir = isAbsolute(pathArgs[0])
      ? pathArgs[0]
      : join(process.cwd(), pathArgs[0])
  } else {
    // Default to public/uploads in current directory
    uploadsDir = join(process.cwd(), 'public', 'uploads')
  }

  return { uploadsDir, dryRun }
}

interface MigrationResult {
  imageId: string
  originalPath: string
  originalSize: number
  newDir: string
  sizesGenerated: string[]
  action: 'migrated' | 'skipped' | 'error'
  error?: string
}

interface Stats {
  totalFound: number
  migrated: number
  skipped: number
  errors: number
  totalOriginalSize: number
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

/**
 * Check if a path is a directory
 */
async function isDirectory(path: string): Promise<boolean> {
  try {
    const stats = await stat(path)
    return stats.isDirectory()
  } catch {
    return false
  }
}

/**
 * Migrate a single image from flat structure to directory structure
 */
async function migrateImage(
  filePath: string,
  uploadsDir: string,
  dryRun: boolean
): Promise<MigrationResult> {
  const ext = extname(filePath).toLowerCase()
  const imageId = basename(filePath, ext)
  const newDir = join(uploadsDir, imageId)
  const originalStats = await stat(filePath)

  // Check if already migrated (directory exists)
  if (await isDirectory(newDir)) {
    return {
      imageId,
      originalPath: filePath,
      originalSize: originalStats.size,
      newDir,
      sizesGenerated: [],
      action: 'skipped',
    }
  }

  if (dryRun) {
    return {
      imageId,
      originalPath: filePath,
      originalSize: originalStats.size,
      newDir,
      sizesGenerated: Object.keys(IMAGE_SIZES),
      action: 'migrated',
    }
  }

  try {
    // Read the original image
    const imageBuffer = await readFile(filePath)

    // Generate all size variants in the new directory
    await generateImageVariants(imageBuffer, newDir)

    // Delete the original flat file
    await unlink(filePath)

    return {
      imageId,
      originalPath: filePath,
      originalSize: originalStats.size,
      newDir,
      sizesGenerated: Object.keys(IMAGE_SIZES),
      action: 'migrated',
    }
  } catch (error) {
    return {
      imageId,
      originalPath: filePath,
      originalSize: originalStats.size,
      newDir,
      sizesGenerated: [],
      action: 'error',
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Main function
 */
async function main() {
  const { uploadsDir, dryRun } = parseArgs()

  console.log('Image Migration Script - Flat to Directory Structure')
  console.log('='.repeat(60))
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE'}`)
  console.log(`Directory: ${uploadsDir}`)
  console.log(`Size variants: ${Object.keys(IMAGE_SIZES).join(', ')}`)
  console.log('='.repeat(60))
  console.log()

  // Read all entries in the uploads directory
  let entries: string[]
  try {
    entries = await readdir(uploadsDir)
  } catch (error) {
    console.error(`Error reading directory ${uploadsDir}:`, error)
    process.exit(1)
  }

  const stats: Stats = {
    totalFound: 0,
    migrated: 0,
    skipped: 0,
    errors: 0,
    totalOriginalSize: 0,
  }

  const results: MigrationResult[] = []

  // Process each entry
  for (const entry of entries) {
    const entryPath = join(uploadsDir, entry)

    // Skip directories (already migrated or other)
    if (await isDirectory(entryPath)) {
      console.log(`[SKIP] ${entry} (directory - already migrated)`)
      stats.skipped++
      continue
    }

    // Skip non-webp files
    const ext = extname(entry).toLowerCase()
    if (ext !== '.webp') {
      // Skip hidden files and other non-image files silently
      if (!entry.startsWith('.')) {
        console.log(`[SKIP] ${entry} (not a .webp file)`)
      }
      continue
    }

    stats.totalFound++

    // Migrate the image
    console.log(`[PROCESSING] ${entry}...`)
    const result = await migrateImage(entryPath, uploadsDir, dryRun)
    results.push(result)

    stats.totalOriginalSize += result.originalSize

    switch (result.action) {
      case 'migrated':
        stats.migrated++
        if (dryRun) {
          console.log(`  Would create: ${result.newDir}/`)
          console.log(
            `  Would generate: ${result.sizesGenerated.map((s) => `${s}.webp`).join(', ')}`
          )
          console.log(`  Would delete: ${entry}`)
        } else {
          console.log(`  Created: ${result.newDir}/`)
          console.log(
            `  Generated: ${result.sizesGenerated.map((s) => `${s}.webp`).join(', ')}`
          )
          console.log(`  Deleted: ${entry}`)
        }
        break

      case 'skipped':
        stats.skipped++
        console.log(`  Skipped: directory already exists`)
        break

      case 'error':
        stats.errors++
        console.error(`  ERROR: ${result.error}`)
        break
    }

    console.log()
  }

  // Print summary
  console.log('='.repeat(60))
  console.log('Summary')
  console.log('='.repeat(60))
  console.log(`Total .webp files found: ${stats.totalFound}`)
  console.log(`  - Migrated: ${stats.migrated}`)
  console.log(`  - Skipped: ${stats.skipped}`)
  console.log(`  - Errors: ${stats.errors}`)
  console.log()
  console.log(`Total original size: ${formatBytes(stats.totalOriginalSize)}`)

  if (dryRun) {
    console.log()
    console.log('This was a dry run. No files were modified.')
    console.log('Run without --dry-run to apply changes.')
  }

  console.log('='.repeat(60))

  // Exit with error code if there were any errors
  if (stats.errors > 0) {
    process.exit(1)
  }
}

// Run the script
main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
