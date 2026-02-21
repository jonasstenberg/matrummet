import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_main/villkor')({
  head: () => ({
    meta: [
      { title: 'Villkor - Matrummet' },
      {
        name: 'description',
        content:
          'Användarvillkor för Matrummet — vad som gäller när du använder tjänsten.',
      },
    ],
  }),
  component: VillkorPage,
})

function VillkorPage() {
  return (
    <div className="mx-auto max-w-prose px-4 py-12">
      <article>
        <h1 className="font-heading text-3xl font-bold mb-8">Villkor</h1>

        <div className="space-y-8 text-foreground/80 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              Allmänt
            </h2>
            <p>
              Genom att använda Matrummet godkänner du villkoren nedan.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              Konto
            </h2>
            <p>
              Du behöver ett konto för att använda Matrummet. Håll dina
              inloggningsuppgifter för dig själv. Ett konto per person.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              Ditt innehåll
            </h2>
            <p className="mb-3">
              Recepten du skapar är dina. Matrummet får visa dem i appen, annars
              skulle tjänsten inte fungera. Du kan radera ditt innehåll när du
              vill.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              Vad du inte får göra
            </h2>
            <p className="mb-3">
              Matrummet är till för att hantera recept. Håll dig till det:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Försök inte komma åt andras data</li>
              <li>Inga bottar eller skrapverktyg</li>
              <li>Överbelasta inte tjänsten</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              AI-funktioner
            </h2>
            <p className="mb-3">
              AI-funktionerna (import och matplanering) skickar din text eller
              bild till Mistral AI som tolkar innehållet. Skicka inte känslig
              information via dessa funktioner.
            </p>
            <p>
              AI kan göra fel. Dubbelkolla ingredienser, mängder och
              tillagningstider innan du lagar maten.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              Ansvar
            </h2>
            <p className="mb-3">
              Tjänsten ges i befintligt skick. Jag försöker hålla saker säkra
              och stabila, men kan inte garantera att data aldrig försvinner.
              Håll egna kopior av recept som är viktiga för dig.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              Ändringar
            </h2>
            <p>
              Villkoren kan uppdateras. Använder du tjänsten efter en ändring
              räknas det som att du accepterar de nya villkoren.
            </p>
          </section>
        </div>

        <p className="text-sm text-muted-foreground mt-10">
          Senast uppdaterad: 8 februari 2026
        </p>
      </article>
    </div>
  )
}
