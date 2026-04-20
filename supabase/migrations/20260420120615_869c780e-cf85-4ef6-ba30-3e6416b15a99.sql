-- ============================================================
-- TICKETS MODULE FOUNDATION (T1)
-- ============================================================

-- ------------------------------------------------------------
-- 1. TICKETS TABLE
-- ------------------------------------------------------------
CREATE TABLE public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number text NOT NULL UNIQUE,
  subject text NOT NULL,
  description text,
  ticket_type text NOT NULL,
  priority text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'open',
  waiting_on text,
  target_entity_type text NOT NULL,
  target_entity_id uuid NOT NULL,
  parent_ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
  assignee_id uuid REFERENCES public.people(id),
  reporter_id uuid REFERENCES public.people(id),
  is_system_generated boolean NOT NULL DEFAULT false,
  due_date date,
  resolved_at timestamptz,
  closed_at timestamptz,
  cancelled_at timestamptz,
  cancelled_reason text,
  estimated_cost numeric(12,2),
  actual_cost numeric(12,2),
  currency text NOT NULL DEFAULT 'AED',
  cost_approval_status text,
  cost_approved_by_person_id uuid REFERENCES public.people(id),
  cost_approved_at timestamptz,
  cost_approval_notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT tickets_subject_length CHECK (length(subject) BETWEEN 2 AND 200),
  CONSTRAINT tickets_currency_length CHECK (length(currency) = 3),
  CONSTRAINT tickets_ticket_type_check CHECK (ticket_type IN (
    'maintenance_ac','maintenance_plumbing','maintenance_electrical',
    'maintenance_appliance','maintenance_structural',
    'maintenance_pest_control','maintenance_other',
    'admin_ejari','admin_dewa','admin_noc','admin_other',
    'request_renewal','request_early_termination','request_sublease',
    'request_modification','request_other',
    'compliance_reminder','rent_follow_up',
    'handover_task','moveout_task',
    'data_gap','complaint','other'
  )),
  CONSTRAINT tickets_priority_check CHECK (priority IN ('low','medium','high','urgent')),
  CONSTRAINT tickets_status_check CHECK (status IN ('open','in_progress','awaiting','resolved','closed','cancelled')),
  CONSTRAINT tickets_waiting_on_check CHECK (
    waiting_on IS NULL OR waiting_on IN ('tenant','landlord','vendor','internal','external')
  ),
  CONSTRAINT tickets_target_entity_type_check CHECK (
    target_entity_type IN ('unit','building','contract','person','cheque')
  ),
  CONSTRAINT tickets_cost_approval_status_check CHECK (
    cost_approval_status IS NULL OR cost_approval_status IN ('not_required','pending','approved','rejected')
  ),
  CONSTRAINT tickets_estimated_cost_nonneg CHECK (estimated_cost IS NULL OR estimated_cost >= 0),
  CONSTRAINT tickets_actual_cost_nonneg CHECK (actual_cost IS NULL OR actual_cost >= 0),
  CONSTRAINT tickets_waiting_on_consistency CHECK (
    (status = 'awaiting' AND waiting_on IS NOT NULL)
    OR (status <> 'awaiting' AND waiting_on IS NULL)
  ),
  CONSTRAINT tickets_cancelled_consistency CHECK (
    (status = 'cancelled' AND cancelled_at IS NOT NULL)
    OR status <> 'cancelled'
  )
);

-- Indexes
CREATE INDEX idx_tickets_status_priority_due ON public.tickets (status, priority, due_date);
CREATE INDEX idx_tickets_target ON public.tickets (target_entity_type, target_entity_id);
CREATE INDEX idx_tickets_assignee_status ON public.tickets (assignee_id, status);
CREATE INDEX idx_tickets_type_status ON public.tickets (ticket_type, status);
CREATE INDEX idx_tickets_system_generated_status ON public.tickets (is_system_generated, status);
CREATE INDEX idx_tickets_due_date_open ON public.tickets (due_date)
  WHERE status IN ('open','in_progress','awaiting');
CREATE INDEX idx_tickets_parent ON public.tickets (parent_ticket_id)
  WHERE parent_ticket_id IS NOT NULL;

-- ------------------------------------------------------------
-- 2. TICKET_EVENTS TABLE
-- ------------------------------------------------------------
CREATE TABLE public.ticket_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  from_value text,
  to_value text,
  description text,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT ticket_events_event_type_check CHECK (event_type IN (
    'created','status_changed','priority_changed',
    'assignee_changed','reporter_changed','target_changed',
    'due_date_changed','cost_estimated','cost_actual_recorded',
    'cost_approval_requested','cost_approval_approved',
    'cost_approval_rejected','reopened','updated'
  ))
);

CREATE INDEX idx_ticket_events_ticket_created ON public.ticket_events (ticket_id, created_at DESC);

-- ------------------------------------------------------------
-- 3. EXTEND POLYMORPHIC SHARED TABLES TO ALLOW 'ticket'
-- ------------------------------------------------------------

-- notes
ALTER TABLE public.notes DROP CONSTRAINT IF EXISTS notes_entity_type_check;
ALTER TABLE public.notes ADD CONSTRAINT notes_entity_type_check
  CHECK (entity_type IN ('building','unit','person','contract','ticket'));

-- documents
ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_entity_type_check;
ALTER TABLE public.documents ADD CONSTRAINT documents_entity_type_check
  CHECK (entity_type IN ('building','unit','contract','ticket'));

-- photos
ALTER TABLE public.photos DROP CONSTRAINT IF EXISTS photos_entity_type_check;
ALTER TABLE public.photos ADD CONSTRAINT photos_entity_type_check
  CHECK (entity_type IN ('building','unit','contract','ticket'));

-- ------------------------------------------------------------
-- 4. RLS
-- ------------------------------------------------------------
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_events ENABLE ROW LEVEL SECURITY;

-- tickets policies
CREATE POLICY "Auth users can view tickets"
  ON public.tickets FOR SELECT
  TO authenticated
  USING (has_any_role(auth.uid()));

CREATE POLICY "Staff/admin can insert tickets"
  ON public.tickets FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'staff'::app_role));

CREATE POLICY "Staff/admin can update tickets"
  ON public.tickets FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'staff'::app_role));

CREATE POLICY "Admin can delete tickets"
  ON public.tickets FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role));

-- ticket_events policies
CREATE POLICY "Auth users can view ticket_events"
  ON public.ticket_events FOR SELECT
  TO authenticated
  USING (has_any_role(auth.uid()));

CREATE POLICY "Admin can update ticket_events"
  ON public.ticket_events FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Admin can delete ticket_events"
  ON public.ticket_events FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role));

-- Note: no INSERT policy on ticket_events. Inserts happen exclusively
-- through the SECURITY DEFINER trigger function log_ticket_events().

-- ------------------------------------------------------------
-- 5. HELPER FUNCTION: get_applicable_repair_threshold
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_applicable_repair_threshold(
  p_entity_type text,
  p_entity_id uuid
) RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unit_id uuid;
  v_building_id uuid;
  v_threshold numeric;
BEGIN
  IF p_entity_type = 'unit' THEN
    v_unit_id := p_entity_id;
  ELSIF p_entity_type = 'building' THEN
    v_building_id := p_entity_id;
  ELSIF p_entity_type = 'contract' THEN
    SELECT entity_id INTO v_unit_id
      FROM contract_subjects
     WHERE contract_id = p_entity_id AND entity_type = 'unit'
     LIMIT 1;
    IF v_unit_id IS NULL THEN
      SELECT entity_id INTO v_building_id
        FROM contract_subjects
       WHERE contract_id = p_entity_id AND entity_type = 'building'
       LIMIT 1;
    END IF;
  ELSIF p_entity_type = 'cheque' THEN
    SELECT cs.entity_id INTO v_unit_id
      FROM lease_cheques lc
      JOIN leases l ON l.id = lc.lease_id
      JOIN contract_subjects cs ON cs.contract_id = l.contract_id AND cs.entity_type = 'unit'
     WHERE lc.id = p_entity_id
     LIMIT 1;
  ELSE
    RETURN NULL;
  END IF;

  IF v_unit_id IS NOT NULL AND v_building_id IS NULL THEN
    SELECT building_id INTO v_building_id FROM units WHERE id = v_unit_id;
  END IF;

  SELECT ma.repair_approval_threshold INTO v_threshold
    FROM contracts c
    JOIN management_agreements ma ON ma.contract_id = c.id
    JOIN contract_subjects cs ON cs.contract_id = c.id
   WHERE c.contract_type = 'management_agreement'
     AND c.status = 'active'
     AND ((cs.entity_type = 'unit' AND cs.entity_id = v_unit_id)
       OR (cs.entity_type = 'building' AND cs.entity_id = v_building_id))
   ORDER BY
     CASE WHEN cs.entity_type = 'unit' THEN 0 ELSE 1 END,
     c.start_date DESC NULLS LAST
   LIMIT 1;

  RETURN v_threshold;
END;
$$;

-- ------------------------------------------------------------
-- 6. HELPER FUNCTION: resolve_ticket_target_label
-- ------------------------------------------------------------
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
  ELSE
    RETURN NULL;
  END IF;

  RETURN v_label;
END;
$$;

-- ------------------------------------------------------------
-- 7. TRIGGER: updated_at bumping
-- ------------------------------------------------------------
CREATE TRIGGER update_tickets_updated_at
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------
-- 8. TRIGGER: lifecycle timestamps
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.manage_ticket_lifecycle_timestamps()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'resolved' AND (OLD.status IS NULL OR OLD.status <> 'resolved') THEN
    NEW.resolved_at = COALESCE(NEW.resolved_at, now());
  END IF;

  IF NEW.status = 'closed' AND (OLD.status IS NULL OR OLD.status <> 'closed') THEN
    NEW.closed_at = COALESCE(NEW.closed_at, now());
  END IF;

  IF NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status <> 'cancelled') THEN
    NEW.cancelled_at = COALESCE(NEW.cancelled_at, now());
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.status IN ('closed','cancelled')
     AND NEW.status NOT IN ('closed','cancelled') THEN
    NEW.closed_at = NULL;
    NEW.cancelled_at = NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER manage_ticket_lifecycle_timestamps
  BEFORE INSERT OR UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.manage_ticket_lifecycle_timestamps();

-- ------------------------------------------------------------
-- 9. TRIGGER: auto cost approval status
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auto_set_cost_approval_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_threshold numeric;
BEGIN
  IF NEW.ticket_type NOT LIKE 'maintenance_%' OR NEW.estimated_cost IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.cost_approval_status IN ('approved','rejected') THEN
    RETURN NEW;
  END IF;

  v_threshold := public.get_applicable_repair_threshold(NEW.target_entity_type, NEW.target_entity_id);

  IF v_threshold IS NULL THEN
    NEW.cost_approval_status := 'pending';
  ELSIF NEW.estimated_cost > v_threshold THEN
    NEW.cost_approval_status := 'pending';
  ELSE
    NEW.cost_approval_status := 'not_required';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER auto_set_cost_approval_status
  BEFORE INSERT OR UPDATE OF estimated_cost, ticket_type, target_entity_type, target_entity_id
    ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_set_cost_approval_status();

-- ------------------------------------------------------------
-- 10. TRIGGER: log structural changes to ticket_events
-- ------------------------------------------------------------
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

CREATE TRIGGER log_ticket_events
  AFTER INSERT OR UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.log_ticket_events();