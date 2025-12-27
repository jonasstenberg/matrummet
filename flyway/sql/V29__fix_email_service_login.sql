-- V29: Fix email_service role LOGIN
--
-- V27 incorrectly set email_service to NOLOGIN, but the email service
-- application connects directly to the database and requires LOGIN.

DO $$
BEGIN
    ALTER ROLE email_service LOGIN;
    RAISE NOTICE 'Successfully restored email_service LOGIN privilege';
EXCEPTION
    WHEN insufficient_privilege THEN
        RAISE WARNING 'Could not ALTER ROLE email_service LOGIN - requires superuser. Run manually: ALTER ROLE email_service LOGIN;';
END;
$$;
