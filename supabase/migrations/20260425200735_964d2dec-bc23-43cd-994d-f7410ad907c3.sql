-- 1. Enums for tenant approval & schedule statuses
CREATE TYPE public.tenant_approval_status AS ENUM (
  'not_required',
  'pending',
  'approved',
  'rejected'
);

CREATE TYPE public.tenant_schedule_status AS ENUM (
  'none',
  'proposed',
  'confirmed',
  'rescheduled'
);

-- 2. Add columns to service_requests
ALTER TABLE public.service_requests
  ADD COLUMN tenant_approval_required boolean NOT NULL DEFAULT false,
  ADD COLUMN tenant_approval_status public.tenant_approval_status NOT NULL DEFAULT 'not_required',
  ADD COLUMN tenant_approval_reason text,
  ADD COLUMN tenant_approval_requested_at timestamptz,
  ADD COLUMN tenant_approval_decided_at timestamptz,
  ADD COLUMN tenant_approval_notes text,
  ADD COLUMN tenant_token text UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),

  ADD COLUMN proposed_scheduled_date date,
  ADD COLUMN tenant_schedule_status public.tenant_schedule_status NOT NULL DEFAULT 'none',
  ADD COLUMN tenant_proposed_date date,
  ADD COLUMN tenant_schedule_notes text,
  ADD COLUMN schedule_counter_round smallint NOT NULL DEFAULT 0,
  ADD COLUMN tenant_schedule_decided_at timestamptz;

CREATE INDEX idx_service_requests_tenant_token ON public.service_requests (tenant_token);
CREATE INDEX idx_service_requests_tenant_approval_status
  ON public.service_requests (tenant_approval_status)
  WHERE tenant_approval_status = 'pending';

-- Backfill tokens for any existing rows (DEFAULT only applies to new rows on some PG configs)
UPDATE public.service_requests
SET tenant_token = encode(gen_random_bytes(24), 'hex')
WHERE tenant_token IS NULL;

-- 3. Anonymous read when token is known (for the public tenant page)
CREATE POLICY "Anon can view by tenant_token"
ON public.service_requests
FOR SELECT
TO anon
USING (tenant_token IS NOT NULL);

-- 4. RPC: tenant approve/reject (callable by anon via the public page)
CREATE OR REPLACE FUNCTION public.decide_tenant_approval(
  p_token text,
  p_decision text,
  p_notes text DEFAULT NULL
)
RETURNS public.service_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.service_requests;
BEGIN
  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid decision: %', p_decision;
  END IF;

  SELECT * INTO v_req
  FROM public.service_requests
  WHERE tenant_token = p_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid token';
  END IF;

  IF v_req.tenant_approval_status NOT IN ('pending', 'rejected', 'approved') THEN
    RAISE EXCEPTION 'No tenant approval is required for this request';
  END IF;

  UPDATE public.service_requests
  SET tenant_approval_status = p_decision::public.tenant_approval_status,
      tenant_approval_decided_at = now(),
      tenant_approval_notes = COALESCE(p_notes, tenant_approval_notes),
      updated_at = now()
  WHERE id = v_req.id
  RETURNING * INTO v_req;

  -- Audit
  INSERT INTO public.service_request_events (request_id, event_type, description, to_value)
  VALUES (
    v_req.id,
    'tenant_approval_decision',
    CASE WHEN p_decision = 'approved'
         THEN 'Tenant approved'
         ELSE 'Tenant rejected'
    END || COALESCE(' — ' || p_notes, ''),
    p_decision
  );

  RETURN v_req;
END;
$$;

GRANT EXECUTE ON FUNCTION public.decide_tenant_approval(text, text, text) TO anon, authenticated;

-- 5. RPC: tenant confirms or counter-proposes a date
CREATE OR REPLACE FUNCTION public.respond_to_schedule(
  p_token text,
  p_action text,           -- 'confirm' | 'counter'
  p_counter_date date DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS public.service_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.service_requests;
  v_max_rounds CONSTANT smallint := 2;
BEGIN
  IF p_action NOT IN ('confirm', 'counter') THEN
    RAISE EXCEPTION 'Invalid action: %', p_action;
  END IF;

  SELECT * INTO v_req
  FROM public.service_requests
  WHERE tenant_token = p_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid token';
  END IF;

  IF v_req.tenant_schedule_status NOT IN ('proposed', 'rescheduled') THEN
    RAISE EXCEPTION 'No schedule is currently proposed';
  END IF;

  IF p_action = 'confirm' THEN
    UPDATE public.service_requests
    SET tenant_schedule_status = 'confirmed',
        scheduled_date = COALESCE(proposed_scheduled_date, scheduled_date),
        tenant_schedule_notes = COALESCE(p_notes, tenant_schedule_notes),
        tenant_schedule_decided_at = now(),
        updated_at = now()
    WHERE id = v_req.id
    RETURNING * INTO v_req;

    INSERT INTO public.service_request_events (request_id, event_type, description, to_value)
    VALUES (
      v_req.id,
      'tenant_schedule_confirmed',
      'Tenant confirmed schedule' || COALESCE(' — ' || p_notes, ''),
      to_char(v_req.scheduled_date, 'YYYY-MM-DD')
    );

  ELSE
    -- Counter-propose
    IF p_counter_date IS NULL THEN
      RAISE EXCEPTION 'Counter date is required when counter-proposing';
    END IF;
    IF v_req.schedule_counter_round >= v_max_rounds THEN
      RAISE EXCEPTION 'Maximum counter-propose rounds (%) reached. Please contact the property manager.', v_max_rounds;
    END IF;

    UPDATE public.service_requests
    SET tenant_schedule_status = 'rescheduled',
        tenant_proposed_date = p_counter_date,
        tenant_schedule_notes = COALESCE(p_notes, tenant_schedule_notes),
        schedule_counter_round = v_req.schedule_counter_round + 1,
        tenant_schedule_decided_at = now(),
        updated_at = now()
    WHERE id = v_req.id
    RETURNING * INTO v_req;

    INSERT INTO public.service_request_events (request_id, event_type, description, to_value)
    VALUES (
      v_req.id,
      'tenant_schedule_counter',
      'Tenant counter-proposed' || COALESCE(' — ' || p_notes, ''),
      to_char(p_counter_date, 'YYYY-MM-DD')
    );
  END IF;

  RETURN v_req;
END;
$$;

GRANT EXECUTE ON FUNCTION public.respond_to_schedule(text, text, date, text) TO anon, authenticated;

-- 6. Helper: staff propose a schedule (sets status to 'proposed' and records the date)
CREATE OR REPLACE FUNCTION public.propose_tenant_schedule(
  p_request_id uuid,
  p_date date,
  p_notes text DEFAULT NULL
)
RETURNS public.service_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.service_requests;
BEGIN
  UPDATE public.service_requests
  SET proposed_scheduled_date = p_date,
      tenant_schedule_status = 'proposed',
      tenant_schedule_notes = COALESCE(p_notes, tenant_schedule_notes),
      updated_at = now()
  WHERE id = p_request_id
  RETURNING * INTO v_req;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request % not found', p_request_id;
  END IF;

  INSERT INTO public.service_request_events (request_id, event_type, description, to_value)
  VALUES (
    p_request_id,
    'schedule_proposed_to_tenant',
    'Schedule proposed to tenant' || COALESCE(' — ' || p_notes, ''),
    to_char(p_date, 'YYYY-MM-DD')
  );

  RETURN v_req;
END;
$$;

GRANT EXECUTE ON FUNCTION public.propose_tenant_schedule(uuid, date, text) TO authenticated;

-- 7. Helper: staff request tenant approval (sets status to 'pending' with a reason)
CREATE OR REPLACE FUNCTION public.request_tenant_approval(
  p_request_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS public.service_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.service_requests;
BEGIN
  UPDATE public.service_requests
  SET tenant_approval_required = true,
      tenant_approval_status = 'pending',
      tenant_approval_reason = COALESCE(p_reason, tenant_approval_reason),
      tenant_approval_requested_at = now(),
      updated_at = now()
  WHERE id = p_request_id
  RETURNING * INTO v_req;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request % not found', p_request_id;
  END IF;

  INSERT INTO public.service_request_events (request_id, event_type, description, to_value)
  VALUES (
    p_request_id,
    'tenant_approval_requested',
    'Tenant approval requested' || COALESCE(' — ' || p_reason, ''),
    'pending'
  );

  RETURN v_req;
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_tenant_approval(uuid, text) TO authenticated;