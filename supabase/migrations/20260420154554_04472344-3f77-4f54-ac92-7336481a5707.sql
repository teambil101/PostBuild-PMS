-- =========================================================
-- Service Agreements (V3)
-- =========================================================

CREATE TABLE public.service_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL UNIQUE REFERENCES public.contracts(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE RESTRICT,

  -- Scope
  scope_of_services jsonb NOT NULL DEFAULT '[]'::jsonb,
  scope_of_services_other text,
  service_frequency text NOT NULL DEFAULT 'on_demand',

  -- Fee structure
  fee_model text NOT NULL,
  fee_value numeric(12, 2),
  hybrid_base_monthly numeric(12, 2),
  hybrid_per_call_or_unit numeric(12, 2),
  hybrid_mode text,
  hourly_rate numeric(10, 2),
  call_out_fee numeric(10, 2),
  materials_markup_percent numeric(5, 2),

  -- Materials
  materials_included boolean NOT NULL DEFAULT false,
  materials_notes text,

  -- SLA
  response_time_urgent_hours integer,
  response_time_standard_hours integer,
  sla_notes text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT service_agreements_fee_model_check
    CHECK (fee_model IN ('fixed_monthly','fixed_annual','per_call','per_unit','hybrid','time_and_materials','quote_based')),
  CONSTRAINT service_agreements_frequency_check
    CHECK (service_frequency IN ('on_demand','weekly','biweekly','monthly','quarterly','semi_annually','annually')),
  CONSTRAINT service_agreements_hybrid_mode_check
    CHECK (hybrid_mode IS NULL OR hybrid_mode IN ('per_call','per_unit')),
  CONSTRAINT service_agreements_fee_value_nonneg
    CHECK (fee_value IS NULL OR fee_value >= 0),
  CONSTRAINT service_agreements_hybrid_consistency
    CHECK (
      (fee_model = 'hybrid')
        = (hybrid_base_monthly IS NOT NULL
           AND hybrid_per_call_or_unit IS NOT NULL
           AND hybrid_mode IS NOT NULL)
    ),
  CONSTRAINT service_agreements_tm_consistency
    CHECK (
      fee_model = 'time_and_materials'
      OR (hourly_rate IS NULL AND call_out_fee IS NULL AND materials_markup_percent IS NULL)
    )
);

CREATE INDEX idx_service_agreements_vendor_id ON public.service_agreements (vendor_id);
CREATE INDEX idx_service_agreements_scope_gin ON public.service_agreements USING GIN (scope_of_services);

-- Updated_at trigger (reuse shared helper)
CREATE TRIGGER update_service_agreements_updated_at
  BEFORE UPDATE ON public.service_agreements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- RLS
-- =========================================================
ALTER TABLE public.service_agreements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view service_agreements"
  ON public.service_agreements
  FOR SELECT
  TO authenticated
  USING (public.has_any_role(auth.uid()));

CREATE POLICY "Staff/admin can insert service_agreements"
  ON public.service_agreements
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'staff'::app_role)
  );

CREATE POLICY "Staff/admin can update service_agreements"
  ON public.service_agreements
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'staff'::app_role)
  );

CREATE POLICY "Admin can delete service_agreements"
  ON public.service_agreements
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- =========================================================
-- Helper for soft precondition on vendor assignment
-- =========================================================
CREATE OR REPLACE FUNCTION public.has_active_service_agreement_for_vendor_and_unit(
  p_vendor_id uuid,
  p_unit_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM contracts c
      JOIN service_agreements sa ON sa.contract_id = c.id
      JOIN contract_subjects cs ON cs.contract_id = c.id
     WHERE c.contract_type = 'service_agreement'
       AND c.status = 'active'
       AND sa.vendor_id = p_vendor_id
       AND (
         (cs.entity_type = 'unit' AND cs.entity_id = p_unit_id)
         OR (cs.entity_type = 'building'
             AND cs.entity_id = (SELECT building_id FROM units WHERE id = p_unit_id))
       )
  );
$$;