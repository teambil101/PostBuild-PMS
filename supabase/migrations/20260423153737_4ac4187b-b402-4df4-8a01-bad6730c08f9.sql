-- Categorization enum
CREATE TYPE public.service_category AS ENUM (
  'maintenance',
  'inspection',
  'tenant_lifecycle',
  'leasing',
  'compliance',
  'cleaning',
  'utilities',
  'administrative',
  'other'
);

-- Delivery + billing enums
CREATE TYPE public.service_delivery AS ENUM ('vendor', 'staff', 'either');
CREATE TYPE public.service_billing  AS ENUM ('free', 'paid', 'pass_through');

-- Recurrence cadence
CREATE TYPE public.service_cadence AS ENUM (
  'one_off',
  'weekly',
  'monthly',
  'quarterly',
  'biannual',
  'annual',
  'custom'
);

CREATE TABLE public.service_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,                    -- e.g. PIPE_REPAIR, TENANT_ONBOARD
  name text NOT NULL,
  description text,
  category public.service_category NOT NULL DEFAULT 'maintenance',

  default_delivery public.service_delivery NOT NULL DEFAULT 'vendor',
  default_billing  public.service_billing  NOT NULL DEFAULT 'paid',

  typical_duration_days integer,                -- estimate for SLAs
  cadence public.service_cadence NOT NULL DEFAULT 'one_off',
  recurrence_interval_days integer,             -- only used when cadence='custom'

  -- Workflow / composite support
  is_workflow boolean NOT NULL DEFAULT false,
  workflow_steps jsonb NOT NULL DEFAULT '[]',
  -- workflow_steps shape (when is_workflow=true):
  -- [
  --   {
  --     "key": "list_unit",
  --     "title": "List unit on portals",
  --     "category": "leasing",
  --     "default_delivery": "staff",
  --     "default_billing": "free",
  --     "typical_duration_days": 3,
  --     "blocks_next": false
  --   }, ...
  -- ]

  is_active boolean NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.service_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view service_catalog"
  ON public.service_catalog FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert service_catalog"
  ON public.service_catalog FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update service_catalog"
  ON public.service_catalog FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete service_catalog"
  ON public.service_catalog FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_service_catalog_category ON public.service_catalog(category);
CREATE INDEX idx_service_catalog_active   ON public.service_catalog(is_active);

CREATE OR REPLACE FUNCTION public.update_service_catalog_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER service_catalog_updated_at
  BEFORE UPDATE ON public.service_catalog
  FOR EACH ROW EXECUTE FUNCTION public.update_service_catalog_updated_at();

-- Seed a few sensible defaults so the UI isn't empty on first load
INSERT INTO public.service_catalog
  (code, name, category, default_delivery, default_billing, typical_duration_days, cadence, is_workflow, workflow_steps, description)
VALUES
  ('PIPE_REPAIR', 'Pipe / plumbing repair', 'maintenance', 'vendor', 'paid', 1, 'one_off', false, '[]'::jsonb,
   'On-demand plumbing fix triggered by a tenant report.'),
  ('AC_SERVICE', 'AC service / repair', 'maintenance', 'vendor', 'paid', 1, 'one_off', false, '[]'::jsonb,
   'AC diagnostic, gas top-up, or coil cleaning.'),
  ('BIANNUAL_INSPECTION', 'Bi-annual property inspection', 'inspection', 'staff', 'free', 1, 'biannual', false, '[]'::jsonb,
   'Routine condition check, photos uploaded to the unit.'),
  ('TENANT_DOC_COLLECTION', 'Tenant document collection', 'tenant_lifecycle', 'staff', 'free', 7, 'one_off', false, '[]'::jsonb,
   'Auto-triggered on lease pending_signature: collect Emirates ID, passport, visa.'),
  ('MOVE_IN_INSPECTION', 'Move-in inspection', 'inspection', 'staff', 'free', 1, 'one_off', false, '[]'::jsonb,
   'Snagging report and photos at handover.'),
  ('MOVE_OUT_INSPECTION', 'Move-out inspection & deposit settlement', 'inspection', 'staff', 'free', 3, 'one_off', false, '[]'::jsonb,
   'Final inspection, damages assessment, deposit refund decision.'),
  ('EJARI_REGISTRATION', 'Ejari registration', 'compliance', 'staff', 'pass_through', 3, 'one_off', false, '[]'::jsonb,
   'Government registration of tenancy contract. Fee passed through to landlord/tenant.'),
  ('TENANT_ONBOARD', 'Tenant search & onboarding', 'tenant_lifecycle', 'staff', 'free', 45, 'one_off', true,
   '[
      {"key":"list_unit","title":"List unit on portals","category":"leasing","default_delivery":"staff","default_billing":"free","typical_duration_days":3,"blocks_next":false},
      {"key":"viewings","title":"Conduct viewings","category":"leasing","default_delivery":"staff","default_billing":"free","typical_duration_days":14,"blocks_next":false},
      {"key":"negotiate","title":"Negotiate offer","category":"leasing","default_delivery":"staff","default_billing":"free","typical_duration_days":3,"blocks_next":true},
      {"key":"contract","title":"Draft & sign tenancy contract","category":"tenant_lifecycle","default_delivery":"staff","default_billing":"free","typical_duration_days":3,"blocks_next":true},
      {"key":"ejari","title":"Ejari registration","category":"compliance","default_delivery":"staff","default_billing":"pass_through","typical_duration_days":3,"blocks_next":false},
      {"key":"utilities","title":"Utilities (DEWA / chiller) setup","category":"utilities","default_delivery":"staff","default_billing":"free","typical_duration_days":5,"blocks_next":false},
      {"key":"move_in","title":"Move-in inspection + photos","category":"inspection","default_delivery":"staff","default_billing":"free","typical_duration_days":1,"blocks_next":true},
      {"key":"handover","title":"Key handover","category":"tenant_lifecycle","default_delivery":"staff","default_billing":"free","typical_duration_days":1,"blocks_next":false}
    ]'::jsonb,
   'End-to-end onboarding of a new tenant — listing through key handover.'),
  ('LEASE_RENEWAL', 'Lease renewal', 'tenant_lifecycle', 'staff', 'free', 30, 'annual', true,
   '[
      {"key":"renewal_offer","title":"Send renewal offer","category":"tenant_lifecycle","default_delivery":"staff","default_billing":"free","typical_duration_days":7,"blocks_next":true},
      {"key":"negotiate_renewal","title":"Negotiate terms","category":"tenant_lifecycle","default_delivery":"staff","default_billing":"free","typical_duration_days":7,"blocks_next":true},
      {"key":"new_contract","title":"Draft renewed contract","category":"tenant_lifecycle","default_delivery":"staff","default_billing":"free","typical_duration_days":3,"blocks_next":true},
      {"key":"ejari_renewal","title":"Ejari renewal","category":"compliance","default_delivery":"staff","default_billing":"pass_through","typical_duration_days":3,"blocks_next":false}
    ]'::jsonb,
   'Annual workflow run before lease end date.');