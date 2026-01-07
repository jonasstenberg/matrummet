# AI Food Review Cron Job Specification

## Overview

Automated daily cron job with two responsibilities:

1. **Review pending foods** — AI validates new food names, approves valid entries, rejects garbage
2. **Link orphaned ingredients** — Matches ingredients without `food_id` to existing approved foods

**Value Proposition:**

- Eliminates manual admin burden for food approval
- Ensures consistent naming conventions across the food database
- Catches typos, gibberish, and inappropriate entries automatically
- Maintains high-quality normalized food data
- Retroactively normalizes old recipe ingredients

## Current State

The existing food approval workflow (V12 migration):

- Users create foods via `get_or_create_food()` with `status = 'pending'`
- Admins manually call `approve_food()` or `reject_food()`
- Trigram similarity (> 0.7) blocks creation of near-duplicates
- Pending foods only visible to creator and admins

## User Stories

1. System automatically reviews pending foods every 24 hours
2. AI approves valid Swedish food names
3. AI rejects invalid entries (typos, gibberish, non-food items)
4. AI suggests merging near-duplicates with existing approved foods
5. Admin can override AI decisions
6. System logs AI reasoning for audit trail
7. System links orphaned ingredients (missing `food_id`) to matching approved foods

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  System Cron /  │────>│  review-foods.ts │────>│    Google AI    │
│  Systemd Timer  │     │   (standalone)   │     │  (Gemini API)   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌──────────────────┐
                        │   PostgreSQL     │
                        │  (foods table)   │
                        └──────────────────┘
```

**Hetzner VPS Setup:**

- Cron/systemd triggers standalone TypeScript script
- Direct PostgreSQL connection (no HTTP overhead)
- Logs to `/var/log/recept/food-review.log`

### Cron Options

1. **System Cron + Script** (Recommended for Hetzner VPS)
   - Add crontab entry to run daily
   - Standalone TypeScript script using tsx
   - Direct database connection, no HTTP overhead

2. **System Cron + API Call** (Alternative)
   - Crontab calls protected API endpoint via curl
   - Reuses existing Next.js infrastructure
   - Requires running Next.js server

3. **pg_cron Extension** (Database-level)
   - Requires PostgreSQL extension
   - Good for simpler operations, less ideal for AI calls

## Database Schema

```sql
-- Add AI review tracking columns to foods table
ALTER TABLE foods
  ADD COLUMN ai_reviewed_at TIMESTAMPTZ,
  ADD COLUMN ai_decision food_status,
  ADD COLUMN ai_reasoning TEXT,
  ADD COLUMN ai_confidence REAL,
  ADD COLUMN ai_suggested_merge_id UUID REFERENCES foods(id);

-- Track review history for audit
CREATE TABLE food_review_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  food_id UUID NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  decision food_status NOT NULL,
  reasoning TEXT,
  confidence REAL,
  suggested_merge_id UUID REFERENCES foods(id),
  reviewer_type TEXT NOT NULL CHECK (reviewer_type IN ('ai', 'admin')),
  reviewer_email TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX food_review_logs_food_id_idx ON food_review_logs(food_id);
CREATE INDEX food_review_logs_created_at_idx ON food_review_logs(created_at);
```

## API Endpoints

### Admin Override Endpoint

`POST /api/admin/foods/:id/override`

```json
{
  "decision": "approved",
  "reason": "Valid regional dialect spelling"
}
```

## AI Integration

### System Prompt

```
Du är en datavalidator för en svensk receptdatabas. Din uppgift är att granska föreslagna livsmedelsnamn.

För varje livsmedel, avgör:
1. Är det ett giltigt svenskt livsmedelsnamn?
2. Är stavningen korrekt?
3. Finns det redan ett liknande godkänt livsmedel? (se listan nedan)

Svara i JSON-format:
{
  "decision": "approved" | "rejected" | "needs_review",
  "confidence": 0.0-1.0,
  "reasoning": "Kort förklaring på svenska",
  "suggestedMergeId": "uuid eller null om duplicat hittas"
}

Godkänn om:
- Giltigt svenskt livsmedelsnamn
- Korrekt stavning
- Inget uppenbart dublett

Avslå om:
- Skräptext eller slumpmässiga tecken
- Uppenbart felstavat (t.ex. "tmoat" istället för "tomat")
- Inte ett livsmedel (t.ex. "bil", "dator")
- Olämpligt innehåll

Markera "needs_review" om:
- Ovanligt men möjligt livsmedel
- Regional dialekt eller stavningsvariant
- Osäker på om det är en dublett
```

### Request Structure

```json
{
  "pendingFood": {
    "id": "uuid",
    "name": "kycklingfilé"
  },
  "similarApprovedFoods": [
    { "id": "uuid", "name": "kyckling", "similarity": 0.75 },
    { "id": "uuid", "name": "kycklingbröst", "similarity": 0.82 }
  ]
}
```

### Expected Response

```json
{
  "decision": "approved",
  "confidence": 0.95,
  "reasoning": "Giltigt svenskt livsmedelsnamn. Kycklingfilé är en specifik styckningsdetalj som skiljer sig från 'kycklingbröst'.",
  "suggestedMergeId": null
}
```

## Implementation

### Standalone Cron Script (`scripts/review-foods.ts`)

````typescript
#!/usr/bin/env npx tsx
import { GoogleGenAI } from "@google/genai";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!);
const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

interface PendingFood {
  id: string;
  name: string;
  created_by: string;
}

interface SimilarFood {
  id: string;
  name: string;
  similarity: number;
}

interface AIDecision {
  decision: "approved" | "rejected" | "needs_review";
  confidence: number;
  reasoning: string;
  suggestedMergeId: string | null;
}

async function fetchPendingFoods(limit = 50): Promise<PendingFood[]> {
  return sql`
    SELECT id, name, created_by
    FROM foods
    WHERE status = 'pending' AND ai_reviewed_at IS NULL
    ORDER BY date_published ASC
    LIMIT ${limit}
  `;
}

async function findSimilarApprovedFoods(name: string): Promise<SimilarFood[]> {
  return sql`
    SELECT id, name, similarity(name, ${name}) as similarity
    FROM foods
    WHERE status = 'approved' AND similarity(name, ${name}) > 0.3
    ORDER BY similarity DESC
    LIMIT 5
  `;
}

async function reviewFoodWithAI(
  food: PendingFood,
  similarFoods: SimilarFood[]
): Promise<AIDecision> {
  const prompt = `Du är en datavalidator för en svensk receptdatabas. Godkänn giltiga svenska livsmedelsnamn. Avslå skräptext, felstavningar och icke-livsmedel.

Granska detta livsmedelsnamn: "${food.name}"

Liknande godkända livsmedel:
${similarFoods.map((f) => `- ${f.name} (likhet: ${(f.similarity * 100).toFixed(0)}%)`).join("\n") || "Inga liknande hittades"}

Svara ENDAST med JSON (ingen markdown):
{"decision": "approved|rejected|needs_review", "confidence": 0.0-1.0, "reasoning": "...", "suggestedMergeId": "uuid|null"}`;

  const response = await genai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });

  const text = response.text?.trim() || "";
  // Strip markdown code blocks if present
  const jsonText = text.replace(/^```json\n?|\n?```$/g, "");
  return JSON.parse(jsonText);
}

async function applyDecision(foodId: string, decision: AIDecision) {
  await sql`
    SELECT apply_ai_food_review(
      ${foodId}::uuid,
      ${decision.decision}::food_status,
      ${decision.reasoning},
      ${decision.confidence},
      ${decision.suggestedMergeId}::uuid
    )
  `;
}

// ============================================================================
// Orphaned Ingredient Linking
// ============================================================================

interface OrphanedIngredient {
  ingredient_name: string;
  ingredient_count: number;
}

interface MatchResult {
  foodId: string | null;
  confidence: number;
  reasoning: string;
}

async function fetchOrphanedIngredients(limit = 100): Promise<OrphanedIngredient[]> {
  return sql`
    SELECT name as ingredient_name, COUNT(*)::int as ingredient_count
    FROM ingredients
    WHERE food_id IS NULL
      AND name IS NOT NULL
      AND trim(name) != ''
    GROUP BY name
    ORDER BY COUNT(*) DESC
    LIMIT ${limit}
  `;
}

// Strip preparation instructions: "smör, rumstempererat" → "smör"
function extractBaseFoodName(name: string): string {
  return name.split(',')[0].trim();
}

async function findMatchingFood(ingredientName: string): Promise<{ id: string; name: string } | null> {
  const baseName = extractBaseFoodName(ingredientName);

  // Try exact match on full name first, then base name
  const [match] = await sql`
    SELECT id, name
    FROM foods
    WHERE status = 'approved'
      AND (
        lower(name) = lower(${ingredientName.trim()})
        OR lower(name) = lower(${baseName})
      )
    ORDER BY
      CASE WHEN lower(name) = lower(${ingredientName.trim()}) THEN 0 ELSE 1 END
    LIMIT 1
  `;
  return match || null;
}

async function findCandidateFoods(ingredientName: string): Promise<SimilarFood[]> {
  const baseName = extractBaseFoodName(ingredientName);

  return sql`
    SELECT id, name,
      GREATEST(
        similarity(name, ${ingredientName}),
        similarity(name, ${baseName})
      ) as similarity
    FROM foods
    WHERE status = 'approved'
      AND (
        similarity(name, ${ingredientName}) > 0.4
        OR similarity(name, ${baseName}) > 0.4
        OR lower(name) = lower(${baseName})
      )
    ORDER BY similarity DESC
    LIMIT 5
  `;
}

async function matchIngredientWithAI(
  ingredientName: string,
  candidates: SimilarFood[]
): Promise<MatchResult> {
  if (candidates.length === 0) {
    return { foodId: null, confidence: 0, reasoning: 'Inga kandidater hittades' };
  }

  const prompt = `Du hjälper till att matcha ingredienser i recept mot en normaliserad livsmedelsdatabas.

Ingrediensnamn från recept: "${ingredientName}"

Kandidater i livsmedelsdatabasen:
${candidates.map((f, i) => `${i + 1}. "${f.name}" (id: ${f.id}, likhet: ${(f.similarity * 100).toFixed(0)}%)`).join('\n')}

VIKTIGT: Ingrediensnamn innehåller ofta tillagningsinstruktioner efter komma som ska ignoreras:
- "smör, rumstempererat" → matchar "smör"
- "lök, hackad" → matchar "lök"
- "vitlök, pressad" → matchar "vitlök"
- "kyckling, skuren i bitar" → matchar "kyckling"

Fokusera på själva livsmedlet, inte tillagningsformen.

Svara ENDAST med JSON:
{"foodId": "uuid eller null", "confidence": 0.0-1.0, "reasoning": "kort förklaring"}`;

  const response = await genai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });

  const text = response.text?.trim() || "";
  const jsonText = text.replace(/^```json\n?|\n?```$/g, "");
  return JSON.parse(jsonText);
}

async function linkIngredientToFood(ingredientName: string, foodId: string): Promise<number> {
  const [result] = await sql`
    UPDATE ingredients
    SET food_id = ${foodId}::uuid
    WHERE food_id IS NULL
      AND lower(trim(name)) = lower(trim(${ingredientName}))
    RETURNING id
  `;
  // Count affected rows
  const [{ count }] = await sql`
    SELECT COUNT(*)::int as count FROM ingredients
    WHERE food_id = ${foodId}::uuid
      AND lower(trim(name)) = lower(trim(${ingredientName}))
  `;
  return count;
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log(`[${new Date().toISOString()}] Starting food review job`);
  const startTime = Date.now();
  const foodResults = { reviewed: 0, approved: 0, rejected: 0, needsReview: 0 };
  const linkResults = { processed: 0, linked: 0, ingredientsUpdated: 0 };

  try {
    // Part 1: Review pending foods
    const pendingFoods = await fetchPendingFoods(50);
    console.log(`\n=== Reviewing ${pendingFoods.length} pending foods ===`);

    for (const food of pendingFoods) {
      try {
        const similarFoods = await findSimilarApprovedFoods(food.name);
        const decision = await reviewFoodWithAI(food, similarFoods);
        await applyDecision(food.id, decision);

        foodResults.reviewed++;
        if (decision.decision === "needs_review") foodResults.needsReview++;
        else if (decision.decision === "approved") foodResults.approved++;
        else foodResults.rejected++;

        console.log(
          `  ${food.name}: ${decision.decision} (${(decision.confidence * 100).toFixed(0)}%)`
        );
      } catch (err) {
        console.error(`  Error reviewing ${food.name}:`, err);
      }
    }

    // Part 2: Link orphaned ingredients
    const orphaned = await fetchOrphanedIngredients(100);
    console.log(`\n=== Linking ${orphaned.length} orphaned ingredient names ===`);

    for (const { ingredient_name, ingredient_count } of orphaned) {
      try {
        linkResults.processed++;

        // First try exact match
        const exactMatch = await findMatchingFood(ingredient_name);
        if (exactMatch) {
          const updated = await linkIngredientToFood(ingredient_name, exactMatch.id);
          linkResults.linked++;
          linkResults.ingredientsUpdated += updated;
          console.log(`  "${ingredient_name}" → "${exactMatch.name}" (exact, ${updated} ingredients)`);
          continue;
        }

        // Try AI matching with candidates
        const candidates = await findCandidateFoods(ingredient_name);
        if (candidates.length > 0) {
          const match = await matchIngredientWithAI(ingredient_name, candidates);
          if (match.foodId && match.confidence >= 0.8) {
            const updated = await linkIngredientToFood(ingredient_name, match.foodId);
            linkResults.linked++;
            linkResults.ingredientsUpdated += updated;
            const foodName = candidates.find(c => c.id === match.foodId)?.name || match.foodId;
            console.log(`  "${ingredient_name}" → "${foodName}" (AI ${(match.confidence * 100).toFixed(0)}%, ${updated} ingredients)`);
          } else {
            console.log(`  "${ingredient_name}": no confident match (${ingredient_count} occurrences)`);
          }
        } else {
          console.log(`  "${ingredient_name}": no candidates found (${ingredient_count} occurrences)`);
        }
      } catch (err) {
        console.error(`  Error linking "${ingredient_name}":`, err);
      }
    }
  } finally {
    await sql.end();
  }

  const duration = Date.now() - startTime;
  console.log(`\n=== Completed in ${duration}ms ===`);
  console.log('Food review:', foodResults);
  console.log('Ingredient linking:', linkResults);
}

main().catch(console.error);
````

### System Cron Configuration

```bash
# Add to crontab: crontab -e
# Run daily at 3 AM
0 3 * * * cd /opt/recept && /usr/bin/env DATABASE_URL="postgresql://..." GEMINI_API_KEY="..." npx tsx scripts/review-foods.ts >> /var/log/recept/food-review.log 2>&1
```

### Alternative: Systemd Timer

```ini
# /etc/systemd/system/recept-food-review.service
[Unit]
Description=Review pending food items with AI
After=network.target postgresql.service

[Service]
Type=oneshot
User=recept
WorkingDirectory=/opt/recept
Environment=DATABASE_URL=postgresql://...
Environment=GEMINI_API_KEY=...
ExecStart=/usr/bin/npx tsx scripts/review-foods.ts
StandardOutput=append:/var/log/recept/food-review.log
StandardError=append:/var/log/recept/food-review.log

# /etc/systemd/system/recept-food-review.timer
[Unit]
Description=Run food review daily

[Timer]
OnCalendar=*-*-* 03:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

Enable with: `systemctl enable --now recept-food-review.timer`

## Database Functions

### Fetch Pending Foods for Review

```sql
CREATE OR REPLACE FUNCTION get_pending_foods_for_review(p_limit INT DEFAULT 50)
RETURNS TABLE (
  id UUID,
  name TEXT,
  created_by TEXT,
  date_published TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT f.id, f.name, f.created_by, f.date_published
  FROM foods f
  WHERE f.status = 'pending'
    AND f.ai_reviewed_at IS NULL
  ORDER BY f.date_published ASC
  LIMIT p_limit;
$func$;
```

### Fetch Orphaned Ingredients

```sql
-- Get ingredients without food_id, grouped by unique name
CREATE OR REPLACE FUNCTION get_orphaned_ingredient_names(p_limit INT DEFAULT 100)
RETURNS TABLE (
  ingredient_name TEXT,
  ingredient_count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT name, COUNT(*) as ingredient_count
  FROM ingredients
  WHERE food_id IS NULL
    AND name IS NOT NULL
    AND trim(name) != ''
  GROUP BY name
  ORDER BY COUNT(*) DESC
  LIMIT p_limit;
$func$;
```

### Link Orphaned Ingredients to Food

```sql
CREATE OR REPLACE FUNCTION link_ingredients_to_food(
  p_ingredient_name TEXT,
  p_food_id UUID
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_updated INT;
BEGIN
  UPDATE ingredients
  SET food_id = p_food_id
  WHERE food_id IS NULL
    AND lower(trim(name)) = lower(trim(p_ingredient_name));

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$func$;
```

### Apply AI Decision

```sql
CREATE OR REPLACE FUNCTION apply_ai_food_review(
  p_food_id UUID,
  p_decision food_status,
  p_reasoning TEXT,
  p_confidence REAL,
  p_suggested_merge_id UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  -- Update food with AI decision
  UPDATE foods
  SET
    ai_reviewed_at = now(),
    ai_decision = p_decision,
    ai_reasoning = p_reasoning,
    ai_confidence = p_confidence,
    ai_suggested_merge_id = p_suggested_merge_id,
    -- Auto-apply high-confidence decisions
    status = CASE
      WHEN p_confidence >= 0.9 AND p_decision IN ('approved', 'rejected')
      THEN p_decision
      ELSE status
    END,
    reviewed_at = CASE
      WHEN p_confidence >= 0.9 AND p_decision IN ('approved', 'rejected')
      THEN now()
      ELSE reviewed_at
    END,
    reviewed_by = CASE
      WHEN p_confidence >= 0.9 AND p_decision IN ('approved', 'rejected')
      THEN 'ai-reviewer@system'
      ELSE reviewed_by
    END
  WHERE id = p_food_id;

  -- Log the review
  INSERT INTO food_review_logs (food_id, decision, reasoning, confidence, suggested_merge_id, reviewer_type)
  VALUES (p_food_id, p_decision, p_reasoning, p_confidence, p_suggested_merge_id, 'ai');
END;
$func$;
```

## Edge Cases

1. **AI Service Unavailable**: Skip review, retry next day
2. **Low Confidence Decisions**: Keep as `pending`, flag for admin review
3. **Rate Limiting**: Batch foods, process max 50 per run
4. **Duplicate AI Reviews**: Check `ai_reviewed_at` before processing
5. **Merge Suggestions**: Don't auto-merge, require admin confirmation

## Monitoring & Alerts

- Log all cron executions with results
- Alert if rejection rate > 50% (possible spam attack)
- Alert if cron fails 2+ consecutive times
- Weekly summary email to admins with review statistics

## Security Considerations

- Cron endpoint protected by secret token
- AI decisions logged for audit trail
- High-confidence threshold (0.9) for auto-approval
- Admin can always override AI decisions
- No direct database access from cron - uses RPC functions

## Success Metrics

**Food Review:**
- **Automation Rate**: % of foods auto-approved/rejected without admin intervention
- **Accuracy**: % of AI decisions not overridden by admins
- **Latency**: Average time from food creation to decision
- **Coverage**: % of pending foods reviewed within 24 hours

**Ingredient Linking:**
- **Link Rate**: % of orphaned ingredients successfully linked
- **Coverage**: % of total ingredients with valid `food_id`
- **Accuracy**: % of AI links not manually corrected

## Rollout Plan

1. **Phase 1**: AI review with logging only (no auto-apply)
2. **Phase 2**: Auto-apply high-confidence approvals (> 0.95)
3. **Phase 3**: Auto-apply high-confidence rejections (> 0.95)
4. **Phase 4**: Lower confidence threshold based on accuracy metrics
