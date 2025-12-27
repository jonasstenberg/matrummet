-- Grant permissions on user-related tables to authenticated role.
-- The authenticated role inherits from anon which has these permissions,
-- but explicit grants ensure proper access for profile updates.

-- Users table: needed for profile updates (name changes)
GRANT SELECT, UPDATE ON users TO "authenticated";

-- User passwords table: for completeness (though password changes use RPC)
GRANT SELECT, UPDATE ON user_passwords TO "authenticated";

COMMENT ON TABLE users IS
  'User accounts. Authenticated users can update their own profile via RLS policy.';
