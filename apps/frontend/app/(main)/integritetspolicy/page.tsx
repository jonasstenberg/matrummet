import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Integritetspolicy - Recept",
  description: "Information om hur Recept hanterar dina personuppgifter och vilken data som samlas in.",
};

export default function IntegritetspolicyPage() {
  return (
    <div className="mx-auto max-w-prose px-4 py-12">
      <article className="prose prose-neutral">
        <h1>Integritetspolicy</h1>

        <section>
          <h2>Vilken data vi samlar in</h2>
          <p>När du använder Recept samlar vi in följande data:</p>
          <ul>
            <li>
              <strong>E-postadress</strong> — för inloggning och kontoadministration
            </li>
            <li>
              <strong>Lösenord</strong> — lagras som bcrypt-hash och kan aldrig läsas i klartext
            </li>
            <li>
              <strong>Receptdata</strong> — recept, ingredienser, instruktioner och kategorier som du skapar
            </li>
            <li>
              <strong>Stripe-kund-ID</strong> — för betalningshantering. Vi lagrar aldrig kortuppgifter,
              det hanterar Stripe
            </li>
          </ul>
        </section>

        <section>
          <h2>Hur vi använder din data</h2>
          <p>Din data används för att:</p>
          <ul>
            <li>
              <strong>Autentisering</strong> — e-postadress och lösenordshash för att logga in dig
            </li>
            <li>
              <strong>Visa och hantera dina recept</strong> — all receptdata du skapar lagras
              för att visas i appen
            </li>
            <li>
              <strong>Betalningar</strong> — Stripe-kund-ID används för att hantera betalningar
              genom Stripe (endast kund-ID lagras, inga kortuppgifter)
            </li>
          </ul>
        </section>

        <section>
          <h2>Cookies</h2>
          <p>
            Recept använder endast <strong>funktionella cookies</strong> som är nödvändiga
            för att tjänsten ska fungera:
          </p>
          <ul>
            <li>
              <strong>JWT-sessions-cookie</strong> — för att hålla dig inloggad
            </li>
          </ul>
          <p>
            Vi använder <strong>inga</strong> analyscookies, inga tredjepartscookies för spårning,
            och inga reklamcookies. Eftersom vi endast använder strikt nödvändiga cookies
            behövs ingen cookie-banner eller samtycke enligt dataskyddsförordningen.
          </p>
        </section>

        <section>
          <h2>Vad vi INTE gör</h2>
          <p>Det är viktigt att förtydliga vad Recept <strong>inte</strong> gör med din data:</p>
          <ul>
            <li>Vi använder <strong>ingen Google Analytics</strong> eller liknande analystjänster</li>
            <li>Vi använder <strong>inga spårningspixlar</strong></li>
            <li>Vi visar <strong>ingen tredjepartsannonsering</strong></li>
            <li>Vi säljer eller delar <strong>aldrig</strong> din data med tredje part</li>
            <li>Vi spårar <strong>inte</strong> ditt beteende utanför appen</li>
          </ul>
        </section>

        <section>
          <h2>Radera ditt konto</h2>
          <p>
            Du kan när som helst radera ditt konto och all tillhörande data genom kontoinställningar.
            Radering är permanent och tar bort alla recept, kontodata och Stripe-kundreferens.
          </p>
        </section>

        <section>
          <h2>Kontakt</h2>
          <p>
            Har du frågor om hur dina personuppgifter hanteras kan du kontakta Matrummet.
          </p>
        </section>

        <p className="text-sm text-muted-foreground">Senast uppdaterad: 28 januari 2026</p>
      </article>
    </div>
  );
}
