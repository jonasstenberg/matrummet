import { createFileRoute } from '@tanstack/react-router'
import { Link } from '@tanstack/react-router'

export const Route = createFileRoute('/_main/api-dokumentation')({
  head: () => ({
    meta: [
      { title: 'API - Matrummet' },
      {
        name: 'description',
        content:
          'API-dokumentation för Matrummet. Autentisering, recept, skafferi, inköpslistor och hushåll.',
      },
    ],
  }),
  component: ApiDokumentationPage,
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

function ParamTable({
  params,
}: {
  params: {
    name: string
    type: string
    required: string
    description: string
  }[]
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border border-border rounded">
        <thead>
          <tr className="bg-muted/50">
            <th className="text-left px-3 py-2 font-medium">Parameter</th>
            <th className="text-left px-3 py-2 font-medium">Typ</th>
            <th className="text-left px-3 py-2 font-medium">Krävs</th>
            <th className="text-left px-3 py-2 font-medium">Beskrivning</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {params.map((p) => (
            <tr key={p.name}>
              <td className="px-3 py-2 font-mono text-xs">{p.name}</td>
              <td className="px-3 py-2 font-mono text-xs">{p.type}</td>
              <td className="px-3 py-2">{p.required}</td>
              <td className="px-3 py-2">{p.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Endpoint({
  name,
  children,
}: {
  name: string
  children: React.ReactNode
}) {
  return (
    <div>
      <h3 className="text-lg font-medium text-foreground mb-2">{name}</h3>
      {children}
    </div>
  )
}

function ApiDokumentationPage() {
  return (
    <div className="mx-auto max-w-prose px-4 py-12">
      <article>
        <h1 className="font-heading text-3xl font-bold mb-2">API</h1>
        <p className="text-foreground/60 mb-8">
          Dokumentation för Matrummets REST-API. Tillgänglig som{' '}
          <Link to="/api/docs" className="underline hover:text-foreground">
            ren text
          </Link>{' '}
          för agenter och verktyg.
        </p>

        <div className="space-y-10 text-foreground/80 leading-relaxed">
          {/* Authentication */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              Autentisering
            </h2>
            <p className="mb-3">
              Alla anrop kräver headern <Code>x-api-key</Code>:
            </p>
            <CodeBlock>x-api-key: sk_...</CodeBlock>
            <p className="mt-3 mb-4">
              Skapa nycklar under{' '}
              <Link
                to="/installningar/api-nycklar"
                className="underline hover:text-foreground"
              >
                Inställningar &rarr; API-nycklar
              </Link>{' '}
              efter inloggning. Nyckeln valideras av PostgREST och ger tillgång
              till din data via row-level security (RLS).
            </p>

            <h3 className="text-lg font-medium text-foreground mb-2">
              Hushållskopplade anrop
            </h3>
            <p className="mb-3">
              Skafferi-, inköpsliste- och hushållsoperationer kan vara kopplade
              till ett hushåll. Inkludera <Code>X-Active-Home-Id</Code> för att
              välja hushåll:
            </p>
            <CodeBlock>X-Active-Home-Id: &lt;home-uuid&gt;</CodeBlock>
            <p className="mt-2 text-sm text-foreground/60">
              Hämta ditt hushålls-ID via <Code>get_user_homes</Code> eller{' '}
              <Code>get_home_info</Code>.
            </p>
          </section>

          {/* Base URL */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              Bas-URL
            </h2>
            <CodeBlock>https://api.matrummet.se</CodeBlock>
            <p className="mt-3">
              Alla RPC-anrop använder{' '}
              <Code>POST /rpc/&lt;funktionsnamn&gt;</Code> med JSON-kropp.
              Tabell-/vyfrågor använder <Code>GET /&lt;vynamn&gt;</Code>.
            </p>
          </section>

          {/* Quick start */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              Snabbstart
            </h2>
            <p className="mb-3">Verifiera att din nyckel fungerar:</p>
            <CodeBlock title="bash">{`curl -s https://api.matrummet.se/rpc/current_user_info \\
  -H "x-api-key: sk_DIN_NYCKEL" \\
  -X POST`}</CodeBlock>
            <p className="mt-3">
              Returnerar din användarinfo (e-post, namn, roll).
            </p>
          </section>

          {/* Images */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              Bilder
            </h2>
            <p className="mb-4">
              Bilder hanteras av en separat bildtjänst på{' '}
              <Code>api.matrummet.se</Code>. Ladda upp en bild, få tillbaka
              ett UUID, och koppla det till ett recept via{' '}
              <Code>p_image</Code>.
            </p>

            <div className="space-y-8">
              <Endpoint name="POST /upload">
                <p className="mb-3">
                  Ladda upp en bild. Returnerar ett UUID som identifierar
                  bilden. Tjänsten genererar automatiskt fem storlekar (thumb,
                  small, medium, large, full) i WebP-format.
                </p>
                <CodeBlock title="bash">{`curl -s https://api.matrummet.se/upload \\
  -H "x-api-key: sk_DIN_NYCKEL" \\
  -F "file=@min-bild.jpg"`}</CodeBlock>
                <CodeBlock title="svar">{`{"filename": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"}`}</CodeBlock>
                <p className="mt-2 text-sm text-foreground/60">
                  Max filstorlek: 20 MB. Godkända format: JPEG, PNG, WebP och
                  andra vanliga bildformat.
                </p>
              </Endpoint>

              <Endpoint name="GET /images/:id/:size">
                <p className="mb-3">
                  Hämta en bild i en specifik storlek. Storleken kan utelämnas
                  (standard: <Code>full</Code>).
                </p>
                <CodeBlock title="bash">{`curl -s https://api.matrummet.se/images/BILD_UUID/thumb -o thumb.webp`}</CodeBlock>
                <div className="mt-3">
                  <ParamTable
                    params={[
                      {
                        name: 'thumb',
                        type: '320x240',
                        required: '',
                        description: 'Miniatyrbild för listor och kort',
                      },
                      {
                        name: 'small',
                        type: '640x480',
                        required: '',
                        description: 'Liten bild för mobilvyer',
                      },
                      {
                        name: 'medium',
                        type: '960x720',
                        required: '',
                        description: 'Mellanstor bild för receptsidor',
                      },
                      {
                        name: 'large',
                        type: '1280x960',
                        required: '',
                        description: 'Stor bild för desktop',
                      },
                      {
                        name: 'full',
                        type: '1920x1440',
                        required: 'standard',
                        description: 'Originalbild i full upplösning',
                      },
                    ]}
                  />
                </div>
                <p className="mt-2 text-sm text-foreground/60">
                  Bildvisning kräver ingen autentisering. Alla bilder serveras
                  som <Code>image/webp</Code> med lång cache och ETag-stöd.
                </p>
              </Endpoint>

              <Endpoint name="DELETE /images/:id">
                <p className="mb-3">
                  Radera en bild och alla dess storlekar. Kräver en
                  intern service-token och är inte tillgänglig via API-nyckel.
                </p>
                <p className="mb-3">
                  Bilder rensas automatiskt via en databasutlösare (trigger) när
                  ett recept raderas eller när bilden byts ut. Du behöver inte
                  radera bilder manuellt när du använder API:et.
                </p>
                <p className="text-sm text-foreground/60">
                  Operationen är idempotent — att radera en redan raderad bild
                  returnerar fortfarande <Code>{`{"success": true}`}</Code>.
                </p>
              </Endpoint>

              <div>
                <h3 className="text-lg font-medium text-foreground mb-2">
                  Koppla bild till recept
                </h3>
                <p className="mb-3">
                  Använd UUID:t från uppladdningen som{' '}
                  <Code>p_image</Code>{' '}
                  vid <Code>insert_recipe</Code> eller{' '}
                  <Code>update_recipe</Code>:
                </p>
                <CodeBlock title="bash">{`# 1. Ladda upp bilden
BILD_ID=$(curl -s https://api.matrummet.se/upload \\
  -H "x-api-key: sk_DIN_NYCKEL" \\
  -F "file=@pasta.jpg" | jq -r '.filename')

# 2. Skapa recept med bilden
curl -s https://api.matrummet.se/rpc/insert_recipe \\
  -H "x-api-key: sk_DIN_NYCKEL" \\
  -H "Content-Type: application/json" \\
  -d '{
    "p_name": "Pasta Carbonara",
    "p_image": "'$BILD_ID'",
    ...
  }'`}</CodeBlock>
                <p className="mt-3 text-sm text-foreground/60">
                  Bilder rensas automatiskt när ett recept raderas eller när
                  bilden ersätts — du behöver aldrig radera bilder manuellt.
                  Vid kopiering (<Code>copy_recipe</Code>) delas samma bild och
                  den raderas först när inget recept längre refererar till den.
                </p>
              </div>
            </div>
          </section>

          {/* Recipes */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              Recept
            </h2>

            <div className="space-y-8">
              <Endpoint name="insert_recipe">
                <p className="mb-3">
                  Skapa ett nytt recept. Returnerar receptets UUID.
                </p>
                <CodeBlock title="bash">{`curl -s https://api.matrummet.se/rpc/insert_recipe \\
  -H "x-api-key: sk_DIN_NYCKEL" \\
  -H "Content-Type: application/json" \\
  -d '{
    "p_name": "Pasta Carbonara",
    "p_author": "Kocken",
    "p_url": "",
    "p_recipe_yield": 4,
    "p_recipe_yield_name": "portioner",
    "p_prep_time": 10,
    "p_cook_time": 20,
    "p_description": "Klassisk italiensk pasta",
    "p_categories": ["Pasta", "Middag"],
    "p_ingredients": [
      {"name": "Spaghetti", "quantity": 400, "measurement": "g"},
      {"name": "Pancetta", "quantity": 150, "measurement": "g"}
    ],
    "p_instructions": [
      {"step": "Koka pastan al dente."},
      {"step": "Stek pancettan krispig."}
    ],
    "p_cuisine": "Italienskt"
  }'`}</CodeBlock>
                <div className="mt-3">
                  <ParamTable
                    params={[
                      {
                        name: 'p_name',
                        type: 'text',
                        required: 'ja',
                        description: 'Receptnamn',
                      },
                      {
                        name: 'p_author',
                        type: 'text',
                        required: 'ja',
                        description: 'Författare',
                      },
                      {
                        name: 'p_url',
                        type: 'text',
                        required: 'ja',
                        description: 'Käll-URL (tom sträng om ingen)',
                      },
                      {
                        name: 'p_recipe_yield',
                        type: 'integer',
                        required: 'ja',
                        description: 'Antal portioner',
                      },
                      {
                        name: 'p_recipe_yield_name',
                        type: 'text',
                        required: 'ja',
                        description: 'Portionsenhet (t.ex. "portioner")',
                      },
                      {
                        name: 'p_prep_time',
                        type: 'integer',
                        required: 'ja',
                        description: 'Förberedelsetid i minuter',
                      },
                      {
                        name: 'p_cook_time',
                        type: 'integer',
                        required: 'ja',
                        description: 'Tillagningstid i minuter',
                      },
                      {
                        name: 'p_description',
                        type: 'text',
                        required: 'ja',
                        description: 'Kort beskrivning',
                      },
                      {
                        name: 'p_categories',
                        type: 'text[]',
                        required: 'ja',
                        description: 'Kategorinamn',
                      },
                      {
                        name: 'p_ingredients',
                        type: 'jsonb[]',
                        required: 'ja',
                        description: 'Ingrediensobjekt (se datamodell)',
                      },
                      {
                        name: 'p_instructions',
                        type: 'jsonb[]',
                        required: 'ja',
                        description: 'Instruktionsobjekt (se datamodell)',
                      },
                      {
                        name: 'p_cuisine',
                        type: 'text',
                        required: 'nej',
                        description: 'Typ av kök',
                      },
                      {
                        name: 'p_image',
                        type: 'text',
                        required: 'nej',
                        description: 'Bild-ID från /upload (UUID, se Bilder ovan)',
                      },
                    ]}
                  />
                </div>
              </Endpoint>

              <Endpoint name="update_recipe">
                <p>
                  Uppdatera ett befintligt recept. Samma parametrar som{' '}
                  <Code>insert_recipe</Code> plus <Code>p_recipe_id</Code>{' '}
                  (uuid, krävs) och valfritt <Code>p_date_published</Code> (ISO
                  8601). Du måste äga receptet. Returnerar inget.
                </p>
              </Endpoint>

              <Endpoint name="copy_recipe">
                <p className="mb-3">
                  Kopiera ett recept till din samling. Returnerar det nya
                  receptets UUID.
                </p>
                <CodeBlock title="bash">{`curl -s https://api.matrummet.se/rpc/copy_recipe \\
  -H "x-api-key: sk_DIN_NYCKEL" \\
  -H "Content-Type: application/json" \\
  -d '{"p_source_recipe_id": "uuid-här"}'`}</CodeBlock>
              </Endpoint>

              <Endpoint name="search_recipes">
                <p className="mb-3">
                  Fulltextsökning bland recept (svensk stemming).
                </p>
                <CodeBlock title="bash">{`curl -s https://api.matrummet.se/rpc/search_recipes \\
  -H "x-api-key: sk_DIN_NYCKEL" \\
  -H "Content-Type: application/json" \\
  -d '{"p_query": "pasta", "p_owner_only": true, "p_limit": 20}'`}</CodeBlock>
                <div className="mt-3">
                  <ParamTable
                    params={[
                      {
                        name: 'p_query',
                        type: 'text',
                        required: 'ja',
                        description: 'Sökfråga',
                      },
                      {
                        name: 'p_owner_only',
                        type: 'boolean',
                        required: 'nej',
                        description: 'Bara egna recept (standard: false)',
                      },
                      {
                        name: 'p_category',
                        type: 'text',
                        required: 'nej',
                        description: 'Filtrera på kategori',
                      },
                      {
                        name: 'p_limit',
                        type: 'integer',
                        required: 'nej',
                        description: 'Max resultat (standard: 50)',
                      },
                      {
                        name: 'p_offset',
                        type: 'integer',
                        required: 'nej',
                        description: 'Sidnumrering (standard: 0)',
                      },
                      {
                        name: 'p_owner_ids',
                        type: 'uuid[]',
                        required: 'nej',
                        description: 'Filtrera på specifika ägare',
                      },
                    ]}
                  />
                </div>
              </Endpoint>

              <Endpoint name="search_liked_recipes">
                <p className="mb-3">Sök bland dina gillade recept.</p>
                <CodeBlock title="bash">{`curl -s https://api.matrummet.se/rpc/search_liked_recipes \\
  -H "x-api-key: sk_DIN_NYCKEL" \\
  -H "Content-Type: application/json" \\
  -d '{"p_query": "pasta", "p_category": null}'`}</CodeBlock>
              </Endpoint>

              <Endpoint name="toggle_recipe_like">
                <p className="mb-3">
                  Gilla eller avgilla ett recept (inte ditt eget). Returnerar{' '}
                  <Code>{`{"liked": true}`}</Code> eller{' '}
                  <Code>{`{"liked": false}`}</Code>.
                </p>
                <CodeBlock title="bash">{`curl -s https://api.matrummet.se/rpc/toggle_recipe_like \\
  -H "x-api-key: sk_DIN_NYCKEL" \\
  -H "Content-Type: application/json" \\
  -d '{"p_recipe_id": "uuid-här"}'`}</CodeBlock>
              </Endpoint>
            </div>
          </section>

          {/* Data model */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              Datamodell
            </h2>

            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-foreground mb-2">
                  Ingrediensobjekt
                </h3>
                <CodeBlock title="json">{`{
  "name": "Spaghetti",
  "quantity": 400,
  "measurement": "g"
}`}</CodeBlock>
                <div className="mt-3">
                  <ParamTable
                    params={[
                      {
                        name: 'name',
                        type: 'string',
                        required: 'ja',
                        description: 'Ingrediensnamn',
                      },
                      {
                        name: 'quantity',
                        type: 'number | null',
                        required: 'nej',
                        description: 'Mängd',
                      },
                      {
                        name: 'measurement',
                        type: 'string | null',
                        required: 'nej',
                        description: 'Enhet (t.ex. "g", "dl", "st")',
                      },
                      {
                        name: 'group_name',
                        type: 'string | null',
                        required: 'nej',
                        description: 'Grupp (t.ex. "Sås", "Topping")',
                      },
                    ]}
                  />
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium text-foreground mb-2">
                  Instruktionsobjekt
                </h3>
                <CodeBlock title="json">{`{
  "step": "Koka pastan al dente."
}`}</CodeBlock>
                <div className="mt-3">
                  <ParamTable
                    params={[
                      {
                        name: 'step',
                        type: 'string',
                        required: 'ja',
                        description: 'Instruktionstexten',
                      },
                    ]}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Search helpers */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              Sökhjälpare
            </h2>

            <div className="space-y-8">
              <Endpoint name="search_foods">
                <p className="mb-3">
                  Sök i livsmedelsdatabasen. Användbart för att hitta{' '}
                  <Code>food_id</Code> till skafferifunktionerna.
                </p>
                <CodeBlock title="bash">{`curl -s https://api.matrummet.se/rpc/search_foods \\
  -H "x-api-key: sk_DIN_NYCKEL" \\
  -H "Content-Type: application/json" \\
  -d '{"p_query": "tomat", "p_limit": 5}'`}</CodeBlock>
              </Endpoint>

              <Endpoint name="search_units">
                <p className="mb-3">Sök bland tillgängliga enheter.</p>
                <CodeBlock title="bash">{`curl -s https://api.matrummet.se/rpc/search_units \\
  -H "x-api-key: sk_DIN_NYCKEL" \\
  -H "Content-Type: application/json" \\
  -d '{"p_query": "gram", "p_limit": 5}'`}</CodeBlock>
              </Endpoint>
            </div>
          </section>

          {/* Pantry */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              Skafferi
            </h2>
            <p className="mb-4 text-sm text-foreground/60">
              Skafferioperationer är hushållskopplade. Inkludera{' '}
              <Code>X-Active-Home-Id</Code> om du tillhör ett hushåll.
            </p>

            <div className="space-y-8">
              <Endpoint name="add_to_pantry">
                <p className="mb-3">
                  Lägg till en vara i skafferiet. Används även för att uppdatera
                  utgångsdatum på befintliga varor (upsert). Returnerar UUID.
                </p>
                <CodeBlock title="bash">{`curl -s https://api.matrummet.se/rpc/add_to_pantry \\
  -H "x-api-key: sk_DIN_NYCKEL" \\
  -H "X-Active-Home-Id: home-uuid" \\
  -H "Content-Type: application/json" \\
  -d '{"p_food_id": "uuid-här", "p_expires_at": "2025-12-31"}'`}</CodeBlock>
                <p className="mt-2 text-sm text-foreground/60">
                  Alla parametrar utom <Code>p_food_id</Code> är valfria:{' '}
                  <Code>p_quantity</Code> (numeric), <Code>p_unit</Code> (text),{' '}
                  <Code>p_expires_at</Code> (datum).
                </p>
              </Endpoint>

              <Endpoint name="remove_from_pantry">
                <p className="mb-3">Ta bort en vara från skafferiet.</p>
                <CodeBlock title="bash">{`curl -s https://api.matrummet.se/rpc/remove_from_pantry \\
  -H "x-api-key: sk_DIN_NYCKEL" \\
  -H "X-Active-Home-Id: home-uuid" \\
  -H "Content-Type: application/json" \\
  -d '{"p_food_id": "uuid-här"}'`}</CodeBlock>
              </Endpoint>

              <Endpoint name="get_user_pantry">
                <p className="mb-3">Lista allt i ditt skafferi.</p>
                <CodeBlock title="bash">{`curl -s https://api.matrummet.se/rpc/get_user_pantry \\
  -H "x-api-key: sk_DIN_NYCKEL" \\
  -H "X-Active-Home-Id: home-uuid" \\
  -H "Content-Type: application/json" \\
  -d '{}'`}</CodeBlock>
                <p className="mt-2 text-sm text-foreground/60">
                  Returnerar: id, food_id, food_name, quantity, unit, added_at,
                  expires_at, is_expired, added_by.
                </p>
              </Endpoint>

              <Endpoint name="get_common_pantry_items">
                <p className="mb-3">
                  Hämta vanliga skafferivaror (för snabbval).
                </p>
                <CodeBlock title="bash">{`curl -s https://api.matrummet.se/rpc/get_common_pantry_items \\
  -H "x-api-key: sk_DIN_NYCKEL" \\
  -H "Content-Type: application/json" \\
  -d '{}'`}</CodeBlock>
              </Endpoint>

              <Endpoint name="find_recipes_from_pantry">
                <p className="mb-3">
                  Hitta recept du kan laga med det som finns i skafferiet.
                </p>
                <CodeBlock title="bash">{`curl -s https://api.matrummet.se/rpc/find_recipes_from_pantry \\
  -H "x-api-key: sk_DIN_NYCKEL" \\
  -H "X-Active-Home-Id: home-uuid" \\
  -H "Content-Type: application/json" \\
  -d '{"p_min_match_percentage": 50, "p_limit": 10}'`}</CodeBlock>
                <p className="mt-2 text-sm text-foreground/60">
                  Returnerar recept rankade efter matchningsgrad med saknade
                  ingredienser.
                </p>
              </Endpoint>

              <Endpoint name="find_recipes_by_ingredients">
                <p className="mb-3">
                  Hitta recept baserat på specifika livsmedels-ID:n (utan att
                  läsa från skafferiet).
                </p>
                <CodeBlock title="bash">{`curl -s https://api.matrummet.se/rpc/find_recipes_by_ingredients \\
  -H "x-api-key: sk_DIN_NYCKEL" \\
  -H "Content-Type: application/json" \\
  -d '{
    "p_food_ids": ["food-uuid-1", "food-uuid-2"],
    "p_user_email": null,
    "p_min_match_percentage": 50,
    "p_limit": 20
  }'`}</CodeBlock>
              </Endpoint>

              <Endpoint name="deduct_from_pantry">
                <p className="mb-3">
                  Dra av mängder från skafferiet efter matlagning. Returnerar
                  antal avdragna varor.
                </p>
                <CodeBlock title="bash">{`curl -s https://api.matrummet.se/rpc/deduct_from_pantry \\
  -H "x-api-key: sk_DIN_NYCKEL" \\
  -H "X-Active-Home-Id: home-uuid" \\
  -H "Content-Type: application/json" \\
  -d '{"p_deductions": [{"food_id": "uuid", "amount": 200}]}'`}</CodeBlock>
              </Endpoint>
            </div>
          </section>

          {/* Shopping lists */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              Inköpslistor
            </h2>
            <p className="mb-4 text-sm text-foreground/60">
              Inköpslisteoperationer är hushållskopplade. Inkludera{' '}
              <Code>X-Active-Home-Id</Code> om du tillhör ett hushåll.
            </p>

            <div className="space-y-8">
              <Endpoint name="create_shopping_list">
                <p className="mb-3">
                  Skapa en ny inköpslista. Returnerar UUID.
                </p>
                <CodeBlock title="bash">{`curl -s https://api.matrummet.se/rpc/create_shopping_list \\
  -H "x-api-key: sk_DIN_NYCKEL" \\
  -H "Content-Type: application/json" \\
  -d '{"p_name": "Veckans inköp"}'`}</CodeBlock>
                <p className="mt-2 text-sm text-foreground/60">
                  Valfritt: <Code>p_home_id</Code> (uuid) för att skapa en delad
                  hushållslista.
                </p>
              </Endpoint>

              <Endpoint name="get_user_shopping_lists">
                <p className="mb-3">
                  Lista alla dina inköpslistor med antal varor.
                </p>
                <CodeBlock title="bash">{`curl -s https://api.matrummet.se/rpc/get_user_shopping_lists \\
  -H "x-api-key: sk_DIN_NYCKEL" \\
  -H "X-Active-Home-Id: home-uuid" \\
  -H "Content-Type: application/json" \\
  -d '{}'`}</CodeBlock>
                <p className="mt-2 text-sm text-foreground/60">
                  Returnerar: id, name, is_default, item_count, checked_count,
                  date_published, date_modified, home_id, home_name.
                </p>
              </Endpoint>

              <Endpoint name="add_recipe_to_shopping_list">
                <p className="mb-3">
                  Lägg till ett recepts ingredienser på en inköpslista.
                </p>
                <CodeBlock title="bash">{`curl -s https://api.matrummet.se/rpc/add_recipe_to_shopping_list \\
  -H "x-api-key: sk_DIN_NYCKEL" \\
  -H "X-Active-Home-Id: home-uuid" \\
  -H "Content-Type: application/json" \\
  -d '{"p_recipe_id": "uuid-här", "p_servings": 4}'`}</CodeBlock>
                <p className="mt-2 text-sm text-foreground/60">
                  Valfritt: <Code>p_shopping_list_id</Code> (null =
                  standardlista), <Code>p_ingredient_ids</Code> (uuid[], null =
                  alla).
                </p>
              </Endpoint>

              <Endpoint name="add_custom_shopping_list_item">
                <p className="mb-3">
                  Lägg till en egen vara (ej från recept) på en inköpslista.
                </p>
                <CodeBlock title="bash">{`curl -s https://api.matrummet.se/rpc/add_custom_shopping_list_item \\
  -H "x-api-key: sk_DIN_NYCKEL" \\
  -H "X-Active-Home-Id: home-uuid" \\
  -H "Content-Type: application/json" \\
  -d '{"p_name": "Hushållspapper", "p_shopping_list_id": "uuid-här"}'`}</CodeBlock>
                <p className="mt-2 text-sm text-foreground/60">
                  Valfritt: <Code>p_food_id</Code> (uuid) för att koppla till
                  ett livsmedel.
                </p>
              </Endpoint>

              <Endpoint name="toggle_shopping_list_item">
                <p className="mb-3">Bocka av/på en vara.</p>
                <CodeBlock title="bash">{`curl -s https://api.matrummet.se/rpc/toggle_shopping_list_item \\
  -H "x-api-key: sk_DIN_NYCKEL" \\
  -H "X-Active-Home-Id: home-uuid" \\
  -H "Content-Type: application/json" \\
  -d '{"p_item_id": "uuid-här"}'`}</CodeBlock>
              </Endpoint>

              <Endpoint name="clear_checked_items">
                <p className="mb-3">
                  Ta bort alla avbockade varor. Om{' '}
                  <Code>p_shopping_list_id</Code> är null rensas standardlistan.
                </p>
                <CodeBlock title="bash">{`curl -s https://api.matrummet.se/rpc/clear_checked_items \\
  -H "x-api-key: sk_DIN_NYCKEL" \\
  -H "X-Active-Home-Id: home-uuid" \\
  -H "Content-Type: application/json" \\
  -d '{"p_shopping_list_id": "uuid-här"}'`}</CodeBlock>
              </Endpoint>

              <Endpoint name="rename_shopping_list">
                <p className="mb-3">Byt namn på en inköpslista.</p>
                <CodeBlock title="bash">{`curl -s https://api.matrummet.se/rpc/rename_shopping_list \\
  -H "x-api-key: sk_DIN_NYCKEL" \\
  -H "Content-Type: application/json" \\
  -d '{"p_list_id": "uuid-här", "p_name": "Nytt namn"}'`}</CodeBlock>
              </Endpoint>

              <Endpoint name="set_default_shopping_list">
                <p className="mb-3">
                  Välj vilken inköpslista som är din standard.
                </p>
                <CodeBlock title="bash">{`curl -s https://api.matrummet.se/rpc/set_default_shopping_list \\
  -H "x-api-key: sk_DIN_NYCKEL" \\
  -H "Content-Type: application/json" \\
  -d '{"p_list_id": "uuid-här"}'`}</CodeBlock>
              </Endpoint>

              <Endpoint name="delete_shopping_list">
                <p className="mb-3">Radera en inköpslista med alla varor.</p>
                <CodeBlock title="bash">{`curl -s https://api.matrummet.se/rpc/delete_shopping_list \\
  -H "x-api-key: sk_DIN_NYCKEL" \\
  -H "Content-Type: application/json" \\
  -d '{"p_list_id": "uuid-här"}'`}</CodeBlock>
              </Endpoint>

              <div>
                <h3 className="text-lg font-medium text-foreground mb-2">
                  Läsa inköpslistevaror
                </h3>
                <p className="mb-3">
                  Varor läses via vyn <Code>shopping_list_view</Code>:
                </p>
                <CodeBlock title="bash">{`curl -s "https://api.matrummet.se/shopping_list_view?shopping_list_id=eq.LIST_UUID&order=is_checked.asc,sort_order.asc" \\
  -H "x-api-key: sk_DIN_NYCKEL" \\
  -H "X-Active-Home-Id: home-uuid"`}</CodeBlock>
              </div>
            </div>
          </section>

          {/* Household */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              Hushåll
            </h2>

            <div className="space-y-8">
              <Endpoint name="get_user_homes">
                <p className="mb-3">Lista alla hushåll du tillhör.</p>
                <CodeBlock title="bash">{`curl -s https://api.matrummet.se/rpc/get_user_homes \\
  -H "x-api-key: sk_DIN_NYCKEL" \\
  -H "Content-Type: application/json" \\
  -d '{}'`}</CodeBlock>
              </Endpoint>

              <Endpoint name="create_home">
                <p className="mb-3">
                  Skapa ett nytt hushåll. Returnerar UUID.
                </p>
                <CodeBlock title="bash">{`curl -s https://api.matrummet.se/rpc/create_home \\
  -H "x-api-key: sk_DIN_NYCKEL" \\
  -H "Content-Type: application/json" \\
  -d '{"p_name": "Familjen"}'`}</CodeBlock>
              </Endpoint>

              <Endpoint name="get_home_info">
                <p className="mb-3">
                  Hämta hushållsdetaljer inklusive medlemmar. Om{' '}
                  <Code>p_home_id</Code> är null returneras ditt nuvarande
                  hushåll (eller null om du inte har något).
                </p>
                <CodeBlock title="bash">{`curl -s https://api.matrummet.se/rpc/get_home_info \\
  -H "x-api-key: sk_DIN_NYCKEL" \\
  -H "X-Active-Home-Id: home-uuid" \\
  -H "Content-Type: application/json" \\
  -d '{"p_home_id": null}'`}</CodeBlock>
              </Endpoint>

              <Endpoint name="update_home_name">
                <p className="mb-3">Byt namn på ditt hushåll.</p>
                <CodeBlock title="bash">{`curl -s https://api.matrummet.se/rpc/update_home_name \\
  -H "x-api-key: sk_DIN_NYCKEL" \\
  -H "X-Active-Home-Id: home-uuid" \\
  -H "Content-Type: application/json" \\
  -d '{"p_name": "Nytt namn"}'`}</CodeBlock>
              </Endpoint>

              <Endpoint name="invite_to_home">
                <p className="mb-3">
                  Bjud in en användare via e-post. Returnerar inbjudans UUID.
                </p>
                <CodeBlock title="bash">{`curl -s https://api.matrummet.se/rpc/invite_to_home \\
  -H "x-api-key: sk_DIN_NYCKEL" \\
  -H "X-Active-Home-Id: home-uuid" \\
  -H "Content-Type: application/json" \\
  -d '{"p_email": "namn@exempel.se"}'`}</CodeBlock>
              </Endpoint>

              <Endpoint name="generate_join_code">
                <p className="mb-3">
                  Generera en delbar anslutningskod för ditt hushåll.
                </p>
                <CodeBlock title="bash">{`curl -s https://api.matrummet.se/rpc/generate_join_code \\
  -H "x-api-key: sk_DIN_NYCKEL" \\
  -H "X-Active-Home-Id: home-uuid" \\
  -H "Content-Type: application/json" \\
  -d '{"p_expires_hours": 48}'`}</CodeBlock>
              </Endpoint>

              <Endpoint name="join_home_by_code">
                <p className="mb-3">Gå med i ett hushåll med en kod.</p>
                <CodeBlock title="bash">{`curl -s https://api.matrummet.se/rpc/join_home_by_code \\
  -H "x-api-key: sk_DIN_NYCKEL" \\
  -H "Content-Type: application/json" \\
  -d '{"p_code": "ABC123"}'`}</CodeBlock>
              </Endpoint>

              <Endpoint name="leave_home">
                <p className="mb-3">Lämna ett hushåll.</p>
                <CodeBlock title="bash">{`curl -s https://api.matrummet.se/rpc/leave_home \\
  -H "x-api-key: sk_DIN_NYCKEL" \\
  -H "X-Active-Home-Id: home-uuid" \\
  -H "Content-Type: application/json" \\
  -d '{}'`}</CodeBlock>
              </Endpoint>

              <Endpoint name="remove_home_member">
                <p className="mb-3">
                  Ta bort en medlem från ditt hushåll.
                </p>
                <CodeBlock title="bash">{`curl -s https://api.matrummet.se/rpc/remove_home_member \\
  -H "x-api-key: sk_DIN_NYCKEL" \\
  -H "X-Active-Home-Id: home-uuid" \\
  -H "Content-Type: application/json" \\
  -d '{"p_member_email": "namn@exempel.se"}'`}</CodeBlock>
              </Endpoint>
            </div>
          </section>

          {/* Direct table access */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              Direkt tabellåtkomst
            </h2>
            <p className="mb-3">
              PostgREST exponerar tabeller och vyer direkt med standard
              frågesyntax:
            </p>
            <CodeBlock title="bash">{`# Hämta dina recept
curl -s "https://api.matrummet.se/user_recipes?limit=10&order=date_modified.desc" \\
  -H "x-api-key: sk_DIN_NYCKEL"

# Filtrera på kolumn
curl -s "https://api.matrummet.se/user_recipes?name=ilike.*pasta*" \\
  -H "x-api-key: sk_DIN_NYCKEL"

# Välj specifika kolumner
curl -s "https://api.matrummet.se/user_recipes?select=id,name,categories&limit=5" \\
  -H "x-api-key: sk_DIN_NYCKEL"`}</CodeBlock>
            <p className="mt-3">
              Vanliga operatorer: <Code>eq</Code>, <Code>neq</Code>,{' '}
              <Code>gt</Code>, <Code>lt</Code>, <Code>gte</Code>,{' '}
              <Code>lte</Code>, <Code>like</Code>, <Code>ilike</Code>,{' '}
              <Code>in</Code>, <Code>is</Code>. Se{' '}
              <a
                href="https://postgrest.org/en/stable/references/api/tables_views.html"
                className="underline hover:text-foreground"
                target="_blank"
                rel="noopener noreferrer"
              >
                PostgREST-dokumentationen
              </a>{' '}
              för fullständig syntax.
            </p>
          </section>

          {/* Limits */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              Begränsningar
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Max 1000 rader per anrop</li>
              <li>
                Sidnumrering med <Code>limit</Code> och <Code>offset</Code>
              </li>
              <li>RLS: du kan bara ändra din egen data</li>
            </ul>
          </section>

          {/* OpenAPI */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">
              OpenAPI-specifikation
            </h2>
            <p>
              En maskinläsbar OpenAPI-specifikation finns på{' '}
              <a
                href="https://api.matrummet.se/"
                className="underline hover:text-foreground"
                target="_blank"
                rel="noopener noreferrer"
              >
                api.matrummet.se
              </a>{' '}
              (begär med{' '}
              <Code>Accept: application/openapi+json</Code>).
            </p>
          </section>
        </div>

        <p className="text-sm text-muted-foreground mt-10">
          Senast uppdaterad: 22 februari 2026
        </p>
      </article>
    </div>
  )
}
