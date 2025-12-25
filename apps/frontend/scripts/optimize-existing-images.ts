#!/usr/bin/env tsx

/**
 * One-time migration script to optimize existing images in public/uploads/
 *
 * This script:
 * 1. Scans all images in the uploads directory
 * 2. For non-optimized images (PNGs, large JPGs > 200KB):
 *    - Resizes to max 1920px (preserving aspect ratio, no upscaling)
 *    - Converts to WebP at quality 85
 *    - Saves with same UUID but .webp extension
 *    - Deletes original if it was a different format
 * 3. Skips already optimized webp files under 200KB
 * 4. Logs progress and stats
 *
 * Usage:
 *   npx tsx scripts/optimize-existing-images.ts [path] [--dry-run]
 *
 * Examples:
 *   npx tsx scripts/optimize-existing-images.ts --dry-run
 *   npx tsx scripts/optimize-existing-images.ts /opt/recept/public/uploads --dry-run
 *   npx tsx scripts/optimize-existing-images.ts /opt/recept/public/uploads
 */

import { readdir, stat, unlink } from 'fs/promises'
import { join, extname, basename, isAbsolute } from 'path'
import sharp from 'sharp'

// Parse command line arguments
function parseArgs(): { uploadsDir: string; dryRun: boolean } {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const pathArgs = args.filter(arg => !arg.startsWith('--'))

  let uploadsDir: string
  if (pathArgs.length > 0) {
    // Use provided path
    uploadsDir = isAbsolute(pathArgs[0]) ? pathArgs[0] : join(process.cwd(), pathArgs[0])
  } else {
    // Default to public/uploads in current directory
    uploadsDir = join(process.cwd(), 'public', 'uploads')
  }

  return { uploadsDir, dryRun }
}

const MAX_DIMENSION = 1920
const WEBP_QUALITY = 85
const SIZE_THRESHOLD = 200 * 1024 // 200KB in bytes

interface OptimizationResult {
  filename: string
  originalPath: string
  originalSize: number
  originalFormat: string
  newPath: string
  newSize: number
  savings: number
  savingsPercent: number
  action: 'converted' | 'optimized' | 'skipped'
}

interface Stats {
  totalProcessed: number
  converted: number
  optimized: number
  skipped: number
  totalOriginalSize: number
  totalNewSize: number
  totalSavings: number
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
 * Check if a file should be processed
 */
async function shouldProcess(filePath: string): Promise<boolean> {
  const ext = extname(filePath).toLowerCase()

  // Only process image files
  if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
    return false
  }

  // Check file size
  const stats = await stat(filePath)

  // If it's already a small webp, skip it
  if (ext === '.webp' && stats.size < SIZE_THRESHOLD) {
    return false
  }

  return true
}

/**
 * Optimize a single image
 */
async function optimizeImage(
  filePath: string,
  uploadsDir: string,
  dryRun: boolean
): Promise<OptimizationResult> {
  const originalStats = await stat(filePath)
  const ext = extname(filePath).toLowerCase()
  const baseNameWithoutExt = basename(filePath, ext)
  const newPath = join(uploadsDir, `${baseNameWithoutExt}.webp`)

  // Load image metadata
  const metadata = await sharp(filePath).metadata()

  let action: 'converted' | 'optimized' | 'skipped' = 'skipped'

  if (!dryRun) {
    // Create sharp instance
    let pipeline = sharp(filePath)

    // Resize if needed (only downscale, never upscale)
    if (metadata.width && metadata.width > MAX_DIMENSION) {
      pipeline = pipeline.resize(MAX_DIMENSION, MAX_DIMENSION, {
        fit: 'inside',
        withoutEnlargement: true,
      })
    } else if (metadata.height && metadata.height > MAX_DIMENSION) {
      pipeline = pipeline.resize(MAX_DIMENSION, MAX_DIMENSION, {
        fit: 'inside',
        withoutEnlargement: true,
      })
    }

    // Convert to WebP
    pipeline = pipeline.webp({ quality: WEBP_QUALITY })

    // Save the optimized image
    await pipeline.toFile(newPath)

    // Verify the new file was created successfully
    const newStats = await stat(newPath)

    // Delete original if it's a different format
    if (ext !== '.webp' && filePath !== newPath) {
      await unlink(filePath)
      action = 'converted'
    } else {
      action = 'optimized'
    }

    const savings = originalStats.size - newStats.size
    const savingsPercent = (savings / originalStats.size) * 100

    return {
      filename: basename(filePath),
      originalPath: filePath,
      originalSize: originalStats.size,
      originalFormat: ext.replace('.', ''),
      newPath,
      newSize: newStats.size,
      savings,
      savingsPercent,
      action,
    }
  } else {
    // Dry run - estimate the result
    // We can't know exact size without processing, but we can estimate
    const estimatedSize = Math.floor(originalStats.size * 0.6) // Rough estimate

    if (ext !== '.webp') {
      action = 'converted'
    } else {
      action = 'optimized'
    }

    return {
      filename: basename(filePath),
      originalPath: filePath,
      originalSize: originalStats.size,
      originalFormat: ext.replace('.', ''),
      newPath,
      newSize: estimatedSize,
      savings: originalStats.size - estimatedSize,
      savingsPercent: 40, // Rough estimate
      action,
    }
  }
}

/**
 * Main function
 */
async function main() {
  const { uploadsDir, dryRun } = parseArgs()

  console.log('🖼️  Image Optimization Script')
  console.log('=' .repeat(60))
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE'}`)
  console.log(`Directory: ${uploadsDir}`)
  console.log(`Max dimension: ${MAX_DIMENSION}px`)
  console.log(`WebP quality: ${WEBP_QUALITY}`)
  console.log(`Size threshold: ${formatBytes(SIZE_THRESHOLD)}`)
  console.log('=' .repeat(60))
  console.log()

  // Read all files in the uploads directory
  const files = await readdir(uploadsDir)

  const stats: Stats = {
    totalProcessed: 0,
    converted: 0,
    optimized: 0,
    skipped: 0,
    totalOriginalSize: 0,
    totalNewSize: 0,
    totalSavings: 0,
  }

  const results: OptimizationResult[] = []

  // Process each file
  for (const file of files) {
    const filePath = join(uploadsDir, file)

    // Skip non-files (directories, symlinks)
    const fileStats = await stat(filePath)
    if (!fileStats.isFile()) {
      continue
    }

    // Check if we should process this file
    if (!(await shouldProcess(filePath))) {
      const ext = extname(filePath).toLowerCase()
      if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
        stats.skipped++
        console.log(`⏭️  Skipped: ${file} (already optimized)`)
      }
      continue
    }

    // Optimize the image
    try {
      console.log(`🔄 Processing: ${file}...`)
      const result = await optimizeImage(filePath, uploadsDir, dryRun)
      results.push(result)

      stats.totalProcessed++
      stats.totalOriginalSize += result.originalSize
      stats.totalNewSize += result.newSize
      stats.totalSavings += result.savings

      if (result.action === 'converted') {
        stats.converted++
      } else if (result.action === 'optimized') {
        stats.optimized++
      }

      const savingsSign = result.savings > 0 ? '📉' : '📈'
      console.log(
        `  ${savingsSign} ${result.originalFormat.toUpperCase()} → WebP: ` +
        `${formatBytes(result.originalSize)} → ${formatBytes(result.newSize)} ` +
        `(${result.savings > 0 ? '-' : '+'}${Math.abs(result.savingsPercent).toFixed(1)}%)`
      )

      if (dryRun) {
        console.log(`  Would save to: ${basename(result.newPath)}`)
        if (result.action === 'converted') {
          console.log(`  Would delete: ${basename(result.originalPath)}`)
        }
      }

    } catch (error) {
      console.error(`❌ Error processing ${file}:`, error)
    }
  }

  // Print summary
  console.log()
  console.log('=' .repeat(60))
  console.log('📊 Summary')
  console.log('=' .repeat(60))
  console.log(`Total files processed: ${stats.totalProcessed}`)
  console.log(`  - Converted (PNG/JPG → WebP): ${stats.converted}`)
  console.log(`  - Optimized (WebP → WebP): ${stats.optimized}`)
  console.log(`  - Skipped (already optimal): ${stats.skipped}`)
  console.log()
  console.log(`Original total size: ${formatBytes(stats.totalOriginalSize)}`)
  console.log(`New total size: ${formatBytes(stats.totalNewSize)}`)
  console.log(`Total savings: ${formatBytes(stats.totalSavings)}`)

  if (stats.totalOriginalSize > 0) {
    const overallSavingsPercent = (stats.totalSavings / stats.totalOriginalSize) * 100
    console.log(`Overall reduction: ${overallSavingsPercent.toFixed(1)}%`)
  }

  if (dryRun) {
    console.log()
    console.log('⚠️  This was a dry run. No files were modified.')
    console.log('Run without --dry-run to apply changes.')
  }

  console.log('=' .repeat(60))
}

// Run the script
main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
