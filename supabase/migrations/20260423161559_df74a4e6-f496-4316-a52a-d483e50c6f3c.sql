-- Composite workflow upgrades: per-step cost & approval, sequential gating helpers

-- 1. Add cost & approval columns to steps
ALTER TABLE public.service_request_steps
  ADD COLUMN IF NOT EXISTS cost_estimate numeric,
  ADD COLUMN IF NOT EXISTS cost_final numeric,
  ADD COLUMN IF NOT EXISTS approval_status public.service_request_approval_status NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS approval_required_reason text,
  ADD COLUMN IF NOT EXISTS approval_threshold_amount numeric,
  ADD COLUMN IF NOT EXISTS approval_threshold_currency text,
  ADD COLUMN IF NOT EXISTS approval_rule_snapshot text,
  ADD COLUMN IF NOT EXISTS approval_management_agreement_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approval_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS approval_decided_at timestamptz,
  ADD COLUMN IF NOT EXISTS approval_decided_by uuid,
  ADD COLUMN IF NOT EXISTS approval_decision_notes text;

CREATE INDEX IF NOT EXISTS idx_service_request_steps_approval_status ON public.service_request_steps(approval_status);

-- 2. Helper: compute approval for a step (mirrors the request-level eval)
CREATE OR REPLACE FUNCTION public.evaluate_service_request_step_approval(p_step_id uuid)
RETURNS public.service_request_approval_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_step public.service_request_steps%ROWTYPE;
  v_req  public.service_requests%ROWTYPE;
  v_ma_contract_id uuid;
  v_ma public.management_agreements%ROWTYPE;
  v_status public.service_request_approval_status := 'not_required';
  v_reason text;
BEGIN
  SELECT * INTO v_step FROM public.service_request_steps WHERE id = p_step_id;
  IF NOT FOUND THEN RETURN 'not_required'; END IF;

  SELECT * INTO v_req FROM public.service_requests WHERE id = v_step.request_id;
  IF NOT FOUND THEN RETURN 'not_required'; END IF;

  -- Only paid steps need approval
  IF v_step.billing <> 'paid' THEN
    UPDATE public.service_request_steps
    SET approval_status = 'not_required',
        approval_required_reason = NULL,
        approval_threshold_amount = NULL,
        approval_threshold_currency = NULL,
        approval_rule_snapshot = NULL,
        approval_management_agreement_id = NULL,
        approval_requested_at = NULL
    WHERE id = p_step_id
      AND approval_status <> 'not_required';
    RETURN 'not_required';
  END IF;

  -- Find applicable MA via the parent request's target
  v_ma_contract_id := public.find_applicable_management_agreement(v_req.target_type, v_req.target_id);
  IF v_ma_contract_id IS NULL THEN
    RETURN COALESCE(v_step.approval_status, 'not_required');
  END IF;

  SELECT * INTO v_ma FROM public.management_agreements WHERE contract_id = v_ma_contract_id;

  IF v_ma.approval_rule = 'auto_all' THEN
    v_status := 'not_required';
    v_reason := NULL;
  ELSIF v_ma.approval_rule = 'always_required' THEN
    v_status := 'pending';
    v_reason := 'Landlord requires approval for all paid work';
  ELSIF v_ma.approval_rule = 'auto_threshold' THEN
    IF v_step.cost_estimate IS NOT NULL
       AND v_ma.approval_threshold_amount IS NOT NULL
       AND v_step.cost_estimate > v_ma.approval_threshold_amount THEN
      v_status := 'pending';
      v_reason := 'Estimate exceeds threshold of '
        || COALESCE(v_ma.approval_threshold_currency, 'AED') || ' '
        || v_ma.approval_threshold_amount::text;
    ELSE
      v_status := 'not_required';
    END IF;
  END IF;

  -- Preserve already-decided status unless cost/billing changed
  IF v_step.approval_status IN ('approved','rejected') AND v_status = 'pending' THEN
    RETURN v_step.approval_status;
  END IF;

  UPDATE public.service_request_steps
  SET approval_status = v_status,
      approval_required_reason = v_reason,
      approval_rule_snapshot = v_ma.approval_rule::text,
      approval_threshold_amount = v_ma.approval_threshold_amount,
      approval_threshold_currency = v_ma.approval_threshold_currency,
      approval_management_agreement_id = v_ma_contract_id,
      approval_requested_at = CASE WHEN v_status = 'pending' AND v_step.approval_requested_at IS NULL
                                   THEN now() ELSE v_step.approval_requested_at END
  WHERE id = p_step_id;

  RETURN v_status;
END;
$$;

-- 3. Trigger to evaluate on insert / cost / billing change
CREATE OR REPLACE FUNCTION public.trg_eval_step_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT'
     OR NEW.cost_estimate IS DISTINCT FROM OLD.cost_estimate
     OR NEW.billing IS DISTINCT FROM OLD.billing THEN
    PERFORM public.evaluate_service_request_step_approval(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS service_request_steps_eval_approval ON public.service_request_steps;
CREATE TRIGGER service_request_steps_eval_approval
AFTER INSERT OR UPDATE OF cost_estimate, billing
ON public.service_request_steps
FOR EACH ROW
EXECUTE FUNCTION public.trg_eval_step_approval();

-- 4. Decide / reset RPCs for step-level approval
CREATE OR REPLACE FUNCTION public.decide_service_request_step_approval(
  p_step_id uuid,
  p_decision text,
  p_notes text DEFAULT NULL
) RETURNS public.service_request_approval_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status public.service_request_approval_status;
BEGIN
  IF p_decision NOT IN ('approved','rejected') THEN
    RAISE EXCEPTION 'Invalid decision: %', p_decision;
  END IF;

  UPDATE public.service_request_steps
  SET approval_status = p_decision::public.service_request_approval_status,
      approval_decided_at = now(),
      approval_decided_by = auth.uid(),
      approval_decision_notes = p_notes
  WHERE id = p_step_id
    AND approval_status = 'pending'
  RETURNING approval_status INTO v_status;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Step is not awaiting approval';
  END IF;

  INSERT INTO public.service_request_events (request_id, step_id, event_type, from_value, to_value, description)
  SELECT request_id, id, 'step_approval_decision', 'pending', p_decision, p_notes
  FROM public.service_request_steps WHERE id = p_step_id;

  RETURN v_status;
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_service_request_step_approval(p_step_id uuid)
RETURNS public.service_request_approval_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_status public.service_request_approval_status;
BEGIN
  UPDATE public.service_request_steps
  SET approval_status = 'not_required',
      approval_decided_at = NULL,
      approval_decided_by = NULL,
      approval_decision_notes = NULL,
      approval_requested_at = NULL
  WHERE id = p_step_id;

  v_status := public.evaluate_service_request_step_approval(p_step_id);

  INSERT INTO public.service_request_events (request_id, step_id, event_type, description)
  SELECT request_id, id, 'step_approval_reset', 'Approval re-requested'
  FROM public.service_request_steps WHERE id = p_step_id;

  RETURN v_status;
END;
$$;

-- 5. RPC to add an ad-hoc step mid-workflow
CREATE OR REPLACE FUNCTION public.add_service_request_step(
  p_request_id uuid,
  p_title text,
  p_category public.service_category,
  p_delivery public.service_delivery DEFAULT 'staff',
  p_billing public.service_billing DEFAULT 'free',
  p_blocks_next boolean DEFAULT false,
  p_typical_duration_days integer DEFAULT NULL,
  p_cost_estimate numeric DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_next_order int;
  v_key text;
BEGIN
  SELECT COALESCE(MAX(sort_order), 0) + 10 INTO v_next_order
  FROM public.service_request_steps WHERE request_id = p_request_id;

  v_key := 'adhoc_' || substr(md5(random()::text || clock_timestamp()::text), 1, 8);

  INSERT INTO public.service_request_steps (
    request_id, step_key, title, sort_order, category, delivery, billing,
    blocks_next, typical_duration_days, cost_estimate
  )
  VALUES (
    p_request_id, v_key, p_title, v_next_order, p_category, p_delivery, p_billing,
    p_blocks_next, p_typical_duration_days, p_cost_estimate
  )
  RETURNING id INTO v_id;

  -- Mark parent as workflow if not already
  UPDATE public.service_requests SET is_workflow = true WHERE id = p_request_id AND is_workflow = false;

  INSERT INTO public.service_request_events (request_id, step_id, event_type, description, to_value)
  VALUES (p_request_id, v_id, 'step_added', 'Ad-hoc step added', p_title);

  RETURN v_id;
END;
$$;

-- 6. RPC to reorder steps
CREATE OR REPLACE FUNCTION public.reorder_service_request_steps(
  p_request_id uuid,
  p_step_ids uuid[]
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE i int;
BEGIN
  FOR i IN 1..array_length(p_step_ids, 1) LOOP
    UPDATE public.service_request_steps
    SET sort_order = i * 10
    WHERE id = p_step_ids[i] AND request_id = p_request_id;
  END LOOP;
END;
$$;

-- 7. RPC: rollup of a request (used to gate sequential progression)
CREATE OR REPLACE FUNCTION public.get_request_rollup(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total int;
  v_completed int;
  v_pending_approval int;
  v_blocked_by_step uuid;
BEGIN
  SELECT COUNT(*) FILTER (WHERE TRUE),
         COUNT(*) FILTER (WHERE status IN ('completed','skipped')),
         COUNT(*) FILTER (WHERE approval_status = 'pending')
  INTO v_total, v_completed, v_pending_approval
  FROM public.service_request_steps WHERE request_id = p_request_id;

  -- First step that blocks_next and is incomplete
  SELECT id INTO v_blocked_by_step
  FROM public.service_request_steps
  WHERE request_id = p_request_id
    AND blocks_next = true
    AND status NOT IN ('completed','skipped')
  ORDER BY sort_order
  LIMIT 1;

  RETURN jsonb_build_object(
    'total', v_total,
    'completed', v_completed,
    'pending_approval', v_pending_approval,
    'first_blocking_step_id', v_blocked_by_step
  );
END;
$$;