import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Villkor - Recept",
  description: "Användarvillkor för Recept — vad som gäller när du använder tjänsten.",
};

export default function VillkorPage() {
  return (
    <div className="mx-auto max-w-prose px-4 py-12">
      <article className="prose prose-neutral">
        <h1>Villkor</h1>

        <section>
          <h2>Allmänt</h2>
          <p>
            Dessa villkor gäller för användning av Recept, som drivs av Matrummet.
            Genom att använda tjänsten godkänner du dessa villkor.
          </p>
        </section>

        <section>
          <h2>Konto</h2>
          <p>
            För att använda Recept behöver du ett konto. Du är ansvarig för att hålla
            dina inloggningsuppgifter säkra. Ett konto per person.
          </p>
        </section>

        <section>
          <h2>Ditt innehåll</h2>
          <p>
            Du äger recepten och innehållet du skapar i Recept. Genom att använda tjänsten
            ger du Matrummet en licens att visa ditt innehåll inom appen — det är
            nödvändigt för att tjänsten ska fungera.
          </p>
          <p>
            Du kan när som helst radera ditt innehåll.
          </p>
        </section>

        <section>
          <h2>Acceptabel användning</h2>
          <p>Du förväntas använda tjänsten för dess avsedda syfte, att hantera recept:</p>
          <ul>
            <li>Försök inte komma åt andra användares data</li>
            <li>Använd inte automatiserade verktyg för att skrapa eller överbelasta tjänsten</li>
            <li>Använd tjänsten på ett sätt som respekterar andra användare och systemet</li>
          </ul>
        </section>

        <section>
          <h2>Ansvarsbegränsning</h2>
          <p>
            Tjänsten tillhandahålls "i befintligt skick". Matrummet ansvarar inte för dataförlust,
            även om vi vidtar rimliga åtgärder för att skydda data.
          </p>
          <p>
            <strong>Håll egna säkerhetskopior</strong> av viktiga recept.
          </p>
        </section>

        <section>
          <h2>Ändringar</h2>
          <p>
            Matrummet kan uppdatera dessa villkor. Fortsatt användning av tjänsten
            efter ändringar innebär att du accepterar de nya villkoren.
          </p>
        </section>

        <p className="text-sm text-muted-foreground">Senast uppdaterad: 28 januari 2026</p>
      </article>
    </div>
  );
}
