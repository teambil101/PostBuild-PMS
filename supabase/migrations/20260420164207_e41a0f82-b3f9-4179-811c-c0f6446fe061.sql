-- =========================================================
-- LEADS MODULE — Schema (L1)
-- =========================================================

-- ---------------------------------------------------------
-- 1. leads table
-- ---------------------------------------------------------
CREATE TABLE public.leads (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_number                 text NOT NULL UNIQUE,

  -- Identity
  primary_contact_id          uuid NOT NULL,
  company_id                  uuid NULL,

  -- Source
  source                      text NOT NULL DEFAULT 'other',
  source_details              text NULL,

  -- Pipeline state
  status                      text NOT NULL DEFAULT 'new',
  stage_entered_at            timestamptz NOT NULL DEFAULT now(),
  assignee_id                 uuid NULL,

  -- Sizing
  property_count_estimated    integer NULL,
  portfolio_description       text NULL,
  estimated_annual_fee        numeric(12,2) NULL,
  currency                    text NOT NULL DEFAULT 'AED',
  probability_percent         integer NULL,
  target_close_date           date NULL,

  -- Proposed mgmt agreement terms (pre-fill for L2 wizard)
  proposed_fee_model          text NULL,
  proposed_fee_value          numeric(12,2) NULL,
  proposed_fee_applies_to     text NULL,
  proposed_duration_months    integer NULL,
  proposed_scope_of_services  jsonb NOT NULL DEFAULT '[]'::jsonb,
  proposed_terms_notes        text NULL,

  -- Outcome
  won_contract_id             uuid NULL,
  won_at                      timestamptz NULL,
  lost_reason                 text NULL,
  lost_reason_notes           text NULL,
  lost_at                     timestamptz NULL,

  -- On-hold tracking
  hold_reason                 text NULL,
  hold_since                  timestamptz NULL,
  pre_hold_status             text NULL,

  -- General
  notes                       text NULL,
  created_by                  uuid NULL,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),

  -- Foreign keys
  CONSTRAINT leads_primary_contact_id_fkey
    FOREIGN KEY (primary_contact_id) REFERENCES public.people(id) ON DELETE RESTRICT,
  CONSTRAINT leads_company_id_fkey
    FOREIGN KEY (company_id) REFERENCES public.people(id) ON DELETE SET NULL,
  CONSTRAINT leads_assignee_id_fkey
    FOREIGN KEY (assignee_id) REFERENCES public.people(id) ON DELETE SET NULL,
  CONSTRAINT leads_won_contract_id_fkey
    FOREIGN KEY (won_contract_id) REFERENCES public.contracts(id) ON DELETE SET NULL,

  -- Enum checks
  CONSTRAINT leads_source_check
    CHECK (source IN ('referral','inbound','cold_outreach','event','website','broker_intro','partner','other')),
  CONSTRAINT leads_status_check
    CHECK (status IN ('new','qualified','discovery','proposal','negotiating','on_hold','contract_signed','lost')),
  CONSTRAINT leads_proposed_fee_model_check
    CHECK (proposed_fee_model IS NULL OR proposed_fee_model IN ('percentage_of_rent','flat_annual','flat_per_unit','hybrid')),
  CONSTRAINT leads_proposed_fee_applies_to_check
    CHECK (proposed_fee_applies_to IS NULL OR proposed_fee_applies_to IN ('contracted_rent','collected_rent')),
  CONSTRAINT leads_lost_reason_check
    CHECK (lost_reason IS NULL OR lost_reason IN ('price','scope_mismatch','chose_competitor','timing','withdrew','unresponsive','other')),
  CONSTRAINT leads_pre_hold_status_check
    CHECK (pre_hold_status IS NULL OR pre_hold_status IN ('new','qualified','discovery','proposal','negotiating')),

  -- Range checks
  CONSTRAINT leads_property_count_check
    CHECK (property_count_estimated IS NULL OR property_count_estimated >= 0),
  CONSTRAINT leads_estimated_annual_fee_check
    CHECK (estimated_annual_fee IS NULL OR estimated_annual_fee >= 0),
  CONSTRAINT leads_probability_check
    CHECK (probability_percent IS NULL OR (probability_percent BETWEEN 0 AND 100)),
  CONSTRAINT leads_proposed_duration_check
    CHECK (proposed_duration_months IS NULL OR proposed_duration_months > 0),
  CONSTRAINT leads_currency_length_check
    CHECK (char_length(currency) = 3),

  -- Biconditional: contract_signed iff won_contract_id set
  CONSTRAINT leads_contract_signed_biconditional
    CHECK ((status = 'contract_signed') = (won_contract_id IS NOT NULL)),

  -- Terminal/paused state consistency
  CONSTRAINT leads_won_at_consistency
    CHECK ((status = 'contract_signed' AND won_at IS NOT NULL)
        OR (status <> 'contract_signed')),
  CONSTRAINT leads_lost_at_consistency
    CHECK ((status = 'lost' AND lost_at IS NOT NULL)
        OR (status <> 'lost')),
  CONSTRAINT leads_hold_since_consistency
    CHECK ((status = 'on_hold' AND hold_since IS NOT NULL)
        OR (status <> 'on_hold'))
);

-- Indexes
CREATE INDEX idx_leads_status_stage_entered ON public.leads (status, stage_entered_at);
CREATE INDEX idx_leads_assignee_status      ON public.leads (assignee_id, status);
CREATE INDEX idx_leads_primary_contact      ON public.leads (primary_contact_id);
CREATE INDEX idx_leads_company              ON public.leads (company_id) WHERE company_id IS NOT NULL;
CREATE INDEX idx_leads_won_contract         ON public.leads (won_contract_id) WHERE won_contract_id IS NOT NULL;

-- ---------------------------------------------------------
-- 2. lead_events table
-- ---------------------------------------------------------
CREATE TABLE public.lead_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id      uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  event_type   text NOT NULL,
  from_value   text NULL,
  to_value     text NULL,
  description  text NULL,
  actor_id     uuid NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT lead_events_event_type_check
    CHECK (event_type IN (
      'created','status_changed','assignee_changed','contact_changed',
      'proposal_updated','estimate_updated','target_close_changed',
      'put_on_hold','resumed_from_hold','marked_contract_signed',
      'marked_lost','updated'
    ))
);

CREATE INDEX idx_lead_events_lead_created ON public.lead_events (lead_id, created_at DESC);

-- ---------------------------------------------------------
-- 3. RLS — leads
-- ---------------------------------------------------------
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view leads"
  ON public.leads FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid()));

CREATE POLICY "Staff/admin can insert leads"
  ON public.leads FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Staff/admin can update leads"
  ON public.leads FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Admin can delete leads"
  ON public.leads FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ---------------------------------------------------------
-- 4. RLS — lead_events
-- ---------------------------------------------------------
ALTER TABLE public.lead_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view lead_events"
  ON public.lead_events FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid()));

CREATE POLICY "Staff/admin can insert lead_events"
  ON public.lead_events FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Admin can delete lead_events"
  ON public.lead_events FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ---------------------------------------------------------
-- 5. Trigger: updated_at
-- ---------------------------------------------------------
CREATE TRIGGER trg_update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------
-- 6. Trigger: lifecycle timestamps
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.manage_lead_lifecycle_timestamps()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    -- Status changed → reset stage age
    NEW.stage_entered_at := now();

    -- Entering on_hold: capture pre-hold stage
    IF NEW.status = 'on_hold' THEN
      NEW.hold_since := COALESCE(NEW.hold_since, now());
      IF OLD.status NOT IN ('on_hold','contract_signed','lost') THEN
        NEW.pre_hold_status := OLD.status;
      END IF;
    END IF;

    -- Leaving on_hold: clear hold_since (preserve hold_reason in audit)
    IF OLD.status = 'on_hold' AND NEW.status <> 'on_hold' THEN
      NEW.hold_since := NULL;
      NEW.pre_hold_status := NULL;
    END IF;

    -- Entering / leaving contract_signed
    IF NEW.status = 'contract_signed' THEN
      NEW.won_at := COALESCE(NEW.won_at, now());
    ELSIF OLD.status = 'contract_signed' THEN
      NEW.won_at := NULL;
    END IF;

    -- Entering / leaving lost
    IF NEW.status = 'lost' THEN
      NEW.lost_at := COALESCE(NEW.lost_at, now());
    ELSIF OLD.status = 'lost' THEN
      NEW.lost_at := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_manage_lead_lifecycle_timestamps
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.manage_lead_lifecycle_timestamps();

-- ---------------------------------------------------------
-- 7. Trigger: log lead_events
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_lead_events()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_changed boolean := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.lead_events (lead_id, event_type, to_value, actor_id)
    VALUES (NEW.id, 'created', NEW.status, v_actor);
    RETURN NEW;
  END IF;

  -- Status change → specialized + generic
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'contract_signed' THEN
      INSERT INTO public.lead_events (lead_id, event_type, from_value, to_value, actor_id)
      VALUES (NEW.id, 'marked_contract_signed', OLD.status, NEW.status, v_actor);
    ELSIF NEW.status = 'lost' THEN
      INSERT INTO public.lead_events (lead_id, event_type, from_value, to_value, description, actor_id)
      VALUES (NEW.id, 'marked_lost', OLD.status, NEW.status, NEW.lost_reason, v_actor);
    ELSIF NEW.status = 'on_hold' THEN
      INSERT INTO public.lead_events (lead_id, event_type, from_value, to_value, description, actor_id)
      VALUES (NEW.id, 'put_on_hold', OLD.status, NEW.status, NEW.hold_reason, v_actor);
    ELSIF OLD.status = 'on_hold' THEN
      INSERT INTO public.lead_events (lead_id, event_type, from_value, to_value, actor_id)
      VALUES (NEW.id, 'resumed_from_hold', OLD.status, NEW.status, v_actor);
    ELSE
      INSERT INTO public.lead_events (lead_id, event_type, from_value, to_value, actor_id)
      VALUES (NEW.id, 'status_changed', OLD.status, NEW.status, v_actor);
    END IF;
    v_changed := true;
  END IF;

  -- Assignee
  IF NEW.assignee_id IS DISTINCT FROM OLD.assignee_id THEN
    INSERT INTO public.lead_events (lead_id, event_type, from_value, to_value, actor_id)
    VALUES (NEW.id, 'assignee_changed', OLD.assignee_id::text, NEW.assignee_id::text, v_actor);
    v_changed := true;
  END IF;

  -- Contact / company
  IF NEW.primary_contact_id IS DISTINCT FROM OLD.primary_contact_id
     OR NEW.company_id IS DISTINCT FROM OLD.company_id THEN
    INSERT INTO public.lead_events (lead_id, event_type, from_value, to_value, actor_id)
    VALUES (NEW.id, 'contact_changed',
            COALESCE(OLD.primary_contact_id::text,'') || '/' || COALESCE(OLD.company_id::text,''),
            COALESCE(NEW.primary_contact_id::text,'') || '/' || COALESCE(NEW.company_id::text,''),
            v_actor);
    v_changed := true;
  END IF;

  -- Proposed terms
  IF NEW.proposed_fee_model IS DISTINCT FROM OLD.proposed_fee_model
     OR NEW.proposed_fee_value IS DISTINCT FROM OLD.proposed_fee_value
     OR NEW.proposed_fee_applies_to IS DISTINCT FROM OLD.proposed_fee_applies_to
     OR NEW.proposed_duration_months IS DISTINCT FROM OLD.proposed_duration_months
     OR NEW.proposed_scope_of_services IS DISTINCT FROM OLD.proposed_scope_of_services
     OR NEW.proposed_terms_notes IS DISTINCT FROM OLD.proposed_terms_notes THEN
    INSERT INTO public.lead_events (lead_id, event_type, actor_id)
    VALUES (NEW.id, 'proposal_updated', v_actor);
    v_changed := true;
  END IF;

  -- Estimate / probability
  IF NEW.estimated_annual_fee IS DISTINCT FROM OLD.estimated_annual_fee
     OR NEW.probability_percent IS DISTINCT FROM OLD.probability_percent THEN
    INSERT INTO public.lead_events (lead_id, event_type, from_value, to_value, actor_id)
    VALUES (NEW.id, 'estimate_updated',
            COALESCE(OLD.estimated_annual_fee::text,'') || '@' || COALESCE(OLD.probability_percent::text,''),
            COALESCE(NEW.estimated_annual_fee::text,'') || '@' || COALESCE(NEW.probability_percent::text,''),
            v_actor);
    v_changed := true;
  END IF;

  -- Target close date
  IF NEW.target_close_date IS DISTINCT FROM OLD.target_close_date THEN
    INSERT INTO public.lead_events (lead_id, event_type, from_value, to_value, actor_id)
    VALUES (NEW.id, 'target_close_changed', OLD.target_close_date::text, NEW.target_close_date::text, v_actor);
    v_changed := true;
  END IF;

  -- Other fields → single 'updated' event if anything else changed
  IF NOT v_changed AND (
       NEW.source IS DISTINCT FROM OLD.source
    OR NEW.source_details IS DISTINCT FROM OLD.source_details
    OR NEW.property_count_estimated IS DISTINCT FROM OLD.property_count_estimated
    OR NEW.portfolio_description IS DISTINCT FROM OLD.portfolio_description
    OR NEW.currency IS DISTINCT FROM OLD.currency
    OR NEW.notes IS DISTINCT FROM OLD.notes
    OR NEW.hold_reason IS DISTINCT FROM OLD.hold_reason
    OR NEW.lost_reason_notes IS DISTINCT FROM OLD.lost_reason_notes
  ) THEN
    INSERT INTO public.lead_events (lead_id, event_type, actor_id)
    VALUES (NEW.id, 'updated', v_actor);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_lead_events
  AFTER INSERT OR UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.log_lead_events();
