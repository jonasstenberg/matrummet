# Recept Frontend

Recipe management frontend built with Next.js 16, React 19, and TypeScript.

## Tech Stack

- **Next.js 16** with App Router and Turbopack
- **React 19**
- **TypeScript** in strict mode
- **Tailwind CSS v4** (CSS-based config)
- **shadcn/ui** component library
- **PostgREST** backend API (port 4444)
- **JWT-based authentication**

## Setup

### Install Dependencies

```bash
pnpm install
```

### Environment Variables

Create a `.env.local` file (copy from `.env.example` if available):

```env
NEXT_PUBLIC_URL=http://localhost:3000
JWT_SECRET=your-secret-key-here
```

## Development

```bash
# Start development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Lint code
pnpm lint
```

The dev server runs on http://localhost:3000

## Image Serving Strategy

### Static Serving (Primary)

Images are served from `/public/uploads/` with pre-optimized variants:

```
public/uploads/
└── {uuid}/
    ├── thumb.webp   # Thumbnail
    ├── small.webp   # Small size
    ├── medium.webp  # Medium size
    ├── large.webp   # Large size
    └── full.webp    # Full resolution
```

- **Pre-optimized**: Multiple sizes generated at upload time
- **Optimal performance**: Direct static file serving by Next.js
- **Long cache**: 1 year cache for immutable images
- **Lazy loading**: Recipe cards use `loading="lazy"`
- **Priority loading**: Hero images use `priority` prop

### API Route Fallback

`/app/api/images/[filename]/route.ts` serves as a fallback with:

- Stream-based reading for large files
- ETag support for 304 responses
- Multiple format support (.webp, .jpg, .png, .avif)
- Proper security validation (no directory traversal)
- Long cache headers

### Image Configuration

Next.js image settings in `next.config.ts`:

```typescript
images: {
  formats: ['image/avif', 'image/webp'],
  deviceSizes: [640, 750, 828, 1080, 1200, 1920],
  imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  minimumCacheTTL: 31536000, // 1 year
}
```

## Architecture

### Directory Structure

```
apps/frontend/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Authentication routes
│   ├── (main)/            # Main application routes
│   └── api/               # API routes
├── components/            # React components
│   └── ui/               # shadcn/ui primitives
├── lib/                  # Utilities and shared code
│   ├── api.ts           # PostgREST client
│   ├── auth.ts          # JWT utilities
│   ├── types.ts         # TypeScript types
│   └── actions.ts       # Server actions
├── public/              # Static files
│   └── uploads/        # Recipe images (optimized variants)
└── scripts/            # Utility scripts
```

### Routes

| Route | Type | Description |
|-------|------|-------------|
| `/` | Dynamic | Home with recipe grid |
| `/login` | Static | Login page |
| `/registrera` | Static | Signup page |
| `/mina-recept` | Dynamic | User's recipes (protected) |
| `/recept/[id]` | Dynamic | Recipe detail (SEO optimized) |
| `/recept/nytt` | Dynamic | Create recipe (protected) |
| `/recept/[id]/redigera` | Dynamic | Edit recipe (protected) |
| `/sok?q=` | Dynamic | Search results |

### Authentication

See [AUTH.md](./AUTH.md) for detailed authentication documentation.

## Styling

### Tailwind CSS v4

This project uses Tailwind v4 with CSS-based configuration (no `tailwind.config.ts`).

Theme customization in `app/globals.css`:

```css
@theme {
  --color-background: #faf9f7;
  --color-primary: #e07a5f;
  --color-secondary: #81b29a;
  /* ... */
}
```

### Component Patterns

- Use utility classes directly
- Conditional classes with `cn()` utility
- Mobile-first responsive design
- Semantic color tokens (bg-primary, not bg-orange-500)

## API Integration

### Server Components

Fetch data directly in server components:

```tsx
async function RecipesPage() {
  const recipes = await fetch('http://localhost:4444/recipes_and_categories', {
    cache: 'no-store',
  }).then(r => r.json())

  return <RecipeList recipes={recipes} />
}
```

### Client Components

Use Server Actions for mutations:

```tsx
'use client'

import { createRecipe } from '@/lib/actions'

function RecipeForm() {
  async function handleSubmit(formData: FormData) {
    await createRecipe(formData)
  }

  return <form action={handleSubmit}>...</form>
}
```

## Best Practices

### TypeScript

- Use `interface` for object shapes
- Use `type` for unions and utilities
- Avoid `any` - use proper types or `unknown`
- Proper event types (`React.ChangeEvent`, etc.)

### Components

- Default to Server Components
- Add `"use client"` only when needed
- Named exports (not default)
- Props interface for all components

### Images

- Use Next.js Image component
- Set appropriate `sizes` prop
- Use `loading="lazy"` for grids
- Use `priority` for hero images
- All images served from `/uploads/`

### State Management

- URL for search/filter state (not component state)
- Local state for UI interactions
- Avoid Context unless truly global

## UI Language

All user-facing text is in Swedish:

```
Hem = Home
Recept = Recipes
Logga in = Login
Registrera = Sign up
Sök recept... = Search recipes...
Nytt recept = New recipe
```

## License

Private project
