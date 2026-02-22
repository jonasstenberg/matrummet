-- Grant SELECT on tables that were missed when backupuser was created
-- Wrapped in DO block so it's a no-op in environments without backupuser (CI)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'backupuser') THEN
    EXECUTE 'GRANT SELECT ON ai_review_runs, ai_review_suggestions TO backupuser';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO backupuser';
  END IF;
END
$$;
