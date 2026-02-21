# Recipe Images

This directory contains recipe images with pre-optimized variants for different use cases.

## Structure

Each image is stored in a UUID-named directory with multiple size variants:

```
uploads/
└── {uuid}/
    ├── thumb.webp   # Thumbnail (smallest)
    ├── small.webp   # Small size
    ├── medium.webp  # Medium size
    ├── large.webp   # Large size
    └── full.webp    # Full resolution
```

## Image Strategy

- **Pre-optimized**: Multiple sizes generated at upload time
- **Static serving**: Next.js serves files with optimal caching headers
- **Lazy loading**: Recipe cards use `loading="lazy"` for better page performance
- **Priority loading**: Recipe detail hero images use `priority` to prevent LCP issues

## Image Formats

All images are in WebP format for best compression and quality balance.

## Cache Strategy

- Public images: 1 year cache (`max-age=31536000, immutable`)
- Next.js Image optimization cache: 1 year minimum TTL
