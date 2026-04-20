-- =========================================
-- VENDORS
-- =========================================
CREATE TABLE public.vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_number text NOT NULL UNIQUE,
  legal_name text NOT NULL,
  display_name text,
  vendor_type text NOT NULL,
  trade_license_number text,
  trade_license_authority text,
  trade_license_expiry_date date,
  trn text,
  insurance_provider text,
  insurance_policy_number text,
  insurance_expiry_date date,
  insurance_coverage_notes text,
  primary_phone text,
  primary_email text,
  website text,
  address text,
  specialties jsonb NOT NULL DEFAULT '[]'::jsonb,
  specialties_other text,
  default_hourly_rate numeric(10,2),
  default_call_out_fee numeric(10,2),
  currency text NOT NULL DEFAULT 'AED',
  rate_notes text,
  service_area_notes text,
  status text NOT NULL DEFAULT 'active',
  is_preferred boolean NOT NULL DEFAULT false,
  blacklist_reason text,
  onboarded_at date,
  onboarded_by uuid,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vendors_legal_name_length CHECK (char_length(legal_name) BETWEEN 2 AND 200),
  CONSTRAINT vendors_currency_length CHECK (char_length(currency) = 3),
  CONSTRAINT vendors_type_check CHECK (vendor_type IN ('company', 'individual')),
  CONSTRAINT vendors_status_check CHECK (status IN ('active', 'inactive', 'blacklisted')),
  CONSTRAINT vendors_hourly_rate_check CHECK (default_hourly_rate IS NULL OR default_hourly_rate >= 0),
  CONSTRAINT vendors_call_out_check CHECK (default_call_out_fee IS NULL OR default_call_out_fee >= 0),
  CONSTRAINT vendors_blacklist_reason_check CHECK (
    (status = 'blacklisted' AND blacklist_reason IS NOT NULL AND char_length(blacklist_reason) > 0)
    OR status <> 'blacklisted'
  )
);

CREATE INDEX idx_vendors_status_pref_name ON public.vendors (status, is_preferred DESC, legal_name);
CREATE INDEX idx_vendors_specialties ON public.vendors USING GIN (specialties);
CREATE INDEX idx_vendors_license_expiry ON public.vendors (trade_license_expiry_date) WHERE trade_license_expiry_date IS NOT NULL;
CREATE INDEX idx_vendors_insurance_expiry ON public.vendors (insurance_expiry_date) WHERE insurance_expiry_date IS NOT NULL;

ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view vendors"
  ON public.vendors FOR SELECT TO authenticated
  USING (has_any_role(auth.uid()));

CREATE POLICY "Staff/admin can insert vendors"
  ON public.vendors FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'staff'::app_role));

CREATE POLICY "Staff/admin can update vendors"
  ON public.vendors FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'staff'::app_role));

CREATE POLICY "Admin can delete vendors"
  ON public.vendors FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER trg_vendors_updated_at
  BEFORE UPDATE ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-assign vendor_number when not provided
CREATE OR REPLACE FUNCTION public.assign_vendor_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.vendor_number IS NULL OR NEW.vendor_number = '' THEN
    NEW.vendor_number := next_number('VND', EXTRACT(YEAR FROM now())::int);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_vendors_assign_number
  BEFORE INSERT ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.assign_vendor_number();

-- =========================================
-- VENDOR CONTACTS
-- =========================================
CREATE TABLE public.vendor_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE RESTRICT,
  role text NOT NULL DEFAULT 'primary',
  is_primary boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vendor_contacts_role_check CHECK (
    role IN ('primary','operations','accounts','emergency','technical','other')
  ),
  CONSTRAINT vendor_contacts_unique_link UNIQUE (vendor_id, person_id)
);

CREATE UNIQUE INDEX idx_vendor_contacts_one_primary
  ON public.vendor_contacts (vendor_id)
  WHERE is_primary = true;

CREATE INDEX idx_vendor_contacts_vendor ON public.vendor_contacts (vendor_id, is_primary DESC);
CREATE INDEX idx_vendor_contacts_person ON public.vendor_contacts (person_id);

ALTER TABLE public.vendor_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view vendor_contacts"
  ON public.vendor_contacts FOR SELECT TO authenticated
  USING (has_any_role(auth.uid()));

CREATE POLICY "Staff/admin can insert vendor_contacts"
  ON public.vendor_contacts FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'staff'::app_role));

CREATE POLICY "Staff/admin can update vendor_contacts"
  ON public.vendor_contacts FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'staff'::app_role));

CREATE POLICY "Admin can delete vendor_contacts"
  ON public.vendor_contacts FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'staff'::app_role));

-- Enforce one primary per vendor by demoting other primaries
CREATE OR REPLACE FUNCTION public.enforce_one_primary_contact_per_vendor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_primary = true THEN
    UPDATE public.vendor_contacts
       SET is_primary = false
     WHERE vendor_id = NEW.vendor_id
       AND id <> NEW.id
       AND is_primary = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_vendor_contacts_one_primary
  BEFORE INSERT OR UPDATE OF is_primary ON public.vendor_contacts
  FOR EACH ROW
  WHEN (NEW.is_primary = true)
  EXECUTE FUNCTION public.enforce_one_primary_contact_per_vendor();

-- =========================================
-- VENDOR EVENTS (lightweight audit log)
-- =========================================
CREATE TABLE public.vendor_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  from_value text,
  to_value text,
  description text,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vendor_events_type_check CHECK (
    event_type IN ('created','status_changed','blacklisted','reactivated',
                   'preferred_changed','compliance_updated','updated')
  )
);

CREATE INDEX idx_vendor_events_vendor ON public.vendor_events (vendor_id, created_at DESC);

ALTER TABLE public.vendor_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view vendor_events"
  ON public.vendor_events FOR SELECT TO authenticated
  USING (has_any_role(auth.uid()));

CREATE POLICY "Staff/admin can insert vendor_events"
  ON public.vendor_events FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'staff'::app_role));

-- Auto log creation + notable changes
CREATE OR REPLACE FUNCTION public.log_vendor_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.vendor_events (vendor_id, event_type, to_value, description, actor_id)
    VALUES (NEW.id, 'created', NEW.status, 'Vendor created', v_actor);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF NEW.status = 'blacklisted' THEN
        INSERT INTO public.vendor_events (vendor_id, event_type, from_value, to_value, description, actor_id)
        VALUES (NEW.id, 'blacklisted', OLD.status, NEW.status, NEW.blacklist_reason, v_actor);
      ELSIF OLD.status = 'inactive' AND NEW.status = 'active' THEN
        INSERT INTO public.vendor_events (vendor_id, event_type, from_value, to_value, description, actor_id)
        VALUES (NEW.id, 'reactivated', OLD.status, NEW.status, 'Vendor reactivated', v_actor);
      ELSE
        INSERT INTO public.vendor_events (vendor_id, event_type, from_value, to_value, description, actor_id)
        VALUES (NEW.id, 'status_changed', OLD.status, NEW.status, NULL, v_actor);
      END IF;
    END IF;

    IF NEW.is_preferred IS DISTINCT FROM OLD.is_preferred THEN
      INSERT INTO public.vendor_events (vendor_id, event_type, from_value, to_value, description, actor_id)
      VALUES (NEW.id, 'preferred_changed', OLD.is_preferred::text, NEW.is_preferred::text,
              CASE WHEN NEW.is_preferred THEN 'Marked as preferred' ELSE 'Removed from preferred' END,
              v_actor);
    END IF;

    IF (NEW.trade_license_expiry_date IS DISTINCT FROM OLD.trade_license_expiry_date)
       OR (NEW.insurance_expiry_date IS DISTINCT FROM OLD.insurance_expiry_date)
       OR (NEW.trade_license_number IS DISTINCT FROM OLD.trade_license_number)
       OR (NEW.insurance_policy_number IS DISTINCT FROM OLD.insurance_policy_number) THEN
      INSERT INTO public.vendor_events (vendor_id, event_type, description, actor_id)
      VALUES (NEW.id, 'compliance_updated', 'Compliance fields updated', v_actor);
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_vendors_log_insert
  AFTER INSERT ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.log_vendor_event();

CREATE TRIGGER trg_vendors_log_update
  AFTER UPDATE ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.log_vendor_event();

-- =========================================
-- Extend polymorphic entity_type CHECKs
-- =========================================
ALTER TABLE public.notes DROP CONSTRAINT IF EXISTS notes_entity_type_check;
ALTER TABLE public.notes ADD CONSTRAINT notes_entity_type_check
  CHECK (entity_type IN ('building','unit','person','contract','ticket','vendor'));

ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_entity_type_check;
ALTER TABLE public.documents ADD CONSTRAINT documents_entity_type_check
  CHECK (entity_type IN ('building','unit','contract','ticket','vendor'));

ALTER TABLE public.photos DROP CONSTRAINT IF EXISTS photos_entity_type_check;
ALTER TABLE public.photos ADD CONSTRAINT photos_entity_type_check
  CHECK (entity_type IN ('building','unit','contract','ticket','vendor'));