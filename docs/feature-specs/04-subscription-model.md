# Recept Premium: Subscription & Pricing Model

## Executive Summary

Monthly/annual subscription model introducing "Recept Premium" with AI-powered features, maintaining generous free tier for basic recipe management.

## Pricing

| Tier | Monthly | Annual |
|------|---------|--------|
| Free | 0 kr | - |
| Premium | **59 kr** | **590 kr** (17% off) |

## Feature Comparison

| Feature | Free | Premium |
|---------|------|---------|
| Recipe storage | 50 | Unlimited |
| AI recipe import | 3/month | Unlimited |
| "What can I make?" | 5/month | Unlimited |
| Shopping lists | 1 | Unlimited |
| Meal planning | ❌ | ✅ |
| Pantry tracking | ❌ | ✅ |
| AI recipe scaling | ❌ | ✅ |
| Nutritional info | ❌ | ✅ |
| Export JSON | ❌ | ✅ |

## Database Schema

```sql
CREATE TABLE subscription_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,              -- 'free', 'premium'
    display_name TEXT NOT NULL,             -- 'Recept Premium'
    price_monthly_sek INTEGER,              -- 5900 (öre)
    price_yearly_sek INTEGER,               -- 59000 (öre)
    stripe_price_id_monthly TEXT,
    stripe_price_id_yearly TEXT,
    features JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
    tier_id UUID NOT NULL REFERENCES subscription_tiers(id),
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT UNIQUE,
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'cancelled', 'past_due', 'trialing')),
    billing_interval TEXT CHECK (billing_interval IN ('month', 'year')),
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT false,
    UNIQUE(user_email)
);

CREATE TABLE usage_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
    feature TEXT NOT NULL,
    period_start DATE NOT NULL,
    usage_count INTEGER DEFAULT 0,
    UNIQUE(user_email, feature, period_start)
);
```

### Tier Features JSON
```json
{
    "recipe_limit": 50,
    "ai_import_monthly": 3,
    "what_can_i_make_monthly": 5,
    "shopping_lists": 1,
    "meal_planning": false,
    "pantry": false
}
```

## Stripe Integration

### Checkout Flow
```typescript
const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${APP_URL}/settings/subscription?success=true`,
    cancel_url: `${APP_URL}/pricing?cancelled=true`,
    locale: 'sv',
    automatic_tax: { enabled: true },
});
```

### Webhook Events
- `checkout.session.completed` → Create subscription
- `customer.subscription.updated` → Sync status
- `customer.subscription.deleted` → Mark cancelled
- `invoice.payment_failed` → Mark past_due

## Usage Tracking

### Check and Use Feature
```sql
CREATE OR REPLACE FUNCTION check_and_use_feature(p_email TEXT, p_feature TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_limit INTEGER;
    v_current INTEGER;
BEGIN
    -- Get limit for user's tier (null = unlimited)
    SELECT (features->>p_feature)::INTEGER INTO v_limit FROM ...;

    IF v_limit IS NULL THEN RETURN true; END IF;

    -- Check current usage
    SELECT usage_count INTO v_current FROM usage_tracking WHERE ...;

    IF COALESCE(v_current, 0) >= v_limit THEN RETURN false; END IF;

    -- Increment and allow
    INSERT INTO usage_tracking ... ON CONFLICT DO UPDATE SET usage_count = usage_count + 1;
    RETURN true;
END;
$$;
```

## Frontend Integration

### useSubscription Hook
```typescript
export function useSubscription() {
    const { data } = useSWR<Subscription>('/api/subscription');
    return {
        subscription: data,
        isPremium: data?.tier === 'premium' && data?.status === 'active',
    };
}

export function useFeatureGate(feature: string) {
    const { isPremium } = useSubscription();
    const { usage, canUse } = useFeatureUsage(feature);
    return { isAvailable: isPremium || canUse, requiresUpgrade: !isPremium && !canUse };
}
```

### Upgrade Prompts
| Trigger | Location |
|---------|----------|
| Recipe limit (50) | Recipe list, Add recipe |
| AI import limit (3/mo) | Import modal |
| Premium feature click | Various |

## Business Model

### Trial Strategy
- 7-day free trial with credit card
- Full feature access during trial
- Reminder emails: Day 1, Day 5, Day 7

### Churn Prevention
- Cancellation: Ask reason, offer pause, show losses
- Win-back: 30-day email with 3 months at 39 kr/month

### Unit Economics
| Metric | Value |
|--------|-------|
| AI cost per heavy user | ~3 kr/month |
| Stripe fees | 1.4% + 1.80 kr |
| Net per monthly sub | ~50 kr |
| Target LTV | 600 kr |
| Target churn | < 8%/month |

## Legal (Sweden/EU)

### Required Information
- Price including VAT (25%)
- Renewal terms
- Cancellation procedure
- 14-day cancellation right (Distansavtalslagen)

### Invoice Requirements
- Seller name, address, org number
- VAT amount and rate
- Total including VAT

### VAT Handling
| Customer | Treatment |
|----------|-----------|
| Sweden B2C | 25% Swedish VAT |
| EU B2C | Destination country VAT |
| Non-EU | No VAT |
| EU B2B with VAT ID | Reverse charge |
