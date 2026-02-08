'use client'

interface HomeHeaderProps {
  activeView?: 'mine' | 'all' | 'liked'
}

export function HomeHeader({ activeView = 'all' }: HomeHeaderProps) {
  const titles: Record<string, { title: string; subtitle: string }> = {
    all: { title: 'Alla recept', subtitle: 'Utforska och upptäck recept' },
    mine: { title: 'Mina recept', subtitle: 'Dina egna recept' },
    liked: { title: 'Gillade recept', subtitle: 'Recept du har gillat' },
  }

  const { title, subtitle } = titles[activeView] || titles.all

  return (
    <header>
      <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground">
        {title}
      </h1>
      <p className="mt-2 text-lg text-muted-foreground">{subtitle}</p>
    </header>
  )
}
