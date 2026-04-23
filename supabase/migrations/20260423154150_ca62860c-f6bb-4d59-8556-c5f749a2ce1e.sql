-- Enums
CREATE TYPE public.service_request_status AS ENUM (
  'open', 'scheduled', 'in_progress', 'blocked', 'completed', 'cancelled'
);

CREATE TYPE public.service_request_priority AS ENUM (
  'low', 'normal', 'high', 'urgent'
);

CREATE TYPE public.service_request_step_status AS ENUM (
  'pending', 'in_progress', 'blocked', 'completed', 'skipped'
);

-- Main service request table
CREATE TABLE public.service_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number text NOT NULL UNIQUE,
  catalog_id uuid REFERENCES public.service_catalog(id) ON DELETE SET NULL,
  -- Snapshot of catalog at creation (so future catalog edits don't mutate history)
  title text NOT NULL,
  category public.service_category NOT NULL,
  is_workflow boolean NOT NULL DEFAULT false,
  -- Target (unit OR building OR portfolio-level)
  target_type text NOT NULL CHECK (target_type IN ('unit', 'building', 'portfolio')),
  target_id uuid, -- nullable for portfolio-level
  -- Status & scheduling
  status public.service_request_status NOT NULL DEFAULT 'open',
  priority public.service_request_priority NOT NULL DEFAULT 'normal',
  scheduled_date date,
  started_at timestamptz,
  completed_at timestamptz,
  -- Delivery / billing snapshot
  delivery public.service_delivery NOT NULL DEFAULT 'staff',
  billing public.service_billing NOT NULL DEFAULT 'free',
  assigned_vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  assigned_person_id uuid REFERENCES public.people(id) ON DELETE SET NULL,
  -- Origin
  requested_by_person_id uuid REFERENCES public.people(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'staff' CHECK (source IN ('staff', 'tenant_portal', 'email', 'phone', 'automation', 'other')),
  -- Money
  cost_estimate numeric,
  cost_final numeric,
  currency text NOT NULL DEFAULT 'AED',
  -- Notes
  description text,
  internal_notes text,
  -- Audit
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_service_requests_status ON public.service_requests(status);
CREATE INDEX idx_service_requests_target ON public.service_requests(target_type, target_id);
CREATE INDEX idx_service_requests_assigned_vendor ON public.service_requests(assigned_vendor_id);
CREATE INDEX idx_service_requests_assigned_person ON public.service_requests(assigned_person_id);
CREATE INDEX idx_service_requests_catalog ON public.service_requests(catalog_id);

-- Workflow steps (only populated when is_workflow=true)
CREATE TABLE public.service_request_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
  step_key text NOT NULL,
  title text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  category public.service_category NOT NULL,
  delivery public.service_delivery NOT NULL DEFAULT 'staff',
  billing public.service_billing NOT NULL DEFAULT 'free',
  blocks_next boolean NOT NULL DEFAULT false,
  typical_duration_days integer,
  status public.service_request_step_status NOT NULL DEFAULT 'pending',
  assigned_vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  assigned_person_id uuid REFERENCES public.people(id) ON DELETE SET NULL,
  scheduled_date date,
  completed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(request_id, step_key)
);

CREATE INDEX idx_service_request_steps_request ON public.service_request_steps(request_id, sort_order);

-- Audit events
CREATE TABLE public.service_request_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
  step_id uuid REFERENCES public.service_request_steps(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  description text,
  from_value text,
  to_value text,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_service_request_events_request ON public.service_request_events(request_id, created_at DESC);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_service_requests_touch
BEFORE UPDATE ON public.service_requests
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_service_request_steps_touch
BEFORE UPDATE ON public.service_request_steps
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- RLS
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_request_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_request_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view service_requests" ON public.service_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert service_requests" ON public.service_requests FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update service_requests" ON public.service_requests FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete service_requests" ON public.service_requests FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated can view service_request_steps" ON public.service_request_steps FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert service_request_steps" ON public.service_request_steps FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update service_request_steps" ON public.service_request_steps FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete service_request_steps" ON public.service_request_steps FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated can view service_request_events" ON public.service_request_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert service_request_events" ON public.service_request_events FOR INSERT TO authenticated WITH CHECK (true);

-- Helper: create a request from a catalog entry, exploding workflow steps if present.
CREATE OR REPLACE FUNCTION public.create_service_request_from_catalog(
  p_catalog_id uuid,
  p_target_type text,
  p_target_id uuid,
  p_priority public.service_request_priority DEFAULT 'normal',
  p_scheduled_date date DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_assigned_vendor_id uuid DEFAULT NULL,
  p_assigned_person_id uuid DEFAULT NULL,
  p_requested_by_person_id uuid DEFAULT NULL,
  p_source text DEFAULT 'staff',
  p_cost_estimate numeric DEFAULT NULL,
  p_override_title text DEFAULT NULL,
  p_internal_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_catalog public.service_catalog%ROWTYPE;
  v_request_id uuid;
  v_request_number text;
  v_year integer := EXTRACT(YEAR FROM now())::integer;
  v_step jsonb;
  v_idx integer := 0;
BEGIN
  SELECT * INTO v_catalog FROM public.service_catalog WHERE id = p_catalog_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Catalog entry not found: %', p_catalog_id;
  END IF;

  v_request_number := public.next_number('SRQ', v_year);

  INSERT INTO public.service_requests (
    request_number, catalog_id, title, category, is_workflow,
    target_type, target_id, priority, scheduled_date,
    delivery, billing, assigned_vendor_id, assigned_person_id,
    requested_by_person_id, source, cost_estimate,
    description, internal_notes
  ) VALUES (
    v_request_number, v_catalog.id,
    COALESCE(p_override_title, v_catalog.name),
    v_catalog.category, v_catalog.is_workflow,
    p_target_type, p_target_id, p_priority, p_scheduled_date,
    v_catalog.default_delivery, v_catalog.default_billing,
    p_assigned_vendor_id, p_assigned_person_id,
    p_requested_by_person_id, p_source, p_cost_estimate,
    p_description, p_internal_notes
  )
  RETURNING id INTO v_request_id;

  -- If workflow, explode steps
  IF v_catalog.is_workflow THEN
    FOR v_step IN SELECT * FROM jsonb_array_elements(v_catalog.workflow_steps)
    LOOP
      INSERT INTO public.service_request_steps (
        request_id, step_key, title, sort_order, category,
        delivery, billing, blocks_next, typical_duration_days
      ) VALUES (
        v_request_id,
        v_step->>'key',
        v_step->>'title',
        v_idx,
        (v_step->>'category')::public.service_category,
        (v_step->>'default_delivery')::public.service_delivery,
        (v_step->>'default_billing')::public.service_billing,
        COALESCE((v_step->>'blocks_next')::boolean, false),
        NULLIF(v_step->>'typical_duration_days', '')::integer
      );
      v_idx := v_idx + 1;
    END LOOP;
  END IF;

  -- Audit
  INSERT INTO public.service_request_events (request_id, event_type, description, to_value)
  VALUES (v_request_id, 'created', 'Request created from catalog', v_request_number);

  RETURN v_request_id;
END;
$$;