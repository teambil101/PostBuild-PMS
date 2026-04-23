-- Lease subtype table
CREATE TABLE public.leases (
  contract_id uuid PRIMARY KEY REFERENCES public.contracts(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  
  -- Rent
  rent_amount numeric NOT NULL,
  rent_frequency text NOT NULL DEFAULT 'annual', -- annual, monthly, quarterly
  number_of_cheques integer DEFAULT 1,
  payment_method text DEFAULT 'cheque', -- cheque, bank_transfer, cash, card
  
  -- Deposits & fees
  security_deposit numeric,
  security_deposit_held_by text DEFAULT 'pm_company', -- pm_company, landlord
  commission_amount numeric,
  commission_paid_by text DEFAULT 'tenant', -- tenant, landlord, split
  
  -- Compliance
  ejari_number text,
  ejari_registered_date date,
  
  -- Period extras
  rent_free_days integer DEFAULT 0,
  grace_period_days integer DEFAULT 5,
  
  -- Renewal & termination
  auto_renew boolean NOT NULL DEFAULT false,
  renewal_notice_days integer DEFAULT 90,
  termination_notice_days integer DEFAULT 90,
  early_termination_penalty text,
  
  -- Notes
  payment_notes text,
  scope_notes text,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.leases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view leases"
  ON public.leases FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert leases"
  ON public.leases FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update leases"
  ON public.leases FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete leases"
  ON public.leases FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_leases_unit_id ON public.leases(unit_id);

-- Updated-at trigger (reuses existing function pattern)
CREATE OR REPLACE FUNCTION public.update_leases_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER leases_updated_at
  BEFORE UPDATE ON public.leases
  FOR EACH ROW EXECUTE FUNCTION public.update_leases_updated_at();

-- Sync unit status when a lease's contract status changes.
-- Active lease => unit = occupied
-- Lease ends (expired/terminated/cancelled) and no other active lease => unit = vacant
CREATE OR REPLACE FUNCTION public.sync_unit_status_from_lease()
RETURNS TRIGGER AS $$
DECLARE
  v_unit_id uuid;
  v_old_status public.contract_status;
  v_new_status public.contract_status;
  v_other_active_count integer;
  v_current_unit_status public.property_status;
BEGIN
  -- Only react to status transitions on lease contracts
  IF NEW.contract_type <> 'lease' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  v_old_status := CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END;
  v_new_status := NEW.status;

  SELECT unit_id INTO v_unit_id FROM public.leases WHERE contract_id = NEW.id;
  IF v_unit_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT status INTO v_current_unit_status FROM public.units WHERE id = v_unit_id;

  -- Lease became active
  IF v_new_status = 'active' AND v_current_unit_status <> 'occupied' THEN
    UPDATE public.units SET status = 'occupied' WHERE id = v_unit_id;
    INSERT INTO public.unit_status_history (unit_id, old_status, new_status, reason)
    VALUES (v_unit_id, v_current_unit_status, 'occupied', 'Lease ' || NEW.contract_number || ' activated');
  END IF;

  -- Lease ended
  IF v_old_status = 'active' AND v_new_status IN ('expired', 'terminated', 'cancelled') THEN
    SELECT COUNT(*) INTO v_other_active_count
      FROM public.leases l
      JOIN public.contracts c ON c.id = l.contract_id
     WHERE l.unit_id = v_unit_id
       AND c.id <> NEW.id
       AND c.status = 'active';
    IF v_other_active_count = 0 AND v_current_unit_status = 'occupied' THEN
      UPDATE public.units SET status = 'vacant' WHERE id = v_unit_id;
      INSERT INTO public.unit_status_history (unit_id, old_status, new_status, reason)
      VALUES (v_unit_id, 'occupied', 'vacant', 'Lease ' || NEW.contract_number || ' ' || v_new_status);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER contracts_sync_unit_status
  AFTER INSERT OR UPDATE OF status ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.sync_unit_status_from_lease();