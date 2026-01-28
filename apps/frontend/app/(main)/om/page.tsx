import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Om Matrummet",
  description: "En digital kokbok för att samla och organisera dina recept med svensk fulltextsökning och kategorihantering.",
};

export default function OmPage() {
  return (
    <div className="mx-auto max-w-prose px-4 py-12">
      <article>
        <h1 className="font-heading text-3xl font-bold mb-8">Om Matrummet</h1>

        <div className="space-y-6 text-foreground/80 leading-relaxed">
          <p>
            Jag heter{" "}
            <a
              href="https://stenberg.io"
              className="underline hover:text-foreground"
              target="_blank"
              rel="noopener noreferrer"
            >
              Jonas
            </a>{" "}
            och bor i Malmö. Jag byggde Matrummet för att jag ville ha ett
            ställe att samla recept jag lagar själv tillsammans med recept från
            min barndom — sådana som annars bara lever i minnet eller på
            gulnade lappar.
          </p>

          <p>
            Appen låter dig spara recept med ingredienser, instruktioner och
            kategorier, söka med svensk fulltextsökning, och skapa
            inköpslistor. Du kan även bläddra bland andras recept för
            inspiration.
          </p>

          <p>
            Matrummet är för dig som vill ha dina recept organiserade digitalt
            istället för utspridda i kokböcker, anteckningsblock eller
            bilder i telefonen.
          </p>
        </div>

        <p className="text-sm text-muted-foreground mt-10">Senast uppdaterad: 28 januari 2026</p>
      </article>
    </div>
  );
}
