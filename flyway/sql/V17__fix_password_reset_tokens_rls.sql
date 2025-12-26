-- V17: Fix password reset tokens RLS policies
-- The recept role needs full access to password_reset_tokens for SECURITY DEFINER functions

-- Allow recept to insert, update, and select password_reset_tokens
CREATE POLICY password_reset_tokens_policy_service
    ON password_reset_tokens
    FOR ALL
    TO recept
    USING (true)
    WITH CHECK (true);

COMMENT ON POLICY password_reset_tokens_policy_service ON password_reset_tokens IS
    'Allows the recept role (used by SECURITY DEFINER functions) full access for password reset operations.';

-- Also need access to email_messages for queueing emails
CREATE POLICY email_messages_policy_service
    ON email_messages
    FOR ALL
    TO recept
    USING (true)
    WITH CHECK (true);

COMMENT ON POLICY email_messages_policy_service ON email_messages IS
    'Allows the recept role (used by SECURITY DEFINER functions) to queue emails for password reset.';
