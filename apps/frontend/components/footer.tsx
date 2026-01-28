import Link from 'next/link'

export function Footer() {
  return (
    <footer className="bg-muted/30">
      <div className="container mx-auto max-w-7xl px-4 py-8 md:py-12">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          {/* Info Column - appears first on mobile, last on desktop */}
          <div className="order-first md:order-last md:text-right">
            <h3 className="font-semibold text-foreground mb-4">Matrummet</h3>
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} Matrummet
            </p>
          </div>

          {/* Links Column - appears second on mobile, first on desktop */}
          <div>
            <h3 className="font-semibold text-foreground mb-4">Information</h3>
            <nav className="flex flex-col gap-2">
              <Link
                href="/om"
                className="text-muted-foreground hover:underline"
              >
                Om
              </Link>
              <Link
                href="/integritetspolicy"
                className="text-muted-foreground hover:underline"
              >
                Integritetspolicy
              </Link>
              <Link
                href="/villkor"
                className="text-muted-foreground hover:underline"
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
