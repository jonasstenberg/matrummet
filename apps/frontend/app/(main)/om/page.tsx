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
            Matrummet är en digital kokbok för att samla och organisera dina recept.
            Appen låter dig spara egna recept med ingredienser, instruktioner och kategorier,
            samt söka snabbt med svensk fulltextsökning.
          </p>

          <p>
            Funktioner inkluderar kategorihantering, ingredienshantering med mängder och mått,
            samt möjlighet att skapa shoppinglistor. All data är privat — du ser bara dina egna recept,
            och ingen annan har tillgång till dem.
          </p>

          <p>
            Matrummet är byggt för alla som vill ha sina recept organiserade digitalt istället för
            utspridda i kokböcker, anteckningsblock eller skärmklipp.
          </p>
        </div>

        <p className="text-sm text-muted-foreground mt-10">Senast uppdaterad: 28 januari 2026</p>
      </article>
    </div>
  );
}
