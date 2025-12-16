import Link from 'next/link'
import { getCategories } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface CategoryFilterProps {
  activeCategory?: string
  className?: string
}

export async function CategoryFilter({
  activeCategory,
  className,
}: CategoryFilterProps) {
  const categories = await getCategories()

  return (
    <div className={cn('w-full', className)}>
      <div className="relative">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
          <Link href="/">
            <Badge
              variant={!activeCategory ? 'default' : 'outline'}
              className={cn(
                'cursor-pointer whitespace-nowrap transition-colors',
                !activeCategory && 'bg-primary text-primary-foreground',
                activeCategory && 'hover:bg-accent'
              )}
            >
              Alla
            </Badge>
          </Link>

          {categories.map((category) => (
            <Link key={category} href={`/kategori/${encodeURIComponent(category)}`}>
              <Badge
                variant={activeCategory === category ? 'default' : 'outline'}
                className={cn(
                  'cursor-pointer whitespace-nowrap transition-colors',
                  activeCategory === category &&
                    'bg-primary text-primary-foreground',
                  activeCategory !== category && 'hover:bg-accent'
                )}
              >
                {category}
              </Badge>
            </Link>
          ))}
        </div>

        {/* Fade edges for mobile scroll hint */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-background to-transparent md:hidden" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent md:hidden" />
      </div>
    </div>
  )
}
