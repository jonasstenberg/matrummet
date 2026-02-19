'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowRight } from '@/lib/icons'
import { RecipeCard } from '@/components/recipe-card'
import type { Recipe } from '@/lib/types'

interface LandingPageProps {
  recipes?: Recipe[];
}

export function LandingPage({ recipes = [] }: LandingPageProps) {
  return (
    <div className="flex flex-col -mt-8 -mx-4 px-4 md:-mx-8 md:px-8 bg-orange-50/40">
      {/* Hero */}
      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <div className="sm:hidden mb-6 flex flex-col items-center">
            <span className="font-heading text-2xl font-semibold text-neutral-800">
              Matrummet&apos;s
            </span>
            <span className="text-[10px] font-medium tracking-[0.25em] text-orange-700/70 uppercase">
              Recept
            </span>
          </div>
          <h1 className="font-heading text-5xl font-bold tracking-tight text-neutral-800 md:text-6xl">
            Dina recept,
            <br />
            samlade.
          </h1>

          <p className="mx-auto mt-6 max-w-lg text-lg text-neutral-600">
            Samla alla recept på ett ställe. Importera med AI, planera inköp och dela med familjen.
          </p>

          <div className="mt-10">
            <Link href="/registrera">
              <Button size="lg" className="h-12 px-8 text-base bg-orange-700 hover:bg-orange-800">
                Kom igång gratis
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>

          <p className="mt-4 text-sm text-neutral-500">
            Ingen reklam. 10 AI-importer ingår.
          </p>
        </div>
      </section>

      {/* Recipe Preview */}
      {recipes.length > 0 && (
        <section className="pb-16 md:pb-24">
          <div className="mx-auto max-w-4xl">
            <div className="grid gap-5 grid-cols-1 sm:grid-cols-2">
              {recipes.map((recipe) => (
                <RecipeCard key={recipe.id} recipe={recipe} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* AI Import */}
      <section className="py-16 md:py-24 border-t border-orange-100/80">
        <div className="mx-auto max-w-4xl">
          <div className="text-center">
            <h2 className="font-heading text-3xl font-semibold text-neutral-800">
              Slipp skriva av recept
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-neutral-600">
              Ta en bild på mormors handskrivna recept eller klistra in en länk.
              AI:n läser av och strukturerar – du granskar och sparar.
            </p>
          </div>

          <div className="mt-12 grid gap-8 md:grid-cols-3">
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-orange-100/70 text-lg font-semibold text-orange-800/70">
                1
              </div>
              <p className="mt-3 text-sm text-neutral-600">
                Fota eller klistra in länk
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-orange-100/70 text-lg font-semibold text-orange-800/70">
                2
              </div>
              <p className="mt-3 text-sm text-neutral-600">
                AI:n strukturerar receptet
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-orange-100/70 text-lg font-semibold text-orange-800/70">
                3
              </div>
              <p className="mt-3 text-sm text-neutral-600">
                Granska och spara
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 md:py-24 border-t border-orange-100/80">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center font-heading text-3xl font-semibold text-neutral-800">
            Mer än bara recept
          </h2>

          <div className="mt-12 grid gap-10 md:grid-cols-2">
            <div className="text-center md:text-left">
              <h3 className="text-lg font-semibold text-neutral-800">Sök och filtrera</h3>
              <p className="mt-2 text-neutral-600">
                Hitta rätt recept direkt. Sök på namn, ingrediens eller kategori.
              </p>
            </div>
            <div className="text-center md:text-left">
              <h3 className="text-lg font-semibold text-neutral-800">Inköpslista</h3>
              <p className="mt-2 text-neutral-600">
                Lägg till ingredienser med ett tryck. Dela listan med familjen.
              </p>
            </div>
            <div className="text-center md:text-left">
              <h3 className="text-lg font-semibold text-neutral-800">Skafferi</h3>
              <p className="mt-2 text-neutral-600">
                Håll koll på vad du har hemma. Se vad du kan laga.
              </p>
            </div>
            <div className="text-center md:text-left">
              <h3 className="text-lg font-semibold text-neutral-800">Dela med hushållet</h3>
              <p className="mt-2 text-neutral-600">
                Bjud in familjen till gemensamma recept och listor.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-16 md:py-24 border-t border-orange-100/80">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-heading text-3xl font-semibold text-neutral-800">
            Priser
          </h2>
          <p className="mt-4 text-neutral-600">
            Appen är gratis att använda. Du får 10 AI-importer när du skapar konto.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-8">
            <div className="rounded-lg bg-white/60 px-6 py-4 text-center">
              <p className="text-2xl font-semibold text-neutral-800">29 kr</p>
              <p className="text-sm text-neutral-500">10 importer</p>
            </div>
            <div className="rounded-lg bg-white/60 px-6 py-4 text-center">
              <p className="text-2xl font-semibold text-neutral-800">59 kr</p>
              <p className="text-sm text-neutral-500">25 importer</p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="font-heading text-3xl font-semibold text-neutral-800 md:text-4xl">
            Börja samla dina recept
          </h2>
          <div className="mt-8">
            <Link href="/registrera">
              <Button size="lg" className="h-12 px-8 text-base bg-orange-700 hover:bg-orange-800">
                Skapa konto
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
