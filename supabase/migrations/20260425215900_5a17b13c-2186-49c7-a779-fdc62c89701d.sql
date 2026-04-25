-- ============================================================
-- 1. ENUMS
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.bill_to_mode AS ENUM ('landlord_only','tenant_only','split','to_be_negotiated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.vendor_service_quality AS ENUM ('economy','standard','premium');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.cost_split_proposal_status AS ENUM ('proposed','accepted','rejected','countered','superseded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.party_cost_approval_status AS ENUM ('not_required','pending','approved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- 2. vendor_services (coverage)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.vendor_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE RESTRICT,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  catalog_id uuid NOT NULL REFERENCES public.service_catalog(id) ON DELETE CASCADE,
  list_price numeric(12,2),
  currency text NOT NULL DEFAULT 'AED',
  quality_tier public.vendor_service_quality NOT NULL DEFAULT 'standard',
  lead_time_days integer,
  min_order_amount numeric(12,2),
  service_area_cities text[] NOT NULL DEFAULT '{}',
  service_area_communities text[] NOT NULL DEFAULT '{}',
  service_area_all_cities boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vendor_id, catalog_id)
);

CREATE INDEX IF NOT EXISTS idx_vendor_services_vendor ON public.vendor_services(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_services_catalog ON public.vendor_services(catalog_id);
CREATE INDEX IF NOT EXISTS idx_vendor_services_workspace ON public.vendor_services(workspace_id);
CREATE INDEX IF NOT EXISTS idx_vendor_services_active ON public.vendor_services(is_active) WHERE is_active = true;

ALTER TABLE public.vendor_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members select vendor_services" ON public.vendor_services
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT current_user_workspace_ids()));

CREATE POLICY "Members insert vendor_services" ON public.vendor_services
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT current_user_workspace_ids()));

CREATE POLICY "Members update vendor_services" ON public.vendor_services
  FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT current_user_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT current_user_workspace_ids()));

CREATE POLICY "Members delete vendor_services" ON public.vendor_services
  FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT current_user_workspace_ids()));

CREATE TRIGGER vendor_services_set_updated_at
  BEFORE UPDATE ON public.vendor_services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 3. service_requests additions (cost split + winning quote)
-- ============================================================
ALTER TABLE public.service_requests
  ADD COLUMN IF NOT EXISTS bill_to_mode public.bill_to_mode NOT NULL DEFAULT 'landlord_only',
  ADD COLUMN IF NOT EXISTS landlord_share_percent numeric(5,2) NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS tenant_share_percent   numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auto_invite_vendors    boolean      NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS service_area_city      text,
  ADD COLUMN IF NOT EXISTS service_area_community text,
  ADD COLUMN IF NOT EXISTS winning_quote_id       uuid REFERENCES public.service_request_quotes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS landlord_cost_approval_status public.party_cost_approval_status NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS tenant_cost_approval_status   public.party_cost_approval_status NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS landlord_cost_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS tenant_cost_approved_at   timestamptz,
  ADD COLUMN IF NOT EXISTS cost_split_resolved_at    timestamptz;

ALTER TABLE public.service_requests
  DROP CONSTRAINT IF EXISTS service_requests_share_sum_chk,
  ADD  CONSTRAINT service_requests_share_sum_chk
    CHECK (landlord_share_percent + tenant_share_percent = 100);

-- Backfill bill_to_mode from existing bill_to (for historical rows)
UPDATE public.service_requests
SET bill_to_mode = CASE bill_to::text
  WHEN 'tenant'   THEN 'tenant_only'::public.bill_to_mode
  ELSE 'landlord_only'::public.bill_to_mode
END,
landlord_share_percent = CASE WHEN bill_to::text = 'tenant' THEN 0   ELSE 100 END,
tenant_share_percent   = CASE WHEN bill_to::text = 'tenant' THEN 100 ELSE 0   END
WHERE bill_to_mode = 'landlord_only' AND bill_to::text = 'tenant';

-- ============================================================
-- 4. service_request_cost_split (negotiation thread)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.service_request_cost_split (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE RESTRICT,
  request_id uuid NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
  proposed_by_role text NOT NULL CHECK (proposed_by_role IN ('landlord','tenant','staff')),
  proposed_by_person_id uuid,
  landlord_share_percent numeric(5,2) NOT NULL,
  tenant_share_percent   numeric(5,2) NOT NULL,
  message text,
  status public.cost_split_proposal_status NOT NULL DEFAULT 'proposed',
  decided_at timestamptz,
  decided_by_person_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cost_split_share_sum CHECK (landlord_share_percent + tenant_share_percent = 100)
);

CREATE INDEX IF NOT EXISTS idx_cost_split_request ON public.service_request_cost_split(request_id);

ALTER TABLE public.service_request_cost_split ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members select cost_split" ON public.service_request_cost_split
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM service_requests sr
    WHERE sr.id = request_id AND sr.workspace_id IN (SELECT current_user_workspace_ids())));

CREATE POLICY "Members write cost_split" ON public.service_request_cost_split
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM service_requests sr
    WHERE sr.id = request_id AND sr.workspace_id IN (SELECT current_user_workspace_ids())))
  WITH CHECK (EXISTS (SELECT 1 FROM service_requests sr
    WHERE sr.id = request_id AND sr.workspace_id IN (SELECT current_user_workspace_ids())));

CREATE POLICY "Anon view cost_split via tenant_token" ON public.service_request_cost_split
  FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM service_requests sr
    WHERE sr.id = request_id AND sr.tenant_token IS NOT NULL));

-- ============================================================
-- 5. Vendor matching helper
-- ============================================================
CREATE OR REPLACE FUNCTION public.match_vendors_for_catalog(
  _workspace_id uuid,
  _catalog_id uuid,
  _city text DEFAULT NULL,
  _community text DEFAULT NULL
) RETURNS TABLE (
  vendor_id uuid,
  list_price numeric,
  quality_tier public.vendor_service_quality,
  lead_time_days integer,
  is_preferred boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT vs.vendor_id,
         vs.list_price,
         vs.quality_tier,
         vs.lead_time_days,
         v.is_preferred
  FROM   public.vendor_services vs
  JOIN   public.vendors v ON v.id = vs.vendor_id
  WHERE  vs.catalog_id = _catalog_id
    AND  vs.is_active = true
    AND  v.status = 'active'
    AND  (vs.workspace_id = _workspace_id OR vs.workspace_id IS NULL)
    AND  (
           vs.service_area_all_cities = true
           OR _city IS NULL
           OR _city = ANY(vs.service_area_cities)
         )
    AND  (
           _community IS NULL
           OR cardinality(vs.service_area_communities) = 0
           OR _community = ANY(vs.service_area_communities)
         )
  ORDER BY v.is_preferred DESC NULLS LAST, vs.list_price ASC NULLS LAST;
$$;

-- ============================================================
-- 6. Auto-invite trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.auto_invite_vendors_for_request(_request_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sr public.service_requests%ROWTYPE;
  v RECORD;
  inserted_count integer := 0;
BEGIN
  SELECT * INTO sr FROM public.service_requests WHERE id = _request_id;
  IF sr.id IS NULL OR sr.catalog_id IS NULL THEN
    RETURN 0;
  END IF;

  FOR v IN
    SELECT * FROM public.match_vendors_for_catalog(
      sr.workspace_id, sr.catalog_id, sr.service_area_city, sr.service_area_community
    )
  LOOP
    INSERT INTO public.service_request_quotes (request_id, vendor_id, workspace_id, status)
    VALUES (_request_id, v.vendor_id, sr.workspace_id, 'invited')
    ON CONFLICT (request_id, vendor_id) DO NOTHING;
    IF FOUND THEN inserted_count := inserted_count + 1; END IF;
  END LOOP;

  RETURN inserted_count;
END $$;

CREATE OR REPLACE FUNCTION public.tg_service_request_auto_invite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.auto_invite_vendors = true
     AND NEW.catalog_id IS NOT NULL
     AND NEW.delivery::text = 'vendor' THEN
    PERFORM public.auto_invite_vendors_for_request(NEW.id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS service_requests_auto_invite ON public.service_requests;
CREATE TRIGGER service_requests_auto_invite
  AFTER INSERT ON public.service_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_service_request_auto_invite();

-- ============================================================
-- 7. Backfill vendor_services from existing default_assignee_vendor_id
-- ============================================================
INSERT INTO public.vendor_services (workspace_id, vendor_id, catalog_id, is_active, service_area_all_cities, notes)
SELECT sc.workspace_id, sc.default_assignee_vendor_id, sc.id, true, true,
       'Auto-seeded from previous default vendor mapping'
FROM   public.service_catalog sc
WHERE  sc.default_assignee_vendor_id IS NOT NULL
ON CONFLICT (vendor_id, catalog_id) DO NOTHING;
