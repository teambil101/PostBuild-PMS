
-- =====================================================================
-- PHASE 1: TENANCY FOUNDATION
-- Adds workspaces concept without changing existing behaviour.
-- =====================================================================

-- 1. ENUMS -----------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE public.workspace_kind AS ENUM ('internal', 'owner', 'broker');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.workspace_plan AS ENUM ('free', 'portfolio', 'broker_pro', 'enterprise');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.workspace_member_role AS ENUM ('owner', 'admin', 'manager', 'agent', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. CORE TABLES -----------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.workspaces (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  slug            text NOT NULL UNIQUE,
  kind            public.workspace_kind NOT NULL DEFAULT 'owner',
  plan            public.workspace_plan NOT NULL DEFAULT 'free',
  brand_color     text,
  logo_url        text,
  is_active       boolean NOT NULL DEFAULT true,
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workspace_members (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            public.workspace_member_role NOT NULL DEFAULT 'viewer',
  invited_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  joined_at       timestamptz NOT NULL DEFAULT now(),
  last_active_at  timestamptz,
  UNIQUE (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON public.workspace_members(workspace_id);

CREATE TABLE IF NOT EXISTS public.workspace_invitations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email           text NOT NULL,
  role            public.workspace_member_role NOT NULL DEFAULT 'viewer',
  token           text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  invited_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at      timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at     timestamptz,
  accepted_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workspace_invitations_workspace ON public.workspace_invitations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_email ON public.workspace_invitations(lower(email));

-- updated_at trigger for workspaces
CREATE TRIGGER trg_workspaces_updated_at
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. HELPER FUNCTIONS ------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_user_workspace_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT workspace_id
  FROM public.workspace_members
  WHERE user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_member(_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = _workspace_id
      AND user_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION public.has_workspace_role(_workspace_id uuid, _roles public.workspace_member_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = _workspace_id
      AND user_id = auth.uid()
      AND role = ANY(_roles)
  )
$$;

-- 4. RLS ON NEW TABLES -----------------------------------------------------

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_invitations ENABLE ROW LEVEL SECURITY;

-- workspaces: members can see; owners/admins can update; anyone authenticated can create (then becomes owner via app code)
CREATE POLICY "Members can view their workspaces"
  ON public.workspaces FOR SELECT
  TO authenticated
  USING (public.is_workspace_member(id));

CREATE POLICY "Authenticated can create workspaces"
  ON public.workspaces FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Owners and admins can update workspace"
  ON public.workspaces FOR UPDATE
  TO authenticated
  USING (public.has_workspace_role(id, ARRAY['owner','admin']::public.workspace_member_role[]));

CREATE POLICY "Owners can delete workspace"
  ON public.workspaces FOR DELETE
  TO authenticated
  USING (public.has_workspace_role(id, ARRAY['owner']::public.workspace_member_role[]));

-- workspace_members: visible to fellow members; manageable by owners/admins
CREATE POLICY "Members can view co-members"
  ON public.workspace_members FOR SELECT
  TO authenticated
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Owners and admins manage members"
  ON public.workspace_members FOR ALL
  TO authenticated
  USING (public.has_workspace_role(workspace_id, ARRAY['owner','admin']::public.workspace_member_role[]))
  WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['owner','admin']::public.workspace_member_role[]));

-- A user can always insert themselves into a workspace via accepted invitation (handled by edge function in future)
-- For now, an authenticated user can insert their own first row (used during workspace creation bootstrap)
CREATE POLICY "User can self-insert when creating workspace"
  ON public.workspace_members FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- workspace_invitations: only admins/owners of the workspace can manage
CREATE POLICY "Admins manage invitations"
  ON public.workspace_invitations FOR ALL
  TO authenticated
  USING (public.has_workspace_role(workspace_id, ARRAY['owner','admin']::public.workspace_member_role[]))
  WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['owner','admin']::public.workspace_member_role[]));

-- Anyone can lookup an invitation by token (needed for accept flow without prior membership)
CREATE POLICY "Public can read invitation by token"
  ON public.workspace_invitations FOR SELECT
  TO anon, authenticated
  USING (true);

-- 5. BOOTSTRAP WORKSPACE ---------------------------------------------------
-- Create the "True Build HQ" workspace if it doesn't exist.

INSERT INTO public.workspaces (name, slug, kind, plan)
VALUES ('True Build HQ', 'true-build-hq', 'internal', 'enterprise')
ON CONFLICT (slug) DO NOTHING;

-- 6. ADD workspace_id TO BUSINESS TABLES -----------------------------------
-- Helper DO block: adds nullable workspace_id, backfills to bootstrap, then adds index.
-- Kept nullable for now so legacy rows and edge cases don't break inserts.
-- Phase 1b will add NOT NULL + FK after the app is updated to always set it.

DO $$
DECLARE
  bootstrap_id uuid;
  tbl text;
  business_tables text[] := ARRAY[
    'buildings','units','people','vendors',
    'contracts','contract_parties','contract_subjects','contract_events',
    'leases','management_agreements','vendor_service_agreements',
    'service_catalog','service_requests','service_request_steps',
    'service_request_quotes','quote_lines','service_request_events','service_feedback',
    'leads','lead_events','vendor_events','vendor_contacts',
    'invoices','invoice_lines','bills','bill_lines',
    'payments','payment_allocations',
    'journal_entries','journal_lines','accounts','bank_accounts',
    'owner_statements','owner_statement_lines','recurring_invoice_schedules',
    'property_owners','property_status_history','unit_status_history',
    'notes','documents','photos','people_documents','property_documents'
  ];
BEGIN
  SELECT id INTO bootstrap_id FROM public.workspaces WHERE slug = 'true-build-hq';

  FOREACH tbl IN ARRAY business_tables LOOP
    -- only act if table exists
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = tbl
    ) THEN
      -- add column if missing
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name=tbl AND column_name='workspace_id'
      ) THEN
        EXECUTE format('ALTER TABLE public.%I ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE RESTRICT', tbl);
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(workspace_id)', 'idx_'||tbl||'_workspace_id', tbl);
      END IF;

      -- backfill existing rows to bootstrap workspace
      EXECUTE format('UPDATE public.%I SET workspace_id = %L WHERE workspace_id IS NULL', tbl, bootstrap_id);
    END IF;
  END LOOP;
END $$;

-- 7. APP_SETTINGS workspace pointer ----------------------------------------
-- app_settings is currently a singleton. Future per-workspace settings will live in
-- a separate workspace_settings table; we leave app_settings as-is for now but tag it.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='app_settings' AND column_name='workspace_id'
  ) THEN
    ALTER TABLE public.app_settings ADD COLUMN workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
    UPDATE public.app_settings
      SET workspace_id = (SELECT id FROM public.workspaces WHERE slug='true-build-hq')
      WHERE workspace_id IS NULL;
  END IF;
END $$;
