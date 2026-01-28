import { ChefHat } from 'lucide-react'
import Link from 'next/link'

export function Footer() {
  return (
    <footer className="bg-[#1a1a1a] text-[#F5F3F0] border-t border-border">
      <div className="container mx-auto max-w-7xl px-4 py-8 md:py-12">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          {/* Info Column - appears first on mobile, last on desktop */}
          <div className="order-first md:order-last md:text-right">
            <div className="flex items-center gap-3 mb-4 md:justify-end">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warm">
                <ChefHat className="h-5 w-5 text-warm-foreground" />
              </div>
              <h3 className="font-semibold text-white">Matrummet</h3>
            </div>
            <p className="text-sm text-[#F5F3F0]/70">
              &copy; {new Date().getFullYear()} Matrummet
            </p>
          </div>

          {/* Links Column - appears second on mobile, first on desktop */}
          <div>
            <h3 className="font-semibold text-white mb-4">Information</h3>
            <nav className="flex flex-col gap-2">
              <Link
                href="/om"
                className="text-[#F5F3F0]/70 hover:text-white hover:underline transition-colors"
              >
                Om
              </Link>
              <Link
                href="/integritetspolicy"
                className="text-[#F5F3F0]/70 hover:text-white hover:underline transition-colors"
              >
                Integritetspolicy
              </Link>
              <Link
                href="/villkor"
                className="text-[#F5F3F0]/70 hover:text-white hover:underline transition-colors"
              >
                Villkor
              </Link>
            </nav>
          </div>
        </div>
      </div>
    </footer>
  )
}
