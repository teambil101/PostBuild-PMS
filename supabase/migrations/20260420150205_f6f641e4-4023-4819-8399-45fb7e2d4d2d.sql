-- ============================================================
-- VENDORS V2 — ticket integration
-- ============================================================

-- 1. vendor_id on tickets
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS vendor_id uuid
    REFERENCES public.vendors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_vendor_status
  ON public.tickets (vendor_id, status)
  WHERE vendor_id IS NOT NULL;

-- 2. Allow 'vendor' as target_entity_type
ALTER TABLE public.tickets
  DROP CONSTRAINT IF EXISTS tickets_target_entity_type_check;

ALTER TABLE public.tickets
  ADD CONSTRAINT tickets_target_entity_type_check CHECK (
    target_entity_type IN ('unit','building','contract','person','cheque','vendor')
  );

-- 3. Extend ticket_events allowed event types (include all existing + new vendor events)
ALTER TABLE public.ticket_events
  DROP CONSTRAINT IF EXISTS ticket_events_event_type_check;

ALTER TABLE public.ticket_events
  ADD CONSTRAINT ticket_events_event_type_check CHECK (event_type IN (
    'created','status_changed','priority_changed',
    'assignee_changed','reporter_changed','target_changed',
    'due_date_changed','cost_estimated','cost_actual_recorded',
    'cost_approval_requested','cost_approval_approved',
    'cost_approval_rejected','reopened','updated',
    'vendor_assigned','vendor_changed','vendor_removed',
    'workflow_initialized','workflow_changed','workflow_removed',
    'workflow_completed','stage_started','stage_advanced','stage_completed',
    'step_completed','step_skipped'
  ));

-- 4. Extend log_ticket_events trigger to log vendor changes
CREATE OR REPLACE FUNCTION public.log_ticket_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_type text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO ticket_events (ticket_id, event_type, to_value, actor_id)
    VALUES (NEW.id, 'created', NEW.status, NEW.created_by);
    RETURN NEW;
  END IF;

  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO ticket_events (ticket_id, event_type, from_value, to_value, actor_id)
    VALUES (NEW.id, 'status_changed', OLD.status, NEW.status, auth.uid());

    IF OLD.status IN ('closed','cancelled') AND NEW.status NOT IN ('closed','cancelled') THEN
      INSERT INTO ticket_events (ticket_id, event_type, actor_id, description)
      VALUES (NEW.id, 'reopened', auth.uid(), 'Ticket reopened');
    END IF;
  END IF;

  IF OLD.priority IS DISTINCT FROM NEW.priority THEN
    INSERT INTO ticket_events (ticket_id, event_type, from_value, to_value, actor_id)
    VALUES (NEW.id, 'priority_changed', OLD.priority, NEW.priority, auth.uid());
  END IF;

  IF OLD.assignee_id IS DISTINCT FROM NEW.assignee_id THEN
    INSERT INTO ticket_events (ticket_id, event_type, from_value, to_value, actor_id)
    VALUES (NEW.id, 'assignee_changed', OLD.assignee_id::text, NEW.assignee_id::text, auth.uid());
  END IF;

  IF OLD.reporter_id IS DISTINCT FROM NEW.reporter_id THEN
    INSERT INTO ticket_events (ticket_id, event_type, from_value, to_value, actor_id)
    VALUES (NEW.id, 'reporter_changed', OLD.reporter_id::text, NEW.reporter_id::text, auth.uid());
  END IF;

  IF OLD.vendor_id IS DISTINCT FROM NEW.vendor_id THEN
    IF OLD.vendor_id IS NULL AND NEW.vendor_id IS NOT NULL THEN
      v_event_type := 'vendor_assigned';
    ELSIF OLD.vendor_id IS NOT NULL AND NEW.vendor_id IS NULL THEN
      v_event_type := 'vendor_removed';
    ELSE
      v_event_type := 'vendor_changed';
    END IF;
    INSERT INTO ticket_events (ticket_id, event_type, from_value, to_value, actor_id)
    VALUES (NEW.id, v_event_type, OLD.vendor_id::text, NEW.vendor_id::text, auth.uid());
  END IF;

  IF OLD.target_entity_type IS DISTINCT FROM NEW.target_entity_type
     OR OLD.target_entity_id IS DISTINCT FROM NEW.target_entity_id THEN
    INSERT INTO ticket_events (ticket_id, event_type, from_value, to_value, actor_id, description)
    VALUES (NEW.id, 'target_changed',
            OLD.target_entity_type || ':' || OLD.target_entity_id::text,
            NEW.target_entity_type || ':' || NEW.target_entity_id::text,
            auth.uid(),
            'Target changed');
  END IF;

  IF OLD.due_date IS DISTINCT FROM NEW.due_date THEN
    INSERT INTO ticket_events (ticket_id, event_type, from_value, to_value, actor_id)
    VALUES (NEW.id, 'due_date_changed', OLD.due_date::text, NEW.due_date::text, auth.uid());
  END IF;

  IF OLD.estimated_cost IS DISTINCT FROM NEW.estimated_cost THEN
    INSERT INTO ticket_events (ticket_id, event_type, from_value, to_value, actor_id)
    VALUES (NEW.id, 'cost_estimated', OLD.estimated_cost::text, NEW.estimated_cost::text, auth.uid());
  END IF;

  IF OLD.actual_cost IS DISTINCT FROM NEW.actual_cost THEN
    INSERT INTO ticket_events (ticket_id, event_type, from_value, to_value, actor_id)
    VALUES (NEW.id, 'cost_actual_recorded', OLD.actual_cost::text, NEW.actual_cost::text, auth.uid());
  END IF;

  IF OLD.cost_approval_status IS DISTINCT FROM NEW.cost_approval_status THEN
    v_event_type := CASE NEW.cost_approval_status
      WHEN 'pending' THEN 'cost_approval_requested'
      WHEN 'approved' THEN 'cost_approval_approved'
      WHEN 'rejected' THEN 'cost_approval_rejected'
      ELSE NULL
    END;
    IF v_event_type IS NOT NULL THEN
      INSERT INTO ticket_events (ticket_id, event_type, from_value, to_value, actor_id)
      VALUES (NEW.id, v_event_type, OLD.cost_approval_status, NEW.cost_approval_status, auth.uid());
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 5. Extend resolve_ticket_target_label for 'vendor'
CREATE OR REPLACE FUNCTION public.resolve_ticket_target_label(
  p_entity_type text,
  p_entity_id uuid
) RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_label text;
BEGIN
  IF p_entity_type = 'unit' THEN
    SELECT 'Unit ' || u.unit_number || ' · ' || b.name
      INTO v_label
      FROM units u
      JOIN buildings b ON b.id = u.building_id
     WHERE u.id = p_entity_id;
  ELSIF p_entity_type = 'building' THEN
    SELECT b.name INTO v_label FROM buildings b WHERE b.id = p_entity_id;
  ELSIF p_entity_type = 'contract' THEN
    SELECT
      CASE c.contract_type
        WHEN 'lease' THEN 'Lease ' || c.contract_number
        WHEN 'management_agreement' THEN 'Management Agreement ' || c.contract_number
        ELSE initcap(replace(c.contract_type,'_',' ')) || ' ' || c.contract_number
      END
      INTO v_label
      FROM contracts c
     WHERE c.id = p_entity_id;
  ELSIF p_entity_type = 'person' THEN
    SELECT trim(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,''))
      INTO v_label
      FROM people p
     WHERE p.id = p_entity_id;
  ELSIF p_entity_type = 'cheque' THEN
    SELECT 'Cheque #' || lc.sequence_number || ' · ' || c.contract_number
      INTO v_label
      FROM lease_cheques lc
      JOIN leases l ON l.id = lc.lease_id
      JOIN contracts c ON c.id = l.contract_id
     WHERE lc.id = p_entity_id;
  ELSIF p_entity_type = 'vendor' THEN
    SELECT COALESCE(NULLIF(trim(v.display_name), ''), v.legal_name) || ' · ' || v.vendor_number
      INTO v_label
      FROM vendors v
     WHERE v.id = p_entity_id;
  ELSE
    RETURN NULL;
  END IF;

  RETURN v_label;
END;
$$;

-- 6. Cost approval ↔ Vendor Dispatch workflow step sync
CREATE OR REPLACE FUNCTION public.sync_vendor_workflow_approval_step()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.workflow_key IS DISTINCT FROM 'vendor_dispatch' THEN
    RETURN NEW;
  END IF;

  IF OLD.cost_approval_status IS DISTINCT FROM NEW.cost_approval_status THEN
    IF NEW.cost_approval_status = 'approved' THEN
      UPDATE ticket_workflow_steps
         SET status = 'complete',
             completed_at = now(),
             completed_by = auth.uid(),
             note = COALESCE(note, 'Auto-completed via cost approval')
       WHERE ticket_id = NEW.id
         AND step_key = 'vendor_quote_landlord_approval'
         AND status = 'pending';
    ELSIF NEW.cost_approval_status = 'not_required' THEN
      UPDATE ticket_workflow_steps
         SET status = 'skipped',
             completed_at = now(),
             completed_by = auth.uid(),
             note = 'Auto-skipped: cost below threshold'
       WHERE ticket_id = NEW.id
         AND step_key = 'vendor_quote_landlord_approval'
         AND status = 'pending';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_vendor_workflow_approval_step ON public.tickets;

CREATE TRIGGER sync_vendor_workflow_approval_step
  AFTER UPDATE OF cost_approval_status ON public.tickets
  FOR EACH ROW
  WHEN (NEW.workflow_key = 'vendor_dispatch')
  EXECUTE FUNCTION public.sync_vendor_workflow_approval_step();
