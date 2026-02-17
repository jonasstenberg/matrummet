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
            <h2 className="text-xl font-semibold text-foreground mb-3">Vilken data jag samlar in</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Din e-postadress, för inloggning</li>
              <li>Ditt lösenord, hashat med bcrypt (kan inte läsas i klartext)</li>
              <li>Recepten du skapar, med ingredienser, instruktioner och kategorier, samt matplaner</li>
              <li>Ett Stripe-kund-ID för betalningar (kortuppgifter lagras hos Stripe, inte här)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">Hur datan används</h2>
            <p>
              E-post och lösenord loggar in dig. Receptdatan visas i appen. Stripe-ID:t
              kopplar dig till dina betalningar.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">Cookies</h2>
            <p className="mb-3">
              En enda cookie: en JWT-sessions-cookie som håller dig inloggad. Inga
              analyscookies, ingen spårning, ingen reklam. Därför finns ingen cookie-banner.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">AI och Mistral</h2>
            <p className="mb-3">
              AI-funktionerna (import och matplanering) skickar det du matar in (text, webbadresser eller bilder)
              till Mistral AI för att tolka och strukturera innehållet.
              Mistral är ett franskt företag — datan behandlas inom EU och sparas inte efter att
              du fått ditt svar.
            </p>
            <p>
              AI-funktionerna är valfria. Skapar, redigerar eller söker du recept för hand
              skickas ingenting till tredje part.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">Vad jag inte gör</h2>
            <p>
              Ingen Google Analytics. Inga spårningspixlar. Ingen tredjepartsreklam.
              Jag säljer inte din data och spårar inte vad du gör utanför appen.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">Radera kontot</h2>
            <p>
              I kontoinställningarna kan du radera allt: konto, recept och Stripe-referens.
              Raderingen är permanent.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">Kontakt</h2>
            <p>
              Frågor? Mejla <a href="mailto:matrummet@stenberg.io" className="text-primary underline hover:text-primary/80 transition-colors">matrummet@stenberg.io</a>.
            </p>
          </section>
        </div>

        <p className="text-sm text-muted-foreground mt-10">Senast uppdaterad: 8 februari 2026</p>
      </article>
    </div>
  );
}
