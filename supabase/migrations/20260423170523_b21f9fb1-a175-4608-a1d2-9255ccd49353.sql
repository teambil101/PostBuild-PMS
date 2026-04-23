-- Auth is temporarily bypassed in the app (ProtectedRoute is a passthrough,
-- AuthContext.canEdit = true). RLS policies restricted to the `authenticated`
-- role therefore reject inserts/updates from the anon session.
-- Loosen all app-table policies to `public` to match the bypass.
-- Restore to `TO authenticated` once auth is re-enabled.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND 'authenticated' = ANY(roles)
      AND array_length(roles, 1) = 1
  LOOP
    EXECUTE format(
      'ALTER POLICY %I ON %I.%I TO public',
      r.policyname, r.schemaname, r.tablename
    );
  END LOOP;
END $$;