-- Enums
CREATE TYPE public.vsa_rate_model AS ENUM (
  'per_call_out', 'per_hour', 'fixed_per_visit', 'quote_required', 'hybrid'
);

CREATE TYPE public.vsa_payment_terms AS ENUM (
  'on_completion', 'net_7', 'net_15', 'net_30', 'net_60', 'monthly_invoice', 'custom'
);

-- Main VSA table
CREATE TABLE public.vendor_service_agreements (
  contract_id uuid PRIMARY KEY REFERENCES public.contracts(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE RESTRICT,

  -- Scope
  covered_services jsonb NOT NULL DEFAULT '[]'::jsonb,  -- array of service_catalog.code values
  scope_notes text,
  is_exclusive boolean NOT NULL DEFAULT false,
  service_area_notes text,

  -- Rate card
  rate_model public.vsa_rate_model NOT NULL DEFAULT 'quote_required',
  default_call_out_fee numeric,
  default_hourly_rate numeric,
  fixed_visit_fee numeric,
  materials_markup_percent numeric,
  rate_notes text,

  -- Payment
  payment_terms public.vsa_payment_terms NOT NULL DEFAULT 'net_30',
  payment_terms_custom text,

  -- SLA
  response_time_hours integer,
  resolution_time_hours integer,
  emergency_response_time_hours integer,
  sla_notes text,

  -- Authorization
  repair_authorization_threshold numeric,
  repair_authorization_currency text DEFAULT 'AED',
  repair_authorization_terms text,

  -- Renewal / termination
  auto_renew boolean NOT NULL DEFAULT false,
  renewal_notice_days integer,
  termination_notice_days integer DEFAULT 30,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_vsa_vendor ON public.vendor_service_agreements(vendor_id);

-- updated_at trigger (reuses existing helper)
CREATE TRIGGER trg_vsa_touch
BEFORE UPDATE ON public.vendor_service_agreements
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- RLS
ALTER TABLE public.vendor_service_agreements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view vendor_service_agreements"
ON public.vendor_service_agreements FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert vendor_service_agreements"
ON public.vendor_service_agreements FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update vendor_service_agreements"
ON public.vendor_service_agreements FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated can delete vendor_service_agreements"
ON public.vendor_service_agreements FOR DELETE TO authenticated USING (true);

-- Helper: does this vendor have an active VSA covering this catalog service code?
CREATE OR REPLACE FUNCTION public.has_active_vsa_for_vendor_and_service(
  p_vendor_id uuid,
  p_catalog_code text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.vendor_service_agreements vsa
    JOIN public.contracts c ON c.id = vsa.contract_id
    WHERE vsa.vendor_id = p_vendor_id
      AND c.status = 'active'
      AND (c.end_date IS NULL OR c.end_date >= CURRENT_DATE)
      AND (
        vsa.covered_services @> to_jsonb(p_catalog_code)
        OR jsonb_array_length(vsa.covered_services) = 0  -- empty = covers all
      )
  );
$$;