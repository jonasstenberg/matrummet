# Home Assistant-integration

Integrera Recept med Home Assistant via det publika API:et (`api.matrummet.se`). API:et drivs av PostgREST och autentiseras med `X-API-Key`-headern.

## Förutsättningar

1. Ett användarkonto på Recept
2. Home Assistant 2023.1 eller senare

## Steg 1: Skapa API-nyckel

1. Logga in på Recept
2. Gå till **Inställningar** > **API-nycklar**
3. Klicka **Skapa ny nyckel**
4. Ge nyckeln ett namn (t.ex. "Home Assistant")
5. **Viktigt:** Kopiera nyckeln direkt! Den visas bara en gång.
6. Lägg till nyckeln i `secrets.yaml`:

```yaml
recept_api_key: "sk_ditt-api-nyckel-här"
```

## Steg 2: Konfigurera sensor

Lägg till i `configuration.yaml`:

```yaml
sensor:
  - platform: rest
    name: "Inköpslista"
    resource: "https://api.matrummet.se/shopping_list_view?order=is_checked.asc,sort_order.asc"
    headers:
      X-API-Key: !secret recept_api_key
    value_template: "{{ value_json | selectattr('is_checked', 'false') | list | length }}"
    unit_of_measurement: "varor"
    json_attributes_path: "$"
    scan_interval: 300
```

## Steg 3: Konfigurera kommandon (valfritt)

För att bocka av varor och rensa listan via Home Assistant:

```yaml
rest_command:
  recept_toggle_item:
    url: "https://api.matrummet.se/rpc/toggle_shopping_list_item"
    method: POST
    headers:
      X-API-Key: !secret recept_api_key
      Content-Type: application/json
    payload: '{"p_item_id": "{{ item_id }}"}'

  recept_clear_checked:
    url: "https://api.matrummet.se/rpc/clear_checked_items"
    method: POST
    headers:
      X-API-Key: !secret recept_api_key
      Content-Type: application/json
    payload: '{}'
```

## Steg 4: Dashboard-kort

Skapa ett kort som visar inköpslistan:

```yaml
type: markdown
title: Inköpslista
content: |
  {% set items = state_attr('sensor.inkopslista', 'items') %}
  {% if items is none or items | length == 0 %}
  Inköpslistan är tom!
  {% else %}
  {% for item in items if not item.is_checked %}
  - [ ] {{ item.quantity }} {{ item.display_unit }} {{ item.display_name }}
  {% endfor %}
  {% endif %}
```

## Steg 5: Automationer

### Påminnelse när du lämnar hemmet

```yaml
automation:
  - alias: "Påminn om inköpslista"
    trigger:
      - platform: zone
        entity_id: person.du
        zone: zone.home
        event: leave
    condition:
      - condition: numeric_state
        entity_id: sensor.inkopslista
        above: 0
    action:
      - service: notify.mobile_app
        data:
          title: "Inköpslista"
          message: "Du har {{ states('sensor.inkopslista') }} varor på inköpslistan"
```

### Rensa listan automatiskt

```yaml
automation:
  - alias: "Rensa avbockade varor varje natt"
    trigger:
      - platform: time
        at: "03:00:00"
    action:
      - service: rest_command.recept_clear_checked
```

## API-dokumentation

PostgREST genererar en fullständig OpenAPI-specifikation automatiskt:

```
https://api.matrummet.se/
```

Öppna URL:en i en webbläsare (den returnerar JSON med `Accept: application/openapi+json`).

### Tillgängliga endpoints

| Funktion | Endpoint | Metod |
|----------|----------|-------|
| Sök recept | `/rpc/search_recipes` | POST |
| Receptdetaljer | `/recipes_and_categories?id=eq.{id}` | GET |
| Bläddra recept | `/recipes_and_categories?order=date_published.desc&limit=20` | GET |
| Lista kategorier | `/categories?select=name&order=name` | GET |
| Hämta skafferi | `/rpc/get_user_pantry` | POST |
| Lägg till i skafferi | `/rpc/add_to_pantry` | POST |
| Ta bort från skafferi | `/rpc/remove_from_pantry` | POST |
| Vanliga skaffervaror | `/rpc/get_common_pantry_items` | POST |
| Recept utifrån skafferi | `/rpc/find_recipes_from_pantry` | POST |
| Alla inköpslistor | `/rpc/get_user_shopping_lists` | POST |
| Inköpslistans varor | `/shopping_list_view?order=is_checked.asc,sort_order.asc` | GET |
| Lägg till recept i lista | `/rpc/add_recipe_to_shopping_list` | POST |
| Bocka av/på vara | `/rpc/toggle_shopping_list_item` | POST |
| Rensa avbockade | `/rpc/clear_checked_items` | POST |

### Autentisering

Alla anrop kräver `X-API-Key` header med en giltig API-nyckel. Publika data (t.ex. recept) kan läsas utan nyckel.

### Exempel med curl

Hämta inköpslistan:

```bash
curl -H "X-API-Key: sk_din-nyckel" \
  https://api.matrummet.se/shopping_list_view?order=is_checked.asc,sort_order.asc
```

Bocka av en vara:

```bash
curl -X POST \
  -H "X-API-Key: sk_din-nyckel" \
  -H "Content-Type: application/json" \
  -d '{"p_item_id": "uuid-här"}' \
  https://api.matrummet.se/rpc/toggle_shopping_list_item
```

Sök recept:

```bash
curl -X POST \
  -H "X-API-Key: sk_din-nyckel" \
  -H "Content-Type: application/json" \
  -d '{"search_query": "kanelbullar"}' \
  https://api.matrummet.se/rpc/search_recipes
```

Hämta skafferi:

```bash
curl -X POST \
  -H "X-API-Key: sk_din-nyckel" \
  -H "Content-Type: application/json" \
  -d '{}' \
  https://api.matrummet.se/rpc/get_user_pantry
```

## Felsökning

### 403 Forbidden

- Kontrollera att API-nyckeln är korrekt
- Kontrollera att nyckeln inte har återkallats
- Se till att headern heter exakt `X-API-Key`

### Sensorn uppdateras inte

- Kontrollera `scan_interval` (standard 300 sekunder)
- Testa URL:en manuellt med curl
- Kontrollera Home Assistant-loggarna för fel

## Säkerhetsöverväganden

- Skapa en separat API-nyckel för Home Assistant
- Använd alltid HTTPS
- Återkalla nyckeln omedelbart om den komprometteras
