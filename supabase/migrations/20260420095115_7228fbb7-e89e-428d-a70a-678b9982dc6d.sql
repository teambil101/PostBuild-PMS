-- ============================================================
-- 1. PEOPLE EXTENSIONS
-- ============================================================
ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS is_self boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trade_license_authority text,
  ADD COLUMN IF NOT EXISTS registered_address text,
  ADD COLUMN IF NOT EXISTS authorized_signatory_name text,
  ADD COLUMN IF NOT EXISTS authorized_signatory_title text,
  ADD COLUMN IF NOT EXISTS primary_email text;

-- Global partial unique: at most one self person
CREATE UNIQUE INDEX IF NOT EXISTS people_is_self_unique
  ON public.people ((true)) WHERE is_self = true;

-- ============================================================
-- 2. APP SETTINGS (singleton)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  self_person_id uuid REFERENCES public.people(id) ON DELETE SET NULL,
  default_currency text NOT NULL DEFAULT 'AED' CHECK (char_length(default_currency) = 3),
  contract_number_prefix text NOT NULL DEFAULT 'CTR',
  fiscal_year_start_month integer NOT NULL DEFAULT 1 CHECK (fiscal_year_start_month BETWEEN 1 AND 12),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Singleton enforcement
CREATE UNIQUE INDEX IF NOT EXISTS app_settings_singleton ON public.app_settings ((true));

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view app_settings" ON public.app_settings
  FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));

CREATE POLICY "Staff/admin can insert app_settings" ON public.app_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

CREATE POLICY "Staff/admin can update app_settings" ON public.app_settings
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

CREATE TRIGGER app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed one row
INSERT INTO public.app_settings (default_currency, contract_number_prefix)
SELECT 'AED', 'CTR'
WHERE NOT EXISTS (SELECT 1 FROM public.app_settings);

-- ============================================================
-- 3. NUMBER SEQUENCES + next_number() function
-- ============================================================
CREATE TABLE IF NOT EXISTS public.number_sequences (
  prefix text NOT NULL,
  year integer NOT NULL,
  last_seq integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (prefix, year)
);

ALTER TABLE public.number_sequences ENABLE ROW LEVEL SECURITY;

-- No direct access policies — function-only access via SECURITY DEFINER

CREATE OR REPLACE FUNCTION public.next_number(p_prefix text, p_year integer)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seq integer;
BEGIN
  -- Upsert + lock the row
  INSERT INTO public.number_sequences (prefix, year, last_seq)
  VALUES (p_prefix, p_year, 0)
  ON CONFLICT (prefix, year) DO NOTHING;

  UPDATE public.number_sequences
     SET last_seq = last_seq + 1,
         updated_at = now()
   WHERE prefix = p_prefix AND year = p_year
   RETURNING last_seq INTO v_seq;

  RETURN p_prefix || '-' || p_year::text || '-' || LPAD(v_seq::text, 4, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_number(text, integer) TO authenticated;

-- ============================================================
-- 4. CONTRACTS (parent table)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_type text NOT NULL CHECK (contract_type IN (
    'lease','management_agreement','service_agreement','brokerage_agreement',
    'sale_purchase_agreement','noc','addendum','other'
  )),
  contract_number text NOT NULL UNIQUE,
  external_reference text,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft','pending_signature','active','expired','terminated','cancelled'
  )),
  start_date date,
  end_date date,
  auto_renew boolean NOT NULL DEFAULT false,
  currency text NOT NULL DEFAULT 'AED' CHECK (char_length(currency) = 3),
  total_value numeric(14,2),
  parent_contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  terminated_at timestamptz,
  terminated_reason text,
  CHECK (end_date IS NULL OR start_date IS NULL OR end_date > start_date)
);

CREATE INDEX IF NOT EXISTS contracts_type_status_idx ON public.contracts (contract_type, status);
CREATE INDEX IF NOT EXISTS contracts_status_idx ON public.contracts (status);
CREATE INDEX IF NOT EXISTS contracts_parent_idx ON public.contracts (parent_contract_id);
CREATE INDEX IF NOT EXISTS contracts_end_date_idx ON public.contracts (end_date);

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view contracts" ON public.contracts
  FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "Staff/admin can insert contracts" ON public.contracts
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY "Staff/admin can update contracts" ON public.contracts
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY "Admin can delete contracts" ON public.contracts
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER contracts_updated_at
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 5. MANAGEMENT AGREEMENTS (1:1 child)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.management_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL UNIQUE REFERENCES public.contracts(id) ON DELETE CASCADE,
  fee_model text NOT NULL CHECK (fee_model IN (
    'percentage_of_rent','flat_annual','flat_per_unit','hybrid'
  )),
  fee_value numeric(12,2) NOT NULL CHECK (fee_value >= 0),
  fee_applies_to text CHECK (fee_applies_to IS NULL OR fee_applies_to IN ('contracted_rent','collected_rent')),
  lease_up_fee_model text CHECK (lease_up_fee_model IS NULL OR lease_up_fee_model IN ('percentage','flat','none')),
  lease_up_fee_value numeric(12,2),
  hybrid_base_flat numeric(12,2),
  hybrid_threshold numeric(12,2),
  hybrid_overage_percentage numeric(5,2),
  repair_approval_threshold numeric(10,2),
  termination_notice_days integer,
  scope_of_services jsonb NOT NULL DEFAULT '[]'::jsonb,
  scope_of_services_other text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.management_agreements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view management_agreements" ON public.management_agreements
  FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "Staff/admin can insert management_agreements" ON public.management_agreements
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY "Staff/admin can update management_agreements" ON public.management_agreements
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY "Admin can delete management_agreements" ON public.management_agreements
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER management_agreements_updated_at
  BEFORE UPDATE ON public.management_agreements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 6. CONTRACT PARTIES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.contract_parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE RESTRICT,
  role text NOT NULL CHECK (role IN (
    'landlord','tenant','lessor','lessee','service_provider','client',
    'broker','guarantor','witness','other'
  )),
  is_signatory boolean NOT NULL DEFAULT true,
  signed_at date,
  signature_reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contract_parties_contract_idx ON public.contract_parties (contract_id);
CREATE INDEX IF NOT EXISTS contract_parties_person_idx ON public.contract_parties (person_id);

ALTER TABLE public.contract_parties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view contract_parties" ON public.contract_parties
  FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "Staff/admin can insert contract_parties" ON public.contract_parties
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY "Staff/admin can update contract_parties" ON public.contract_parties
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY "Staff/admin can delete contract_parties" ON public.contract_parties
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

-- ============================================================
-- 7. CONTRACT SUBJECTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.contract_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('building','unit')),
  entity_id uuid NOT NULL,
  role text DEFAULT 'subject',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contract_subjects_contract_idx ON public.contract_subjects (contract_id);
CREATE INDEX IF NOT EXISTS contract_subjects_entity_idx ON public.contract_subjects (entity_type, entity_id);

ALTER TABLE public.contract_subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view contract_subjects" ON public.contract_subjects
  FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "Staff/admin can insert contract_subjects" ON public.contract_subjects
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));
CREATE POLICY "Staff/admin can delete contract_subjects" ON public.contract_subjects
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

-- ============================================================
-- 8. CONTRACT EVENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.contract_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN (
    'created','status_changed','party_added','party_removed',
    'subject_added','subject_removed','signed','terminated','renewed','amended','note'
  )),
  from_value text,
  to_value text,
  description text,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contract_events_contract_idx ON public.contract_events (contract_id, created_at DESC);

ALTER TABLE public.contract_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view contract_events" ON public.contract_events
  FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY "Staff/admin can insert contract_events" ON public.contract_events
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

-- ============================================================
-- 9. process_contract_lifecycle() — manual call for now
-- ============================================================
CREATE OR REPLACE FUNCTION public.process_contract_lifecycle()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expired_ids uuid[];
  v_renewed_ids uuid[];
  v_id uuid;
BEGIN
  -- Expire
  WITH expired AS (
    UPDATE public.contracts
       SET status = 'expired', updated_at = now()
     WHERE status = 'active'
       AND end_date IS NOT NULL
       AND end_date < current_date
       AND auto_renew = false
    RETURNING id
  )
  SELECT array_agg(id) INTO v_expired_ids FROM expired;

  IF v_expired_ids IS NOT NULL THEN
    FOREACH v_id IN ARRAY v_expired_ids LOOP
      INSERT INTO public.contract_events (contract_id, event_type, from_value, to_value, description)
      VALUES (v_id, 'status_changed', 'active', 'expired', 'Auto-expired: end_date passed');
    END LOOP;
  END IF;

  -- Auto-renew (extend end_date by original duration)
  WITH renewed AS (
    UPDATE public.contracts
       SET end_date = end_date + (end_date - start_date),
           updated_at = now()
     WHERE status = 'active'
       AND end_date IS NOT NULL
       AND start_date IS NOT NULL
       AND end_date < current_date
       AND auto_renew = true
    RETURNING id
  )
  SELECT array_agg(id) INTO v_renewed_ids FROM renewed;

  IF v_renewed_ids IS NOT NULL THEN
    FOREACH v_id IN ARRAY v_renewed_ids LOOP
      INSERT INTO public.contract_events (contract_id, event_type, description)
      VALUES (v_id, 'renewed', 'Auto-renewed: duration extended');
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'expired_count', COALESCE(array_length(v_expired_ids, 1), 0),
    'renewed_count', COALESCE(array_length(v_renewed_ids, 1), 0),
    'expired_ids', COALESCE(to_jsonb(v_expired_ids), '[]'::jsonb),
    'renewed_ids', COALESCE(to_jsonb(v_renewed_ids), '[]'::jsonb),
    'run_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_contract_lifecycle() TO authenticated;