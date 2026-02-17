import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Om Matrummet",
  description:
    "En digital kokbok för att samla och organisera dina recept med svensk fulltextsökning, inköpslistor och AI-genererade matplaner.",
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
            och bor i Malmö. Jag byggde Matrummet för att jag ville samla mina
            egna recept på samma ställe som de från min barndom, sådana som
            annars bara finns i huvudet eller på gulnade lappar.
          </p>

          <p>
            Du kan spara recept med ingredienser, instruktioner och kategorier,
            söka på svenska, göra inköpslistor och generera veckovisa matplaner
            med hjälp av AI.
          </p>

          <p>
            Matrummet är för dig som vill ha recepten digitalt istället för
            utspridda i kokböcker, anteckningsblock eller bilder på telefonen.
          </p>

          <p>
            Matrummet är öppen källkod.{" "}
            <a
              href="https://github.com/jonasstenberg/matrummet"
              className="underline hover:text-foreground"
              target="_blank"
              rel="noopener noreferrer"
            >
              Se koden på GitHub
            </a>
            .
          </p>
        </div>

        <p className="text-sm text-muted-foreground mt-10">
          Senast uppdaterad: 17 februari 2026
        </p>
      </article>
    </div>
  );
}
