-- V15: Email Service Infrastructure & Password Reset
-- Adds email templates, queuing, user preferences, and password reset flow
-- Adapted for public schema with owner-based RLS

-- =============================================================================
-- TABLES
-- =============================================================================

-- 1. email_templates - Stores email templates (admin-managed)
CREATE TABLE IF NOT EXISTS email_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL CHECK (LENGTH(name) >= 1),
    subject TEXT NOT NULL CHECK (LENGTH(subject) >= 1),
    html_body TEXT NOT NULL,
    text_body TEXT,
    variables JSONB NOT NULL DEFAULT '{}'::jsonb,
    description TEXT,
    language TEXT NOT NULL DEFAULT 'sv',
    date_published TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    date_modified TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    owner TEXT NOT NULL DEFAULT current_setting('request.jwt.claims', true)::jsonb->>'email',
    UNIQUE (name, language)
);

CREATE INDEX email_templates_owner_idx ON email_templates (owner);
CREATE INDEX email_templates_name_language_idx ON email_templates (name, language);

GRANT SELECT, INSERT, UPDATE, DELETE ON email_templates TO "anon";

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates FORCE ROW LEVEL SECURITY;

-- Templates are readable by all, but only admins can modify
CREATE POLICY email_templates_policy_select
    ON email_templates
    FOR SELECT
    USING (true);

CREATE POLICY email_templates_policy_insert
    ON email_templates
    FOR INSERT
    WITH CHECK (is_admin());

CREATE POLICY email_templates_policy_update
    ON email_templates
    FOR UPDATE
    USING (is_admin());

CREATE POLICY email_templates_policy_delete
    ON email_templates
    FOR DELETE
    USING (is_admin());

DROP TRIGGER IF EXISTS set_timestamptz ON email_templates;
CREATE TRIGGER set_timestamptz
    BEFORE UPDATE ON email_templates
    FOR EACH ROW
    EXECUTE FUNCTION set_timestamptz();

-- 2. email_messages - Queue for individual emails
CREATE TABLE IF NOT EXISTS email_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_email TEXT NOT NULL,
    recipient_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    template_id UUID NOT NULL REFERENCES email_templates(id) ON DELETE CASCADE,
    variables JSONB NOT NULL DEFAULT '{}'::jsonb,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'sent', 'failed')),
    error_message TEXT,
    sent_at TIMESTAMPTZ,
    retry_count INT DEFAULT 0 CHECK (retry_count >= 0),
    next_retry_at TIMESTAMPTZ,
    date_published TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    owner TEXT NOT NULL DEFAULT current_setting('request.jwt.claims', true)::jsonb->>'email'
);

CREATE INDEX email_messages_status_idx ON email_messages (status);
CREATE INDEX email_messages_status_next_retry_idx ON email_messages (status, next_retry_at);
CREATE INDEX email_messages_template_id_idx ON email_messages (template_id);
CREATE INDEX email_messages_recipient_email_idx ON email_messages (recipient_email);
CREATE INDEX email_messages_owner_idx ON email_messages (owner);

GRANT SELECT, INSERT, UPDATE, DELETE ON email_messages TO "anon";

ALTER TABLE email_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_messages FORCE ROW LEVEL SECURITY;

-- Users can see their own messages, admins can see all
CREATE POLICY email_messages_policy_select
    ON email_messages
    FOR SELECT
    USING (
        recipient_email = current_setting('request.jwt.claims', true)::jsonb->>'email'
        OR is_admin()
    );

-- Only admins can insert/update/delete messages directly
CREATE POLICY email_messages_policy_insert
    ON email_messages
    FOR INSERT
    WITH CHECK (is_admin());

CREATE POLICY email_messages_policy_update
    ON email_messages
    FOR UPDATE
    USING (is_admin());

CREATE POLICY email_messages_policy_delete
    ON email_messages
    FOR DELETE
    USING (is_admin());

-- 3. user_email_preferences - User notification preferences
CREATE TABLE IF NOT EXISTS user_email_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
    receive_recipe_notifications BOOLEAN NOT NULL DEFAULT true,
    receive_system_emails BOOLEAN NOT NULL DEFAULT true,
    unsubscribe_token UUID DEFAULT gen_random_uuid() NOT NULL UNIQUE,
    date_published TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    date_modified TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    owner TEXT NOT NULL DEFAULT current_setting('request.jwt.claims', true)::jsonb->>'email',
    UNIQUE(user_email)
);

CREATE INDEX user_email_preferences_user_email_idx ON user_email_preferences (user_email);
CREATE INDEX user_email_preferences_token_idx ON user_email_preferences (unsubscribe_token);
CREATE INDEX user_email_preferences_owner_idx ON user_email_preferences (owner);

GRANT SELECT, INSERT, UPDATE, DELETE ON user_email_preferences TO "anon";

ALTER TABLE user_email_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_email_preferences FORCE ROW LEVEL SECURITY;

-- Users can only manage their own preferences
CREATE POLICY user_email_preferences_policy_select
    ON user_email_preferences
    FOR SELECT
    USING (owner = current_setting('request.jwt.claims', true)::jsonb->>'email');

CREATE POLICY user_email_preferences_policy_insert
    ON user_email_preferences
    FOR INSERT
    WITH CHECK (owner = current_setting('request.jwt.claims', true)::jsonb->>'email');

CREATE POLICY user_email_preferences_policy_update
    ON user_email_preferences
    FOR UPDATE
    USING (owner = current_setting('request.jwt.claims', true)::jsonb->>'email');

CREATE POLICY user_email_preferences_policy_delete
    ON user_email_preferences
    FOR DELETE
    USING (owner = current_setting('request.jwt.claims', true)::jsonb->>'email');

DROP TRIGGER IF EXISTS set_timestamptz ON user_email_preferences;
CREATE TRIGGER set_timestamptz
    BEFORE UPDATE ON user_email_preferences
    FOR EACH ROW
    EXECUTE FUNCTION set_timestamptz();

-- 4. password_reset_tokens - Token-based password reset
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    date_published TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX password_reset_tokens_token_hash_idx ON password_reset_tokens (token_hash);
CREATE INDEX password_reset_tokens_user_email_idx ON password_reset_tokens (user_email);
CREATE INDEX password_reset_tokens_expires_at_idx ON password_reset_tokens (expires_at);
CREATE INDEX password_reset_tokens_user_email_date_published_idx ON password_reset_tokens (user_email, date_published DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON password_reset_tokens TO "anon";

ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_tokens FORCE ROW LEVEL SECURITY;

-- No direct access to tokens via RLS - only through functions
CREATE POLICY password_reset_tokens_policy_select
    ON password_reset_tokens
    FOR SELECT
    USING (false);

CREATE POLICY password_reset_tokens_policy_insert
    ON password_reset_tokens
    FOR INSERT
    WITH CHECK (false);

CREATE POLICY password_reset_tokens_policy_update
    ON password_reset_tokens
    FOR UPDATE
    USING (false);

CREATE POLICY password_reset_tokens_policy_delete
    ON password_reset_tokens
    FOR DELETE
    USING (false);

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Get email template by name and language
CREATE OR REPLACE FUNCTION get_email_template(
    p_template_name TEXT,
    p_language TEXT DEFAULT 'sv'
)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_template_id UUID;
BEGIN
    SELECT id INTO v_template_id
    FROM email_templates
    WHERE name = p_template_name
      AND language = p_language
    LIMIT 1;

    IF v_template_id IS NULL THEN
        -- Fall back to Swedish if requested language not found
        SELECT id INTO v_template_id
        FROM email_templates
        WHERE name = p_template_name
          AND language = 'sv'
        LIMIT 1;
    END IF;

    IF v_template_id IS NULL THEN
        RAISE EXCEPTION 'email-template-not-found';
    END IF;

    RETURN v_template_id;
END;
$$;

GRANT EXECUTE ON FUNCTION get_email_template(TEXT, TEXT) TO "anon";

-- Queue an email for sending (with fixed owner for unauthenticated contexts)
CREATE OR REPLACE FUNCTION queue_email(
    p_template_name TEXT,
    p_recipient_email TEXT,
    p_variables JSONB DEFAULT '{}'::jsonb,
    p_metadata JSONB DEFAULT '{}'::jsonb,
    p_language TEXT DEFAULT 'sv'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_template_id UUID;
    v_email_id UUID;
    v_user_id UUID;
BEGIN
    -- Get the template
    v_template_id := get_email_template(p_template_name, p_language);

    -- Try to find the user by email
    SELECT id INTO v_user_id
    FROM users
    WHERE email = p_recipient_email;

    -- Queue the email with explicit owner (use recipient email or system for unauthenticated contexts)
    INSERT INTO email_messages (
        template_id,
        recipient_email,
        recipient_user_id,
        variables,
        metadata,
        owner
    ) VALUES (
        v_template_id,
        p_recipient_email,
        v_user_id,
        p_variables,
        p_metadata || jsonb_build_object('language', p_language),
        COALESCE(
            NULLIF(current_setting('request.jwt.claims', true)::jsonb->>'email', ''),
            'system@recept.local'
        )
    )
    RETURNING id INTO v_email_id;

    RETURN v_email_id;
END;
$$;

GRANT EXECUTE ON FUNCTION queue_email(TEXT, TEXT, JSONB, JSONB, TEXT) TO "anon";

-- Unsubscribe from emails using token
CREATE OR REPLACE FUNCTION unsubscribe_from_emails(
    p_token UUID,
    p_unsubscribe_type TEXT DEFAULT 'all'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_success BOOLEAN := false;
BEGIN
    IF p_unsubscribe_type = 'all' THEN
        UPDATE user_email_preferences
        SET
            receive_recipe_notifications = false,
            receive_system_emails = false,
            date_modified = now()
        WHERE unsubscribe_token = p_token
        RETURNING true INTO v_success;

    ELSIF p_unsubscribe_type = 'recipes' THEN
        UPDATE user_email_preferences
        SET
            receive_recipe_notifications = false,
            date_modified = now()
        WHERE unsubscribe_token = p_token
        RETURNING true INTO v_success;

    ELSIF p_unsubscribe_type = 'system' THEN
        UPDATE user_email_preferences
        SET
            receive_system_emails = false,
            date_modified = now()
        WHERE unsubscribe_token = p_token
        RETURNING true INTO v_success;

    ELSE
        RAISE EXCEPTION 'invalid-unsubscribe-type';
    END IF;

    RETURN COALESCE(v_success, false);
END;
$$;

GRANT EXECUTE ON FUNCTION unsubscribe_from_emails(UUID, TEXT) TO "anon";

-- Request a password reset
-- Rate limited to 1 request per email per 5 minutes
-- Always returns success to avoid revealing if email exists
-- Supports both password and OAuth-only users (OAuth users can add password login)
CREATE OR REPLACE FUNCTION request_password_reset(p_email TEXT, p_app_url TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_exists BOOLEAN;
    v_user_name TEXT;
    v_last_request_at TIMESTAMPTZ;
    v_token TEXT;
    v_token_hash TEXT;
    v_reset_link TEXT;
    v_base_url TEXT;
    v_rate_limit_interval INTERVAL := INTERVAL '5 minutes';
BEGIN
    -- Check if user exists (including OAuth-only users without passwords)
    -- This allows OAuth users to add password login to their account
    SELECT EXISTS(
        SELECT 1 FROM users
        WHERE email = p_email
    ) INTO v_user_exists;

    -- If user exists, check rate limit and potentially generate token
    IF v_user_exists THEN
        -- Check when the last token was created for this email
        SELECT date_published INTO v_last_request_at
        FROM password_reset_tokens
        WHERE user_email = p_email
        ORDER BY date_published DESC
        LIMIT 1;

        -- Rate limit check: if last request was within 5 minutes, silently return success
        -- This prevents email enumeration while still rate limiting actual requests
        IF v_last_request_at IS NOT NULL AND v_last_request_at > now() - v_rate_limit_interval THEN
            -- Return success without creating token or sending email
            RETURN jsonb_build_object('success', true);
        END IF;

        -- Get user name for email
        SELECT name INTO v_user_name FROM users WHERE email = p_email;

        -- Generate a random token
        v_token := gen_random_uuid()::TEXT;

        -- Store the SHA256 hash of the token
        v_token_hash := encode(sha256(v_token::bytea), 'hex');

        -- Invalidate any existing unused tokens for this user
        UPDATE password_reset_tokens
        SET used_at = now()
        WHERE user_email = p_email
          AND used_at IS NULL;

        -- Insert the new token (expires in 24 hours)
        INSERT INTO password_reset_tokens (user_email, token_hash, expires_at)
        VALUES (p_email, v_token_hash, now() + INTERVAL '24 hours');

        -- Build reset link using provided URL or fallback
        v_base_url := COALESCE(
            p_app_url,
            current_setting('app.base_url', true),
            'https://recept.app'
        );
        v_reset_link := v_base_url || '/reset-password/' || v_token;

        -- Queue the password reset email
        PERFORM queue_email(
            'password_reset',
            p_email,
            jsonb_build_object(
                'user_name', COALESCE(v_user_name, 'Anvandare'),
                'reset_link', v_reset_link
            )
        );
    END IF;

    -- Always return success to avoid revealing if email exists
    RETURN jsonb_build_object('success', true);
END;
$$;

COMMENT ON FUNCTION request_password_reset(TEXT, TEXT) IS
    'Requests a password reset email. Rate limited to 1 request per email per 5 minutes. '
    'Supports OAuth-only users adding password login. Always returns success to prevent email enumeration.';

GRANT EXECUTE ON FUNCTION request_password_reset(TEXT, TEXT) TO "anon";

-- Complete a password reset
CREATE OR REPLACE FUNCTION complete_password_reset(p_token TEXT, p_new_password TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_token_hash TEXT;
    v_user_email TEXT;
    v_token_id UUID;
BEGIN
    -- Validate password requirements
    IF p_new_password IS NULL OR
       LENGTH(p_new_password) < 8 OR
       NOT (p_new_password ~* '.*[A-Z].*') OR
       NOT (p_new_password ~* '.*[a-z].*') OR
       NOT (p_new_password ~ '\d') THEN
        RAISE EXCEPTION 'password-not-meet-requirements';
    END IF;

    -- Hash the provided token
    v_token_hash := encode(sha256(p_token::bytea), 'hex');

    -- Find the token, verify not expired and not used
    -- Use FOR UPDATE SKIP LOCKED to prevent race conditions when multiple
    -- requests try to use the same token simultaneously
    SELECT id, user_email
    INTO v_token_id, v_user_email
    FROM password_reset_tokens
    WHERE token_hash = v_token_hash
      AND expires_at > now()
      AND used_at IS NULL
    FOR UPDATE SKIP LOCKED;

    IF v_token_id IS NULL THEN
        RAISE EXCEPTION 'invalid-or-expired-token';
    END IF;

    -- Update the user's password (trigger will hash it)
    UPDATE user_passwords
    SET password = p_new_password
    WHERE email = v_user_email;

    -- If no password record exists (e.g., OAuth user), create one
    IF NOT FOUND THEN
        INSERT INTO user_passwords (email, password, owner)
        VALUES (v_user_email, p_new_password, v_user_email);
    END IF;

    -- Mark token as used
    UPDATE password_reset_tokens
    SET used_at = now()
    WHERE id = v_token_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION complete_password_reset(TEXT, TEXT) TO "anon";

-- Validate password reset token without consuming it
-- This allows pre-validation on page load before the user enters their new password
CREATE OR REPLACE FUNCTION validate_password_reset_token(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_token_hash TEXT;
    v_token_exists BOOLEAN;
BEGIN
    -- Hash the provided token
    v_token_hash := encode(sha256(p_token::bytea), 'hex');

    -- Check if token exists, is not expired, and has not been used
    SELECT EXISTS(
        SELECT 1
        FROM password_reset_tokens
        WHERE token_hash = v_token_hash
          AND expires_at > now()
          AND used_at IS NULL
    ) INTO v_token_exists;

    IF v_token_exists THEN
        RETURN jsonb_build_object('valid', true);
    ELSE
        RETURN jsonb_build_object('valid', false, 'error', 'invalid-or-expired-token');
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION validate_password_reset_token(TEXT) TO "anon";

-- Clean up expired password reset tokens (can be called by a cron job)
CREATE OR REPLACE FUNCTION cleanup_expired_password_reset_tokens()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM password_reset_tokens
    WHERE expires_at < now() - INTERVAL '7 days'
       OR (used_at IS NOT NULL AND used_at < now() - INTERVAL '7 days');

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    RETURN v_deleted_count;
END;
$$;

-- Note: cleanup_expired_password_reset_tokens is intentionally NOT granted to anon.
-- It should only be called by scheduled jobs or admin processes.

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Notify when email is queued (for external email service to pick up)
CREATE OR REPLACE FUNCTION notify_email_queued()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_payload TEXT;
BEGIN
    v_payload := json_build_object(
        'id', NEW.id,
        'operation', lower(TG_OP),
        'table', TG_TABLE_NAME
    )::text;

    PERFORM pg_notify('email_message_channel', v_payload);

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_email_queued ON email_messages;
CREATE TRIGGER trg_notify_email_queued
    AFTER INSERT ON email_messages
    FOR EACH ROW
    EXECUTE FUNCTION notify_email_queued();

-- Create email preferences when user signs up
CREATE OR REPLACE FUNCTION ensure_email_preferences()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only create preferences for password-based signups (not OAuth)
    IF NEW.provider IS NULL THEN
        INSERT INTO user_email_preferences (
            user_email,
            receive_recipe_notifications,
            receive_system_emails,
            owner
        ) VALUES (
            NEW.email,
            true,
            true,
            NEW.email
        )
        ON CONFLICT (user_email) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_email_preferences_trigger ON users;
CREATE TRIGGER ensure_email_preferences_trigger
    AFTER INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION ensure_email_preferences();

-- =============================================================================
-- VIEWS
-- =============================================================================

-- View for email service to fetch pending emails
CREATE OR REPLACE VIEW email_queue_view AS
SELECT
    em.id,
    em.recipient_email,
    em.recipient_user_id,
    et.name AS template_name,
    et.subject AS template_subject,
    et.html_body AS template_html_body,
    et.text_body AS template_text_body,
    em.variables,
    em.metadata,
    em.status,
    em.retry_count,
    em.next_retry_at,
    em.date_published AS queued_at
FROM email_messages em
JOIN email_templates et ON em.template_id = et.id
WHERE em.status = 'queued';

-- Note: email_queue_view is NOT granted to anon.
-- Only the email_service role should access this view (granted below).

-- =============================================================================
-- SERVICE ROLE
-- =============================================================================

-- Create email_service role if it doesn't exist (with LOGIN for direct DB connections)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'email_service') THEN
        CREATE ROLE email_service WITH LOGIN;
    END IF;
END
$$;

-- Grant necessary permissions to email_service role
GRANT USAGE ON SCHEMA public TO email_service;
GRANT SELECT, INSERT, UPDATE, DELETE ON email_messages TO email_service;
GRANT SELECT ON email_templates TO email_service;
GRANT SELECT ON user_email_preferences TO email_service;
GRANT SELECT ON users TO email_service;
GRANT SELECT ON email_queue_view TO email_service;

-- Note: GRANT email_service TO recept must be done by superuser if not already granted
-- This is typically done during initial database setup
DO $$
BEGIN
    -- Try to grant, ignore if we don't have permission (already granted by superuser)
    EXECUTE 'GRANT email_service TO recept';
EXCEPTION
    WHEN insufficient_privilege THEN
        RAISE NOTICE 'email_service already granted to recept or requires superuser';
END
$$;

-- RLS bypass policies for email_service
CREATE POLICY email_messages_policy_email_service
    ON email_messages
    FOR ALL
    TO email_service
    USING (true)
    WITH CHECK (true);

CREATE POLICY email_templates_policy_email_service
    ON email_templates
    FOR SELECT
    TO email_service
    USING (true);

CREATE POLICY user_email_preferences_policy_email_service
    ON user_email_preferences
    FOR SELECT
    TO email_service
    USING (true);

-- =============================================================================
-- SEED DEFAULT TEMPLATES
-- =============================================================================

-- Temporarily disable RLS to allow seeding (re-enabled after inserts)
ALTER TABLE email_templates DISABLE ROW LEVEL SECURITY;

-- Password reset email template
INSERT INTO email_templates (name, subject, html_body, text_body, variables, description, language, owner)
VALUES (
    'password_reset',
    'Återställ ditt lösenord',
    '<html><body><h1>Återställ ditt lösenord</h1><p>Hej {{user_name}},</p><p>Klicka på länken nedan för att återställa ditt lösenord:</p><p><a href="{{reset_link}}">Återställ lösenord</a></p><p>Länken är giltig i 24 timmar.</p></body></html>',
    'Hej {{user_name}},\n\nKlicka på länken nedan för att återställa ditt lösenord:\n{{reset_link}}\n\nLänken är giltig i 24 timmar.',
    '{"user_name": "string", "reset_link": "string"}'::jsonb,
    'Email sent when user requests password reset',
    'sv',
    'system@recept.local'
)
ON CONFLICT (name, language) DO NOTHING;

-- Welcome email template
INSERT INTO email_templates (name, subject, html_body, text_body, variables, description, language, owner)
VALUES (
    'welcome',
    'Välkommen till Recept!',
    '<html><body><h1>Välkommen till Recept!</h1><p>Hej {{user_name}},</p><p>Tack för att du skapade ett konto. Nu kan du börja spara och organisera dina favoritrecept!</p></body></html>',
    'Hej {{user_name}},\n\nTack för att du skapade ett konto. Nu kan du börja spara och organisera dina favoritrecept!',
    '{"user_name": "string"}'::jsonb,
    'Welcome email sent to new users',
    'sv',
    'system@recept.local'
)
ON CONFLICT (name, language) DO NOTHING;

-- Re-enable RLS after seeding
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
