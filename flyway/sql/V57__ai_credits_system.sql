-- V57: AI Credits System
--
-- Adds credit-based AI recipe generation:
-- 1. user_credits table (balance per user)
-- 2. credit_transactions table (immutable audit ledger)
-- 3. stripe_customers table (email -> stripe customer mapping)
-- 4. Functions: get_user_credits, deduct_credit, add_credits, get_credit_history
-- 5. Modify signup/signup_provider to grant 10 free credits
-- 6. Backfill existing users with 10 credits


-- =============================================================================
-- SECTION 1: TABLES
-- =============================================================================

CREATE TABLE user_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL UNIQUE REFERENCES users(email) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN (
    'signup_bonus', 'purchase', 'admin_grant', 'ai_generation', 'refund'
  )),
  description TEXT,
  stripe_payment_intent_id TEXT,
  recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_credit_transactions_user_email ON credit_transactions(user_email);
CREATE INDEX idx_credit_transactions_stripe_pi ON credit_transactions(stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

CREATE TABLE stripe_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL UNIQUE REFERENCES users(email) ON DELETE CASCADE,
  stripe_customer_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- =============================================================================
-- SECTION 2: RLS POLICIES
-- =============================================================================

-- user_credits: users can SELECT their own row; writes via SECURITY DEFINER functions only
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_credits FORCE ROW LEVEL SECURITY;

CREATE POLICY user_credits_select ON user_credits
  FOR SELECT
  USING (user_email = current_setting('request.jwt.claims', true)::jsonb->>'email');

-- credit_transactions: users can SELECT their own rows; inserts via SECURITY DEFINER only
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions FORCE ROW LEVEL SECURITY;

CREATE POLICY credit_transactions_select ON credit_transactions
  FOR SELECT
  USING (user_email = current_setting('request.jwt.claims', true)::jsonb->>'email');

-- stripe_customers: users can SELECT their own row
ALTER TABLE stripe_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_customers FORCE ROW LEVEL SECURITY;

CREATE POLICY stripe_customers_select ON stripe_customers
  FOR SELECT
  USING (user_email = current_setting('request.jwt.claims', true)::jsonb->>'email');

CREATE POLICY stripe_customers_insert ON stripe_customers
  FOR INSERT
  WITH CHECK (user_email = current_setting('request.jwt.claims', true)::jsonb->>'email');

-- Grant table access to authenticated role
GRANT SELECT ON user_credits TO authenticated;
GRANT SELECT ON credit_transactions TO authenticated;
GRANT SELECT, INSERT ON stripe_customers TO authenticated;


-- =============================================================================
-- SECTION 3: FUNCTIONS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- add_credits: Server-side function to add credits (idempotent via stripe PI)
-- NOT granted to anon - only called from SECURITY DEFINER functions or server
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION add_credits(
  p_user_email TEXT,
  p_amount INTEGER,
  p_transaction_type TEXT,
  p_description TEXT DEFAULT NULL,
  p_stripe_payment_intent_id TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_new_balance INTEGER;
  v_existing_tx UUID;
BEGIN
  -- Idempotency check for Stripe payments
  IF p_stripe_payment_intent_id IS NOT NULL THEN
    SELECT id INTO v_existing_tx
    FROM credit_transactions
    WHERE stripe_payment_intent_id = p_stripe_payment_intent_id;

    IF v_existing_tx IS NOT NULL THEN
      -- Already processed, return current balance
      SELECT balance INTO v_new_balance FROM user_credits WHERE user_email = p_user_email;
      RETURN COALESCE(v_new_balance, 0);
    END IF;
  END IF;

  -- Upsert user_credits row
  INSERT INTO user_credits (user_email, balance, updated_at)
  VALUES (p_user_email, p_amount, now())
  ON CONFLICT (user_email) DO UPDATE
  SET balance = user_credits.balance + p_amount,
      updated_at = now()
  RETURNING balance INTO v_new_balance;

  -- Record transaction
  INSERT INTO credit_transactions (user_email, amount, balance_after, transaction_type, description, stripe_payment_intent_id)
  VALUES (p_user_email, p_amount, v_new_balance, p_transaction_type, p_description, p_stripe_payment_intent_id);

  RETURN v_new_balance;
END;
$func$;


-- -----------------------------------------------------------------------------
-- get_user_credits: Returns caller's current balance
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_user_credits()
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user_email TEXT;
  v_balance INTEGER;
BEGIN
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';
  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  SELECT balance INTO v_balance FROM user_credits WHERE user_email = v_user_email;
  RETURN COALESCE(v_balance, 0);
END;
$func$;

GRANT EXECUTE ON FUNCTION get_user_credits() TO authenticated;
GRANT EXECUTE ON FUNCTION add_credits(TEXT, INTEGER, TEXT, TEXT, TEXT) TO authenticated;


-- -----------------------------------------------------------------------------
-- deduct_credit: Atomically deducts 1 credit, raises exception if insufficient
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION deduct_credit(p_description TEXT DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user_email TEXT;
  v_current_balance INTEGER;
  v_new_balance INTEGER;
BEGIN
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';
  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  -- Lock the row to prevent double-spend
  SELECT balance INTO v_current_balance
  FROM user_credits
  WHERE user_email = v_user_email
  FOR UPDATE;

  IF v_current_balance IS NULL OR v_current_balance < 1 THEN
    RAISE EXCEPTION 'insufficient-credits';
  END IF;

  -- Deduct 1 credit
  UPDATE user_credits
  SET balance = balance - 1, updated_at = now()
  WHERE user_email = v_user_email
  RETURNING balance INTO v_new_balance;

  -- Record transaction
  INSERT INTO credit_transactions (user_email, amount, balance_after, transaction_type, description)
  VALUES (v_user_email, -1, v_new_balance, 'ai_generation', p_description);

  RETURN v_new_balance;
END;
$func$;

GRANT EXECUTE ON FUNCTION deduct_credit(TEXT) TO authenticated;


-- -----------------------------------------------------------------------------
-- get_credit_history: Returns caller's transaction history
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_credit_history(
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  amount INTEGER,
  balance_after INTEGER,
  transaction_type TEXT,
  description TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user_email TEXT;
BEGIN
  v_user_email := current_setting('request.jwt.claims', true)::jsonb->>'email';
  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'not-authenticated';
  END IF;

  RETURN QUERY
  SELECT ct.id, ct.amount, ct.balance_after, ct.transaction_type, ct.description, ct.created_at
  FROM credit_transactions ct
  WHERE ct.user_email = v_user_email
  ORDER BY ct.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$func$;

GRANT EXECUTE ON FUNCTION get_credit_history(INTEGER, INTEGER) TO authenticated;


-- =============================================================================
-- SECTION 4: MODIFY SIGNUP FUNCTIONS
-- =============================================================================

-- Recreate signup() with credit bonus
CREATE OR REPLACE FUNCTION signup (p_name text, p_email text, p_password text default null, p_provider text default null)
    RETURNS users
    AS $func$
DECLARE
    _user_id uuid;
    _result users;
BEGIN
    IF p_name IS NULL OR length(p_name) < 1 OR length(p_name) > 255 THEN
        RAISE EXCEPTION 'invalid-name';
    END IF;

    IF p_provider IS NULL THEN
        IF p_password IS NULL OR
           LENGTH(p_password) < 8 OR
           LENGTH(p_password) > 72 OR
           NOT (p_password ~ '[A-Z]') OR
           NOT (p_password ~ '[a-z]') OR
           NOT (p_password ~ '\d') THEN
            RAISE EXCEPTION 'password-not-meet-requirements';
        END IF;
    END IF;

    SELECT u.id INTO _user_id FROM users u WHERE u.email = p_email;

    IF _user_id IS NOT NULL THEN
        RAISE EXCEPTION 'signup-failed';
    ELSE
        INSERT INTO users (name, email, provider, owner) VALUES (p_name, p_email, p_provider, p_email)
        RETURNING id INTO _user_id;

        IF p_provider IS NULL THEN
            INSERT INTO user_passwords (email, password, owner) VALUES (p_email, p_password, p_email);
        END IF;

        -- Grant 10 free AI generation credits
        PERFORM add_credits(p_email, 3, 'signup_bonus', 'Välkomstbonus: 10 gratis AI-genereringar');
    END IF;

    SELECT * INTO _result FROM users WHERE id = _user_id;
    RETURN _result;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- Recreate signup_provider() with credit bonus for new users
CREATE OR REPLACE FUNCTION signup_provider(p_name TEXT, p_email TEXT, p_provider TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  _user_id UUID;
  _existing_provider TEXT;
  _json_result JSONB;
BEGIN
  SELECT u.id, u.provider INTO _user_id, _existing_provider
  FROM users u
  WHERE u.email = p_email;

  IF _user_id IS NOT NULL THEN
    -- Existing user: verify provider matches
    IF _existing_provider IS DISTINCT FROM p_provider THEN
      RAISE EXCEPTION 'provider-mismatch'
        USING HINT = 'An account with this email exists but was registered with a different provider';
    END IF;

    SELECT jsonb_build_object(
      'id', u.id,
      'name', u.name,
      'email', u.email,
      'provider', u.provider,
      'owner', u.owner,
      'role', u.role,
      'measures_system', u.measures_system
    ) INTO _json_result
    FROM users u
    WHERE u.id = _user_id;
  ELSE
    -- New user
    INSERT INTO users (name, email, provider, owner)
    VALUES (p_name, p_email, p_provider, p_email)
    RETURNING id INTO _user_id;

    -- Grant 10 free AI generation credits
    PERFORM add_credits(p_email, 10, 'signup_bonus', 'Välkomstbonus: 10 gratis AI-genereringar');

    SELECT jsonb_build_object(
      'id', u.id,
      'name', u.name,
      'email', u.email,
      'provider', u.provider,
      'owner', u.owner,
      'role', u.role,
      'measures_system', u.measures_system
    ) INTO _json_result
    FROM users u
    WHERE u.id = _user_id;
  END IF;

  RETURN _json_result;
END;
$func$;


-- =============================================================================
-- SECTION 5: BACKFILL EXISTING USERS
-- =============================================================================

-- Grant 10 credits to all existing users who don't have a user_credits row yet
INSERT INTO user_credits (user_email, balance)
SELECT email, 10
FROM users
WHERE email NOT IN (SELECT user_email FROM user_credits);

INSERT INTO credit_transactions (user_email, amount, balance_after, transaction_type, description)
SELECT email, 10, 10, 'signup_bonus', 'Välkomstbonus: 10 gratis AI-genereringar (backfill)'
FROM users
WHERE email NOT IN (
  SELECT user_email FROM credit_transactions WHERE transaction_type = 'signup_bonus'
);
