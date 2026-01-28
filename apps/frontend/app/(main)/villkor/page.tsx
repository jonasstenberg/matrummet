import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Villkor - Matrummet",
  description: "Användarvillkor för Matrummet — vad som gäller när du använder tjänsten.",
};

export default function VillkorPage() {
  return (
    <div className="mx-auto max-w-prose px-4 py-12">
      <article>
        <h1 className="font-heading text-3xl font-bold mb-8">Villkor</h1>

        <div className="space-y-8 text-foreground/80 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">Allmänt</h2>
            <p>
              Dessa villkor gäller för användning av Matrummet.
              Genom att använda tjänsten godkänner du dessa villkor.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">Konto</h2>
            <p>
              För att använda Matrummet behöver du ett konto. Du är ansvarig för att hålla
              dina inloggningsuppgifter säkra. Ett konto per person.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">Ditt innehåll</h2>
            <p className="mb-3">
              Du äger recepten och innehållet du skapar i Matrummet. Genom att använda tjänsten
              ger du Matrummet en licens att visa ditt innehåll inom appen — det är
              nödvändigt för att tjänsten ska fungera.
            </p>
            <p>
              Du kan när som helst radera ditt innehåll.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">Acceptabel användning</h2>
            <p className="mb-3">Du förväntas använda tjänsten för dess avsedda syfte, att hantera recept:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Försök inte komma åt andra användares data</li>
              <li>Använd inte automatiserade verktyg för att skrapa eller överbelasta tjänsten</li>
              <li>Använd tjänsten på ett sätt som respekterar andra användare och systemet</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">Ansvarsbegränsning</h2>
            <p className="mb-3">
              Tjänsten tillhandahålls &quot;i befintligt skick&quot;. Matrummet ansvarar inte för dataförlust,
              även om vi vidtar rimliga åtgärder för att skydda data.
            </p>
            <p>
              <strong>Håll egna säkerhetskopior</strong> av viktiga recept.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">Ändringar</h2>
            <p>
              Matrummet kan uppdatera dessa villkor. Fortsatt användning av tjänsten
              efter ändringar innebär att du accepterar de nya villkoren.
            </p>
          </section>
        </div>

        <p className="text-sm text-muted-foreground mt-10">Senast uppdaterad: 28 januari 2026</p>
      </article>
    </div>
  );
}
