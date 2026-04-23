-- Temporarily disable Row Level Security across all public tables so the build can proceed without authentication.
-- Authentication will be re-introduced at the end; policies should be reapplied at that point.

DO $$
DECLARE
  r record;
  pol record;
BEGIN
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    -- Drop every existing policy on the table
    FOR pol IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = r.tablename
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', pol.policyname, r.tablename);
    END LOOP;

    -- Disable RLS on the table
    EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY;', r.tablename);
  END LOOP;
END $$;

-- Make created_by / uploaded_by / actor_id / changed_by columns nullable so inserts succeed
-- without an authenticated user. (Most are already nullable; this is defensive.)
ALTER TABLE public.buildings ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.units ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.people ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.contracts ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.leads ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.vendors ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.tickets ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.service_schedules ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.property_owners ALTER COLUMN created_by DROP NOT NULL;