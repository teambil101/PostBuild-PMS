-- 1. Approval status enum
DO $$ BEGIN
  CREATE TYPE public.service_request_approval_status AS ENUM (
    'not_required',
    'pending',
    'approved',
    'rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Add approval columns to service_requests
ALTER TABLE public.service_requests
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

CREATE INDEX IF NOT EXISTS idx_service_requests_approval_status
  ON public.service_requests (approval_status)
  WHERE approval_status = 'pending';

-- 3. Helper: find the applicable active management agreement for a target
-- For a unit: look at active MAs whose contract_subjects include this unit OR its building.
-- For a building: look at active MAs whose contract_subjects include this building.
CREATE OR REPLACE FUNCTION public.find_applicable_management_agreement(
  p_target_type text,
  p_target_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_building_id uuid;
  v_contract_id uuid;
BEGIN
  IF p_target_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF p_target_type = 'unit' THEN
    SELECT building_id INTO v_building_id FROM public.units WHERE id = p_target_id;

    SELECT c.id INTO v_contract_id
    FROM public.contracts c
    JOIN public.contract_subjects cs ON cs.contract_id = c.id
    WHERE c.contract_type = 'management_agreement'
      AND c.status = 'active'
      AND (
        (cs.subject_type = 'unit' AND cs.subject_id = p_target_id)
        OR (cs.subject_type = 'building' AND v_building_id IS NOT NULL AND cs.subject_id = v_building_id)
      )
    ORDER BY
      CASE WHEN cs.subject_type = 'unit' THEN 0 ELSE 1 END,
      c.start_date DESC NULLS LAST
    LIMIT 1;

    RETURN v_contract_id;
  ELSIF p_target_type = 'building' THEN
    SELECT c.id INTO v_contract_id
    FROM public.contracts c
    JOIN public.contract_subjects cs ON cs.contract_id = c.id
    WHERE c.contract_type = 'management_agreement'
      AND c.status = 'active'
      AND cs.subject_type = 'building'
      AND cs.subject_id = p_target_id
    ORDER BY c.start_date DESC NULLS LAST
    LIMIT 1;

    RETURN v_contract_id;
  END IF;

  RETURN NULL;
END;
$$;

-- 4. Helper: evaluate whether a service request needs approval, and stamp the columns
CREATE OR REPLACE FUNCTION public.evaluate_service_request_approval(
  p_request_id uuid
)
RETURNS public.service_request_approval_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.service_requests%ROWTYPE;
  v_ma_contract_id uuid;
  v_ma public.management_agreements%ROWTYPE;
  v_required boolean := false;
  v_reason text;
  v_status public.service_request_approval_status := 'not_required';
BEGIN
  SELECT * INTO v_req FROM public.service_requests WHERE id = p_request_id;
  IF NOT FOUND THEN RETURN 'not_required'; END IF;

  -- Only paid / pass-through can need approval
  IF v_req.billing NOT IN ('paid', 'pass_through') THEN
    UPDATE public.service_requests
    SET approval_status = 'not_required',
        approval_required_reason = NULL,
        approval_management_agreement_id = NULL,
        approval_threshold_amount = NULL,
        approval_threshold_currency = NULL,
        approval_rule_snapshot = NULL
    WHERE id = p_request_id;
    RETURN 'not_required';
  END IF;

  v_ma_contract_id := public.find_applicable_management_agreement(v_req.target_type, v_req.target_id);

  IF v_ma_contract_id IS NULL THEN
    -- No MA in force: default to not requiring approval (PM acts at own discretion)
    UPDATE public.service_requests
    SET approval_status = 'not_required',
        approval_required_reason = 'No active management agreement covers this target',
        approval_management_agreement_id = NULL,
        approval_threshold_amount = NULL,
        approval_threshold_currency = NULL,
        approval_rule_snapshot = NULL
    WHERE id = p_request_id;
    RETURN 'not_required';
  END IF;

  SELECT * INTO v_ma FROM public.management_agreements WHERE contract_id = v_ma_contract_id;

  IF v_ma.approval_rule = 'auto_all' THEN
    v_required := false;
    v_reason := 'MA auto-approves all paid work';
  ELSIF v_ma.approval_rule = 'always_required' THEN
    v_required := true;
    v_reason := 'MA requires landlord approval for all paid work';
  ELSIF v_ma.approval_rule = 'auto_threshold' THEN
    IF v_ma.approval_threshold_amount IS NULL THEN
      -- Misconfigured: no threshold set, fall back to requiring approval
      v_required := true;
      v_reason := 'MA threshold rule with no threshold configured';
    ELSIF COALESCE(v_req.cost_estimate, 0) >= v_ma.approval_threshold_amount THEN
      v_required := true;
      v_reason := format('Estimate %s ≥ threshold %s %s',
        COALESCE(v_req.cost_estimate, 0),
        v_ma.approval_threshold_amount,
        COALESCE(v_ma.approval_threshold_currency, 'AED'));
    ELSE
      v_required := false;
      v_reason := format('Estimate %s under threshold %s %s',
        COALESCE(v_req.cost_estimate, 0),
        v_ma.approval_threshold_amount,
        COALESCE(v_ma.approval_threshold_currency, 'AED'));
    END IF;
  END IF;

  IF v_required THEN
    -- Preserve existing decision if already approved/rejected
    IF v_req.approval_status IN ('approved', 'rejected') THEN
      v_status := v_req.approval_status;
    ELSE
      v_status := 'pending';
    END IF;
  ELSE
    v_status := 'not_required';
  END IF;

  UPDATE public.service_requests
  SET approval_status = v_status,
      approval_required_reason = v_reason,
      approval_management_agreement_id = v_ma_contract_id,
      approval_threshold_amount = v_ma.approval_threshold_amount,
      approval_threshold_currency = v_ma.approval_threshold_currency,
      approval_rule_snapshot = v_ma.approval_rule::text,
      approval_requested_at = CASE
        WHEN v_status = 'pending' AND v_req.approval_requested_at IS NULL THEN now()
        ELSE v_req.approval_requested_at
      END
  WHERE id = p_request_id;

  RETURN v_status;
END;
$$;

-- 5. Trigger: auto-evaluate on insert and on relevant updates
CREATE OR REPLACE FUNCTION public.trg_service_requests_evaluate_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Defer to after-insert/after-update; call evaluate which does its own UPDATE
  PERFORM public.evaluate_service_request_approval(NEW.id);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS service_requests_evaluate_approval_aft_ins ON public.service_requests;
CREATE TRIGGER service_requests_evaluate_approval_aft_ins
AFTER INSERT ON public.service_requests
FOR EACH ROW
EXECUTE FUNCTION public.trg_service_requests_evaluate_approval();

DROP TRIGGER IF EXISTS service_requests_evaluate_approval_aft_upd ON public.service_requests;
CREATE TRIGGER service_requests_evaluate_approval_aft_upd
AFTER UPDATE OF billing, cost_estimate, target_type, target_id ON public.service_requests
FOR EACH ROW
WHEN (
  NEW.billing IS DISTINCT FROM OLD.billing
  OR NEW.cost_estimate IS DISTINCT FROM OLD.cost_estimate
  OR NEW.target_type IS DISTINCT FROM OLD.target_type
  OR NEW.target_id IS DISTINCT FROM OLD.target_id
)
EXECUTE FUNCTION public.trg_service_requests_evaluate_approval();

-- 6. Decision RPC
CREATE OR REPLACE FUNCTION public.decide_service_request_approval(
  p_request_id uuid,
  p_decision text,            -- 'approved' or 'rejected'
  p_notes text DEFAULT NULL
)
RETURNS public.service_request_approval_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.service_requests%ROWTYPE;
  v_decision public.service_request_approval_status;
  v_actor_person uuid;
BEGIN
  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Decision must be approved or rejected';
  END IF;
  v_decision := p_decision::public.service_request_approval_status;

  SELECT * INTO v_req FROM public.service_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Service request not found';
  END IF;

  IF v_req.approval_status NOT IN ('pending', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'Service request does not require approval';
  END IF;

  -- Resolve actor to a person id when possible (for audit)
  v_actor_person := public.current_user_person_id();

  UPDATE public.service_requests
  SET approval_status = v_decision,
      approval_decided_at = now(),
      approval_decided_by = v_actor_person,
      approval_decision_notes = NULLIF(trim(coalesce(p_notes, '')), '')
  WHERE id = p_request_id;

  INSERT INTO public.service_request_events (
    request_id, event_type, description, from_value, to_value, actor_id
  ) VALUES (
    p_request_id,
    'approval_decision',
    CASE WHEN v_decision = 'approved' THEN 'Approved by landlord' ELSE 'Rejected by landlord' END,
    v_req.approval_status::text,
    v_decision::text,
    v_actor_person
  );

  RETURN v_decision;
END;
$$;

-- 7. Re-request approval (e.g. after estimate changes)
CREATE OR REPLACE FUNCTION public.reset_service_request_approval(p_request_id uuid)
RETURNS public.service_request_approval_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid;
BEGIN
  v_actor := public.current_user_person_id();
  UPDATE public.service_requests
  SET approval_status = 'pending',
      approval_decided_at = NULL,
      approval_decided_by = NULL,
      approval_decision_notes = NULL,
      approval_requested_at = now()
  WHERE id = p_request_id
    AND approval_status IN ('approved', 'rejected', 'pending');

  INSERT INTO public.service_request_events (request_id, event_type, description, actor_id)
  VALUES (p_request_id, 'approval_reset', 'Approval reset / re-requested', v_actor);

  RETURN public.evaluate_service_request_approval(p_request_id);
END;
$$;