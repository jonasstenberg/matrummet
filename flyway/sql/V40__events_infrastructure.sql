-- =============================================================================
-- V40: Events infrastructure
-- Generic event system using LISTEN/NOTIFY for webhook dispatch
-- =============================================================================

-- ---------------------------------------------------------------------------
-- A) events_service role (matches email_service pattern from V1)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'events_service') THEN
        CREATE ROLE events_service WITH LOGIN;
    END IF;
END
$$;

GRANT events_service TO matrummet;
GRANT USAGE ON SCHEMA public TO events_service;

-- ---------------------------------------------------------------------------
-- B) events table
-- ---------------------------------------------------------------------------
CREATE TABLE public.events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type      text NOT NULL,
    payload         jsonb NOT NULL DEFAULT '{}',
    status          text NOT NULL DEFAULT 'pending',
    error_message   text,
    retry_count     integer NOT NULL DEFAULT 0,
    next_retry_at   timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    processed_at    timestamptz,
    CONSTRAINT events_status_check CHECK (status IN ('pending', 'processing', 'dispatched', 'failed')),
    CONSTRAINT events_retry_count_check CHECK (retry_count >= 0)
);

CREATE INDEX idx_events_status ON public.events (status);
CREATE INDEX idx_events_status_retry ON public.events (status, next_retry_at);
CREATE INDEX idx_events_event_type ON public.events (event_type);
CREATE INDEX idx_events_created_at ON public.events (created_at);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Only events_service role can access events
CREATE POLICY events_policy_events_service ON public.events
    TO events_service USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- C) Notification trigger on events table
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_event_created()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
    v_payload text;
BEGIN
    v_payload := json_build_object(
        'id', NEW.id,
        'operation', lower(TG_OP),
        'table', TG_TABLE_NAME
    )::text;

    PERFORM pg_notify('events_channel', v_payload);

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_event_created
    AFTER INSERT ON public.events
    FOR EACH ROW EXECUTE FUNCTION public.notify_event_created();

-- ---------------------------------------------------------------------------
-- D) User signup trigger on users table
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.emit_user_signup_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    INSERT INTO events (event_type, payload)
    VALUES (
        'user.signup',
        json_build_object(
            'user_id', NEW.id,
            'email', NEW.email,
            'name', NEW.name,
            'provider', NEW.provider
        )::jsonb
    );
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_emit_user_signup_event
    AFTER INSERT ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.emit_user_signup_event();

-- ---------------------------------------------------------------------------
-- E) User deletion trigger on users table (BEFORE DELETE to capture OLD data)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.emit_user_deleted_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    INSERT INTO events (event_type, payload)
    VALUES (
        'user.deleted',
        json_build_object(
            'user_id', OLD.id,
            'email', OLD.email,
            'name', OLD.name,
            'provider', OLD.provider
        )::jsonb
    );
    RETURN OLD;
END;
$$;

CREATE TRIGGER trg_emit_user_deleted_event
    BEFORE DELETE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.emit_user_deleted_event();

-- ---------------------------------------------------------------------------
-- F) Credit purchase trigger on credit_transactions table
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.emit_credit_purchase_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    IF NEW.transaction_type = 'purchase' THEN
        INSERT INTO events (event_type, payload)
        VALUES (
            'credits.purchased',
            json_build_object(
                'user_email', NEW.user_email,
                'amount', NEW.amount,
                'balance_after', NEW.balance_after,
                'description', NEW.description,
                'stripe_payment_intent_id', NEW.stripe_payment_intent_id
            )::jsonb
        );
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_emit_credit_purchase_event
    AFTER INSERT ON public.credit_transactions
    FOR EACH ROW EXECUTE FUNCTION public.emit_credit_purchase_event();

-- ---------------------------------------------------------------------------
-- G) Grants: events_service can read and update events (no INSERT)
-- ---------------------------------------------------------------------------
GRANT SELECT, UPDATE ON TABLE public.events TO events_service;
