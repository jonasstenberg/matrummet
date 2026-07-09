import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/_main/mcp')({
  head: () => ({
    meta: [
      { title: 'MCP-server - Matrummet' },
      {
        name: 'description',
        content:
          'Anslut din AI-assistent till Matrummet via MCP (Model Context Protocol). Sök recept, planera matveckan och hantera inköpslistor med en agent.',
      },
    ],
  }),
  component: McpPage,
})

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">
      {children}
    </code>
  )
}

function CodeBlock({ children, title }: { children: string; title?: string }) {
  return (
    <div className="relative">
      {title && (
        <div className="bg-muted/80 text-muted-foreground text-xs px-4 py-1.5 rounded-t border border-b-0 border-border font-mono">
          {title}
        </div>
      )}
      <pre
        className={`bg-muted/50 border border-border p-4 overflow-x-auto text-sm font-mono leading-relaxed ${title ? 'rounded-b' : 'rounded'}`}
      >
        {children}
      </pre>
    </div>
  )
}

const TOOL_GROUPS: { title: string; examples: string }[] = [
  {
    title: 'Recept',
    examples:
      'sök (fritext med OR-stöd), hämta, skapa, uppdatera, kopiera, gilla, räkna',
  },
  { title: 'Samlingar', examples: 'lista, skapa, dela, lägg till/ta bort recept' },
  {
    title: 'Inköpslistor',
    examples: 'skapa, lägg till recept eller egna varor, bocka av, rensa',
  },
  { title: 'Skafferi', examples: 'lägg till/ta bort, hitta recept från skafferiet' },
  { title: 'Matplanering', examples: 'hämta/spara veckoplan, byt rätt, till inköpslista' },
  { title: 'Hushåll', examples: 'medlemmar, inbjudningar, anslutningskoder' },
  { title: 'Delning', examples: 'delningslänkar för recept, receptböcker och samlingar' },
  { title: 'Bilder', examples: 'ladda upp receptbilder' },
]

function McpPage() {
  return (
    <div className="mx-auto max-w-prose px-4 py-12">
      <article>
        <h1 className="font-heading text-3xl font-bold mb-2">MCP-server</h1>
        <p className="text-foreground/60 mb-8">
          Anslut din AI-assistent till Matrummet via Model Context Protocol
          (MCP) och låt den söka recept, planera matveckan och fylla på
          inköpslistan åt dig.
        </p>

        <div className="space-y-10 text-foreground/80 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              Anslutning
            </h2>
            <p className="mb-3">
              Peka din MCP-klient på följande adress (transport:{' '}
              <Code>streamable-http</Code>):
            </p>
            <CodeBlock>https://mcp.matrummet.se/mcp</CodeBlock>
            <p className="mt-3">
              Servern använder OAuth 2.1 med dynamisk klientregistrering, så
              klienter som stödjer det ansluter helt utan förkonfiguration: du
              skickas till en inloggningssida, loggar in med ditt
              Matrummet-konto och godkänner åtkomsten. Inga API-nycklar behöver
              klistras in.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              Exempel
            </h2>
            <p className="mb-3">Claude Code:</p>
            <CodeBlock title="bash">{`claude mcp add --transport http matrummet https://mcp.matrummet.se/mcp`}</CodeBlock>
            <p className="mt-3 mb-3">
              Generisk klientkonfiguration (t.ex. i en{' '}
              <Code>mcp.json</Code>):
            </p>
            <CodeBlock title="json">{`{
  "mcpServers": {
    "matrummet": {
      "type": "http",
      "url": "https://mcp.matrummet.se/mcp"
    }
  }
}`}</CodeBlock>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              Vad kan en agent göra?
            </h2>
            <p className="mb-4">
              Servern exponerar ett åttiotal verktyg som täcker hela det{' '}
              <Link
                to="/api-dokumentation"
                className="underline hover:text-foreground"
              >
                dokumenterade API:et
              </Link>
              :
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-border rounded">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left px-3 py-2 font-medium">Område</th>
                    <th className="text-left px-3 py-2 font-medium">
                      Exempel på verktyg
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {TOOL_GROUPS.map((g) => (
                    <tr key={g.title}>
                      <td className="px-3 py-2 font-medium">{g.title}</td>
                      <td className="px-3 py-2">{g.examples}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              Säkerhet
            </h2>
            <p className="mb-3">
              Agenten agerar som du: den ser och ändrar bara det ditt konto
              har tillgång till (row-level security). Vid inloggningen skapas
              en API-nyckel för din räkning — du kan när som helst återkalla
              den under{' '}
              <Link
                to="/installningar/api-nycklar"
                className="underline hover:text-foreground"
              >
                Inställningar &rarr; API-nycklar
              </Link>
              , vilket omedelbart stänger av agentens åtkomst.
            </p>
            <p className="text-sm text-foreground/60">
              Destruktiva verktyg (t.ex. radera recept) kräver en explicit
              bekräftelseflagga från agenten.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              Teknisk översikt
            </h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                Transport: MCP Streamable HTTP (<Code>POST /mcp</Code>)
              </li>
              <li>
                Auktorisering: OAuth 2.1, PKCE (S256), dynamisk
                klientregistrering (RFC 7591)
              </li>
              <li>
                Discovery: <Code>/.well-known/oauth-authorization-server</Code>{' '}
                och <Code>/.well-known/oauth-protected-resource/mcp</Code>
              </li>
              <li>
                Underliggande API:{' '}
                <Link
                  to="/api-dokumentation"
                  className="underline hover:text-foreground"
                >
                  api.matrummet.se
                </Link>
              </li>
            </ul>
          </section>
        </div>
      </article>
    </div>
  )
}
