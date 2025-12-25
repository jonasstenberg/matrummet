# Frontend Scripts

## optimize-existing-images.ts

One-time migration script to optimize existing images in `public/uploads/`.

### What it does

1. Scans all images in the uploads directory
2. For non-optimized images (PNGs, large JPGs > 200KB):
   - Resizes to max 1920px dimension (preserving aspect ratio, no upscaling)
   - Converts to WebP at quality 85
   - Saves with same UUID but .webp extension
   - Deletes original if it was a different format
3. Skips already optimized webp files under 200KB
4. Logs progress and statistics (original size, new size, savings)

### Safety Features

- **Dry run mode**: Preview what would be done without making changes
- **Verification**: Only deletes original after confirming new file is written
- **Smart skipping**: Won't re-process already optimized files
- **Error handling**: Continues processing even if individual files fail

### Usage

```bash
# Preview what would be done (dry run)
npx tsx scripts/optimize-existing-images.ts --dry-run

# Actually optimize images
npx tsx scripts/optimize-existing-images.ts
```

### Configuration

The script uses these settings:
- **Max dimension**: 1920px (preserves aspect ratio)
- **WebP quality**: 85
- **Size threshold**: 200KB (webp files smaller than this are skipped)
- **Target directory**: `public/uploads/`

### Example Output

```
🖼️  Image Optimization Script
============================================================
Mode: DRY RUN (no changes will be made)
Directory: /path/to/recept/apps/frontend/public/uploads
Max dimension: 1920px
WebP quality: 85
Size threshold: 200.00 KB
============================================================

🔄 Processing: recipe-123.png...
  📉 PNG → WebP: 450.32 KB → 180.15 KB (-60.0%)
  Would save to: recipe-123.webp
  Would delete: recipe-123.png

⏭️  Skipped: recipe-456.webp (already optimized)

============================================================
📊 Summary
============================================================
Total files processed: 1
  - Converted (PNG/JPG → WebP): 1
  - Optimized (WebP → WebP): 0
  - Skipped (already optimal): 1

Original total size: 450.32 KB
New total size: 180.15 KB
Total savings: 270.17 KB
Overall reduction: 60.0%

⚠️  This was a dry run. No files were modified.
Run without --dry-run to apply changes.
============================================================
```

### Notes

- This is designed as a one-time migration script
- Always run with `--dry-run` first to preview changes
- The script uses the same image processing library (sharp) as the main application
- Original files are only deleted after successful conversion to WebP
- Symlinks are ignored (only real files are processed)

## setup-images.sh

Shell script for symlinking recipe images from `data/files` to the public directory.

See the script file for usage details.
