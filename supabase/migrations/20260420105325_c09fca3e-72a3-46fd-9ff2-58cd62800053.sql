-- ============================================================
-- LEASES MODULE — Pass B1
-- Schema, triggers, and helper functions for the lease subtype.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ============================================================
-- 1. leases (1:1 child of contracts)
-- ============================================================
CREATE TABLE public.leases (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id                 uuid NOT NULL UNIQUE REFERENCES public.contracts(id) ON DELETE CASCADE,
  annual_rent                 numeric(12,2) NOT NULL,
  payment_frequency           text NOT NULL,
  first_cheque_date           date,
  security_deposit_amount     numeric(12,2),
  security_deposit_status     text,
  security_deposit_notes      text,
  commission_amount           numeric(12,2),
  commission_payer            text,
  commission_status           text,
  ejari_number                text,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT leases_payment_frequency_check
    CHECK (payment_frequency IN ('1_cheque','2_cheques','4_cheques','6_cheques','12_cheques','custom')),
  CONSTRAINT leases_security_deposit_status_check
    CHECK (security_deposit_status IS NULL OR security_deposit_status IN ('pending','received','refunded','forfeited')),
  CONSTRAINT leases_commission_payer_check
    CHECK (commission_payer IS NULL OR commission_payer IN ('tenant','landlord','split')),
  CONSTRAINT leases_commission_status_check
    CHECK (commission_status IS NULL OR commission_status IN ('pending','paid')),
  CONSTRAINT leases_annual_rent_positive
    CHECK (annual_rent > 0)
);

CREATE INDEX idx_leases_contract_id ON public.leases(contract_id);

ALTER TABLE public.leases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view leases"
  ON public.leases FOR SELECT TO authenticated
  USING (has_any_role(auth.uid()));

CREATE POLICY "Staff/admin can insert leases"
  ON public.leases FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'staff'));

CREATE POLICY "Staff/admin can update leases"
  ON public.leases FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'staff'));

CREATE POLICY "Admin can delete leases"
  ON public.leases FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'));

CREATE TRIGGER update_leases_updated_at
  BEFORE UPDATE ON public.leases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2. lease_cheques (grandchild of contracts → leases)
-- ============================================================
CREATE TABLE public.lease_cheques (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id                 uuid NOT NULL REFERENCES public.leases(id) ON DELETE CASCADE,
  sequence_number          integer NOT NULL,
  amount                   numeric(12,2) NOT NULL,
  due_date                 date NOT NULL,
  cheque_number            text,
  bank_name                text,
  status                   text NOT NULL DEFAULT 'pending',
  deposited_on             date,
  cleared_on               date,
  bounced_on               date,
  bounce_reason            text,
  replacement_cheque_id    uuid REFERENCES public.lease_cheques(id) ON DELETE SET NULL,
  notes                    text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT lease_cheques_status_check
    CHECK (status IN ('pending','deposited','cleared','bounced','returned','replaced')),
  CONSTRAINT lease_cheques_amount_positive
    CHECK (amount > 0),
  CONSTRAINT lease_cheques_bounce_reason_check
    CHECK (bounce_reason IS NULL OR bounce_reason IN ('nsf','stopped_payment','signature_mismatch','account_closed','other')),
  CONSTRAINT lease_cheques_seq_unique
    UNIQUE (lease_id, sequence_number)
);

CREATE INDEX idx_lease_cheques_lease_due ON public.lease_cheques(lease_id, due_date);
CREATE INDEX idx_lease_cheques_status_due ON public.lease_cheques(status, due_date);

ALTER TABLE public.lease_cheques ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view lease_cheques"
  ON public.lease_cheques FOR SELECT TO authenticated
  USING (has_any_role(auth.uid()));

CREATE POLICY "Staff/admin can insert lease_cheques"
  ON public.lease_cheques FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'staff'));

CREATE POLICY "Staff/admin can update lease_cheques"
  ON public.lease_cheques FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'staff'));

CREATE POLICY "Staff/admin can delete lease_cheques"
  ON public.lease_cheques FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'staff'));

CREATE TRIGGER update_lease_cheques_updated_at
  BEFORE UPDATE ON public.lease_cheques
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 3. has_active_mgmt_agreement_for_unit(unit_id) — RPC for precondition check
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_active_mgmt_agreement_for_unit(p_unit_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.contracts c
      JOIN public.contract_subjects cs ON cs.contract_id = c.id
     WHERE c.contract_type = 'management_agreement'
       AND c.status = 'active'
       AND (
         (cs.entity_type = 'unit' AND cs.entity_id = p_unit_id)
         OR
         (cs.entity_type = 'building' AND cs.entity_id = (SELECT building_id FROM public.units WHERE id = p_unit_id))
       )
  );
$$;

-- ============================================================
-- 4. sync_unit_status_on_lease_state_change — trigger function
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_unit_status_on_lease_state_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unit_id uuid;
  v_old_unit_status property_status;
BEGIN
  SELECT entity_id INTO v_unit_id
    FROM public.contract_subjects
   WHERE contract_id = NEW.id
     AND entity_type = 'unit'
   LIMIT 1;

  IF v_unit_id IS NULL THEN
    RAISE WARNING 'Lease % has no unit subject; skipping unit status sync', NEW.id;
    RETURN NEW;
  END IF;

  -- Active transition (covers INSERT-as-active and UPDATE draft→active)
  IF NEW.status = 'active' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'active') THEN
    SELECT status INTO v_old_unit_status FROM public.units WHERE id = v_unit_id;

    UPDATE public.units
       SET status = 'occupied',
           status_locked_by_lease_id = NEW.id,
           updated_at = now()
     WHERE id = v_unit_id;

    INSERT INTO public.unit_status_history (unit_id, old_status, new_status, reason, changed_by)
    VALUES (v_unit_id, v_old_unit_status, 'occupied',
            'Lease activated: ' || NEW.contract_number,
            NULL);

  -- Active → ended transition. UPDATE only.
  ELSIF TG_OP = 'UPDATE'
        AND OLD.status = 'active'
        AND NEW.status IN ('expired','terminated','cancelled') THEN

    UPDATE public.units
       SET status = 'vacant',
           status_locked_by_lease_id = NULL,
           updated_at = now()
     WHERE id = v_unit_id
       AND status_locked_by_lease_id = NEW.id;

    INSERT INTO public.unit_status_history (unit_id, old_status, new_status, reason, changed_by)
    VALUES (v_unit_id, 'occupied', 'vacant',
            'Lease ' || NEW.status || ': ' || NEW.contract_number,
            NULL);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_unit_status_on_lease_update
  AFTER UPDATE OF status ON public.contracts
  FOR EACH ROW
  WHEN (NEW.contract_type = 'lease' AND OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.sync_unit_status_on_lease_state_change();

CREATE TRIGGER sync_unit_status_on_lease_insert
  AFTER INSERT ON public.contracts
  FOR EACH ROW
  WHEN (NEW.contract_type = 'lease' AND NEW.status = 'active')
  EXECUTE FUNCTION public.sync_unit_status_on_lease_state_change();

-- ============================================================
-- 5. check_no_overlapping_active_lease — DB-level integrity backstop
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_no_overlapping_active_lease()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unit_id uuid;
  v_conflict RECORD;
BEGIN
  SELECT entity_id INTO v_unit_id
    FROM public.contract_subjects
   WHERE contract_id = NEW.id
     AND entity_type = 'unit'
   LIMIT 1;

  IF v_unit_id IS NULL OR NEW.start_date IS NULL OR NEW.end_date IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT c.contract_number, c.start_date, c.end_date
    INTO v_conflict
    FROM public.contracts c
    JOIN public.contract_subjects cs ON cs.contract_id = c.id
   WHERE c.id <> NEW.id
     AND c.contract_type = 'lease'
     AND c.status = 'active'
     AND cs.entity_type = 'unit'
     AND cs.entity_id = v_unit_id
     AND c.start_date IS NOT NULL
     AND c.end_date IS NOT NULL
     AND daterange(c.start_date, c.end_date, '[]') &&
         daterange(NEW.start_date, NEW.end_date, '[]')
   LIMIT 1;

  IF v_conflict.contract_number IS NOT NULL THEN
    RAISE EXCEPTION
      'Unit already has an active lease % from % to %. Resolve the existing lease before activating this one.',
      v_conflict.contract_number, v_conflict.start_date, v_conflict.end_date
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER check_lease_overlap
  AFTER UPDATE OF status, start_date, end_date ON public.contracts
  FOR EACH ROW
  WHEN (NEW.contract_type = 'lease' AND NEW.status = 'active')
  EXECUTE FUNCTION public.check_no_overlapping_active_lease();