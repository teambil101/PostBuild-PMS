-- Enums
CREATE TYPE public.contract_type AS ENUM ('management_agreement', 'lease', 'vendor_service_agreement');
CREATE TYPE public.contract_status AS ENUM ('draft', 'pending_signature', 'active', 'expired', 'terminated', 'cancelled');
CREATE TYPE public.contract_party_role AS ENUM ('pm_company', 'landlord', 'tenant', 'broker', 'guarantor', 'vendor');
CREATE TYPE public.ma_fee_model AS ENUM ('percent_of_rent', 'flat_annual', 'flat_per_unit', 'hybrid');
CREATE TYPE public.ma_approval_rule AS ENUM ('auto_threshold', 'always_required', 'auto_all');

-- Parent contracts table
CREATE TABLE public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_number text NOT NULL UNIQUE,
  contract_type public.contract_type NOT NULL,
  status public.contract_status NOT NULL DEFAULT 'draft',
  title text,
  start_date date,
  end_date date,
  signed_date date,
  currency text NOT NULL DEFAULT 'AED',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contracts_type ON public.contracts(contract_type);
CREATE INDEX idx_contracts_status ON public.contracts(status);

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view contracts" ON public.contracts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert contracts" ON public.contracts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update contracts" ON public.contracts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete contracts" ON public.contracts FOR DELETE TO authenticated USING (true);

-- Parties
CREATE TABLE public.contract_parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE RESTRICT,
  role public.contract_party_role NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_contract_parties_contract ON public.contract_parties(contract_id);
CREATE INDEX idx_contract_parties_person ON public.contract_parties(person_id);

ALTER TABLE public.contract_parties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view contract_parties" ON public.contract_parties FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert contract_parties" ON public.contract_parties FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update contract_parties" ON public.contract_parties FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete contract_parties" ON public.contract_parties FOR DELETE TO authenticated USING (true);

-- Subjects (properties covered)
CREATE TABLE public.contract_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  subject_type text NOT NULL CHECK (subject_type IN ('building', 'unit')),
  subject_id uuid NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_contract_subjects_contract ON public.contract_subjects(contract_id);
CREATE INDEX idx_contract_subjects_subject ON public.contract_subjects(subject_type, subject_id);

ALTER TABLE public.contract_subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view contract_subjects" ON public.contract_subjects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert contract_subjects" ON public.contract_subjects FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update contract_subjects" ON public.contract_subjects FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete contract_subjects" ON public.contract_subjects FOR DELETE TO authenticated USING (true);

-- Events
CREATE TABLE public.contract_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  description text,
  from_value text,
  to_value text,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_contract_events_contract ON public.contract_events(contract_id);

ALTER TABLE public.contract_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view contract_events" ON public.contract_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert contract_events" ON public.contract_events FOR INSERT TO authenticated WITH CHECK (true);

-- Management Agreement child
CREATE TABLE public.management_agreements (
  contract_id uuid PRIMARY KEY REFERENCES public.contracts(id) ON DELETE CASCADE,
  fee_model public.ma_fee_model NOT NULL DEFAULT 'percent_of_rent',
  fee_percent numeric,
  fee_flat_annual numeric,
  fee_flat_per_unit numeric,
  fee_notes text,
  included_services jsonb NOT NULL DEFAULT '[]'::jsonb,
  approval_rule public.ma_approval_rule NOT NULL DEFAULT 'always_required',
  approval_threshold_amount numeric,
  approval_threshold_currency text DEFAULT 'AED',
  lease_up_fee_model text,
  lease_up_fee_value numeric,
  termination_notice_days integer DEFAULT 60,
  auto_renew boolean NOT NULL DEFAULT false,
  renewal_notice_days integer,
  repair_authorization_terms text,
  scope_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.management_agreements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view management_agreements" ON public.management_agreements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert management_agreements" ON public.management_agreements FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update management_agreements" ON public.management_agreements FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete management_agreements" ON public.management_agreements FOR DELETE TO authenticated USING (true);

-- updated_at triggers (reuse existing function update_updated_at_column if present)
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_contracts_updated_at
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TRIGGER trg_management_agreements_updated_at
  BEFORE UPDATE ON public.management_agreements
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();