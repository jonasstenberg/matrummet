# Home Assistant-integration

Integrera din Recept-inkopslista med Home Assistant for att visa och hantera din inkopslista via dashboards, rostassistenter och automationer.

## Forutsattningar

1. En Recept-instans tillganglig via HTTPS
2. Ett anvandarkonto pa Recept
3. Home Assistant 2023.1 eller senare

## Steg 1: Skapa API-nyckel

1. Logga in pa Recept
2. Ga till **Installningar** > **API-nycklar**
3. Klicka **Skapa ny nyckel**
4. Ge nyckeln ett namn (t.ex. "Home Assistant")
5. **Viktigt:** Kopiera nyckeln direkt! Den visas bara en gang.
6. Lagg till nyckeln i `secrets.yaml`:

```yaml
recept_api_key: "sk_ditt-api-nyckel-har"
```

## Steg 2: Konfigurera sensor

Lagg till i `configuration.yaml`:

```yaml
sensor:
  - platform: rest
    name: "Inkopslista"
    resource: "https://din-recept-url.com/api/shopping-list"
    headers:
      X-API-Key: !secret recept_api_key
    value_template: "{{ value_json.unchecked_count }}"
    unit_of_measurement: "varor"
    json_attributes:
      - items
      - checked_count
      - unchecked_count
    scan_interval: 300
```

## Steg 3: Konfigurera kommandon (valfritt)

For att kunna bocka av varor via Home Assistant:

```yaml
rest_command:
  recept_check_item:
    url: "https://din-recept-url.com/api/shopping-list/check"
    method: POST
    headers:
      X-API-Key: !secret recept_api_key
      Content-Type: application/json
    payload: '{"item_id": "{{ item_id }}", "checked": {{ checked }}}'

  recept_clear_checked:
    url: "https://din-recept-url.com/api/shopping-list/clear"
    method: POST
    headers:
      X-API-Key: !secret recept_api_key
      Content-Type: application/json
```

## Steg 4: Dashboard-kort

Skapa ett kort som visar inkopslistan:

```yaml
type: markdown
title: Inkopslista
content: |
  {% set items = state_attr('sensor.inkopslista', 'items') | selectattr('is_checked', 'false') | list %}
  {% if items | length == 0 %}
  Inkopslistan ar tom!
  {% else %}
  {% for item in items %}
  - [ ] {{ item.quantity }} {{ item.unit }} {{ item.name }}
  {% endfor %}
  {% endif %}
```

### Alternativ: Entitetslista med script

For en mer interaktiv lista kan du skapa scripts for varje vara:

```yaml
script:
  check_shopping_item:
    alias: "Bocka av vara"
    sequence:
      - service: rest_command.recept_check_item
        data:
          item_id: "{{ item_id }}"
          checked: true
```

## API-dokumentation

Fullstandig OpenAPI-specifikation finns pa:
`https://din-recept-url.com/api/openapi.json`

### Endpoints

| Endpoint | Metod | Beskrivning |
|----------|-------|-------------|
| `/api/shopping-list` | GET | Hamta inkopslista |
| `/api/shopping-list/check` | POST | Bocka av/pa objekt |
| `/api/shopping-list/clear` | POST | Rensa avbockade objekt |

### Autentisering

Alla anrop kraver `X-API-Key` header med en giltig API-nyckel.

### Exempel med curl

Hamta inkopslistan:

```bash
curl -H "X-API-Key: sk_din-nyckel" https://din-recept-url.com/api/shopping-list
```

Bocka av en vara:

```bash
curl -X POST \
  -H "X-API-Key: sk_din-nyckel" \
  -H "Content-Type: application/json" \
  -d '{"item_id": "uuid-har", "checked": true}' \
  https://din-recept-url.com/api/shopping-list/check
```

## Automationer

### Paminnelse nar du lamnar hemmet

```yaml
automation:
  - alias: "Paminn om inkopslista"
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
          title: "Inkopslista"
          message: "Du har {{ states('sensor.inkopslista') }} varor pa inkopslistan"
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

## Felsokning

### 401 Unauthorized

- Kontrollera att API-nyckeln ar korrekt
- Kontrollera att nyckeln inte har aterkallats
- Se till att headern heter exakt `X-API-Key`

### Sensorn uppdateras inte

- Kontrollera `scan_interval` (standard 300 sekunder)
- Testa URL:en manuellt med curl
- Kontrollera Home Assistant-loggarna for fel

### Inga attribut visas

- Se till att `json_attributes` ar korrekt konfigurerat
- Kontrollera att API:et returnerar forvantat format

## Sakerhetsovervaganden

- Skapa en separat API-nyckel for Home Assistant
- Anvand alltid HTTPS
- Aterkalla nyckeln omedelbart om den komprometteras
- Overvaega att begranusa atkomst via brandvagg om mojligt
