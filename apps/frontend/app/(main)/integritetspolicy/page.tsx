import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Integritetspolicy - Matrummet",
  description: "Information om hur Matrummet hanterar dina personuppgifter och vilken data som samlas in.",
};

export default function IntegritetspolicyPage() {
  return (
    <div className="mx-auto max-w-prose px-4 py-12">
      <article>
        <h1 className="font-heading text-3xl font-bold mb-8">Integritetspolicy</h1>

        <div className="space-y-8 text-foreground/80 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">Vilken data vi samlar in</h2>
            <p className="mb-3">När du använder Matrummet samlar vi in följande data:</p>
            <ul className="list-disc pl-6 space-y-2">
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
            <h2 className="text-xl font-semibold text-foreground mb-3">Hur vi använder din data</h2>
            <p className="mb-3">Din data används för att:</p>
            <ul className="list-disc pl-6 space-y-2">
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
            <h2 className="text-xl font-semibold text-foreground mb-3">Cookies</h2>
            <p className="mb-3">
              Matrummet använder endast <strong>funktionella cookies</strong> som är nödvändiga
              för att tjänsten ska fungera:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>JWT-sessions-cookie</strong> — för att hålla dig inloggad
              </li>
            </ul>
            <p className="mt-3">
              Vi använder <strong>inga</strong> analyscookies, inga tredjepartscookies för spårning,
              och inga reklamcookies. Eftersom vi endast använder strikt nödvändiga cookies
              behövs ingen cookie-banner eller samtycke enligt dataskyddsförordningen.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">Vad vi INTE gör</h2>
            <p className="mb-3">Det är viktigt att förtydliga vad Matrummet <strong>inte</strong> gör med din data:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Vi använder <strong>ingen Google Analytics</strong> eller liknande analystjänster</li>
              <li>Vi använder <strong>inga spårningspixlar</strong></li>
              <li>Vi visar <strong>ingen tredjepartsannonsering</strong></li>
              <li>Vi säljer eller delar <strong>aldrig</strong> din data med tredje part</li>
              <li>Vi spårar <strong>inte</strong> ditt beteende utanför appen</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">Radera ditt konto</h2>
            <p>
              Du kan när som helst radera ditt konto och all tillhörande data genom kontoinställningar.
              Radering är permanent och tar bort alla recept, kontodata och Stripe-kundreferens.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">Kontakt</h2>
            <p>
              Har du frågor om hur dina personuppgifter hanteras kan du kontakta oss
              på <a href="mailto:matrummet@stenberg.io" className="text-primary underline hover:text-primary/80 transition-colors">matrummet@stenberg.io</a>.
            </p>
          </section>
        </div>

        <p className="text-sm text-muted-foreground mt-10">Senast uppdaterad: 28 januari 2026</p>
      </article>
    </div>
  );
}
