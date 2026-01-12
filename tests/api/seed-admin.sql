-- Test seed: Ensure test admin user exists with admin role
-- Run this before tests: psql -d recept -f tests/api/seed-admin.sql

-- Create test admin user if not exists, or update role if exists
-- Note: owner must be set to the user's own email (self-owned)
INSERT INTO users (name, email, role, provider, owner)
VALUES ('Test Admin', 'test-admin@example.com', 'admin', NULL, 'test-admin@example.com')
ON CONFLICT (email) DO UPDATE
  SET role = 'admin',
      name = 'Test Admin';

-- Ensure password exists (the signup RPC handles this normally, but we need to bootstrap)
-- user_passwords uses email as PK and 'password' column (hashed by trigger)
INSERT INTO user_passwords (email, password, owner)
VALUES ('test-admin@example.com', 'AdminPassword789!', 'test-admin@example.com')
ON CONFLICT (email) DO UPDATE
  SET password = 'AdminPassword789!';
