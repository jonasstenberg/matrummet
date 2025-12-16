# Recipe Images

This directory contains symlinks to recipe images stored in `/data/files/`.

## Setup

Images are symlinked from the data directory to enable static serving by Next.js:

```bash
ln -s /path/to/recept/data/files/* /path/to/recept/apps/frontend/public/uploads/
```

## Image Strategy

Images are served directly from `/public/uploads/` for optimal performance:

- **Static serving**: Next.js serves public files with optimal caching headers
- **Image optimization**: Next.js Image component automatically optimizes formats (AVIF, WebP)
- **Lazy loading**: Recipe cards use `loading="lazy"` for better page performance
- **Priority loading**: Recipe detail hero images use `priority` to prevent LCP issues
- **Fallback API route**: `/api/images/[filename]` exists as a fallback with ETag support

## Image Formats

All images should be in WebP format (.webp) for best compression and quality balance.

## Cache Strategy

- Public images: 1 year cache (`max-age=31536000, immutable`)
- Next.js Image optimization cache: 1 year minimum TTL
- Output formats: AVIF (preferred), WebP (fallback)

## Adding New Images

New recipe images should be placed in `/data/files/` and symlinked here:

```bash
cd /path/to/recept/apps/frontend/public/uploads
ln -s ../../../data/files/new-image.webp .
```
