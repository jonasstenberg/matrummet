-- Grant SELECT on tables that were missed when backupuser was created
GRANT SELECT ON ai_review_runs, ai_review_suggestions TO backupuser;

-- Ensure backupuser automatically gets SELECT on any future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO backupuser;
