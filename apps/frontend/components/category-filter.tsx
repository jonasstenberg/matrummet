import Link from 'next/link'
import { getCategories } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { ScrollShadowContainer } from '@/components/scroll-shadow-container'

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
      <ScrollShadowContainer>
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
      </ScrollShadowContainer>
    </div>
  )
}
