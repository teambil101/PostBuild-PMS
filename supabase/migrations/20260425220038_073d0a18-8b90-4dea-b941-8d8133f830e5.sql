-- ============================================================
-- 1. Extend create_service_request_from_catalog
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_service_request_from_catalog(
  p_catalog_id uuid,
  p_target_type text,
  p_target_id uuid,
  p_priority service_request_priority DEFAULT 'normal',
  p_scheduled_date date DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_assigned_vendor_id uuid DEFAULT NULL,
  p_assigned_person_id uuid DEFAULT NULL,
  p_requested_by_person_id uuid DEFAULT NULL,
  p_source text DEFAULT 'staff',
  p_cost_estimate numeric DEFAULT NULL,
  p_override_title text DEFAULT NULL,
  p_internal_notes text DEFAULT NULL,
  p_bill_to_mode public.bill_to_mode DEFAULT 'landlord_only',
  p_landlord_share_percent numeric DEFAULT 100,
  p_tenant_share_percent numeric DEFAULT 0,
  p_auto_invite_vendors boolean DEFAULT true,
  p_service_area_city text DEFAULT NULL,
  p_service_area_community text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_catalog public.service_catalog%ROWTYPE;
  v_step_catalog public.service_catalog%ROWTYPE;
  v_request_id uuid;
  v_request_number text;
  v_year integer := EXTRACT(YEAR FROM now())::integer;
  v_step jsonb;
  v_idx integer := 0;
  v_catalog_id_text text;
  v_legacy_bill_to public.bill_to_role;
  v_city text := p_service_area_city;
  v_community text := p_service_area_community;
BEGIN
  SELECT * INTO v_catalog FROM public.service_catalog WHERE id = p_catalog_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Catalog entry not found: %', p_catalog_id; END IF;

  v_request_number := public.next_number('SRQ', v_year);

  -- Map mode to legacy single bill_to (kept for back-compat)
  v_legacy_bill_to := CASE p_bill_to_mode
    WHEN 'tenant_only' THEN 'tenant'::public.bill_to_role
    ELSE 'landlord'::public.bill_to_role
  END;

  -- Resolve service area from unit/property if not passed
  IF v_city IS NULL AND p_target_type = 'unit' AND p_target_id IS NOT NULL THEN
    SELECT b.city, b.community
      INTO v_city, v_community
      FROM units u JOIN buildings b ON b.id = u.building_id
     WHERE u.id = p_target_id;
  ELSIF v_city IS NULL AND p_target_type = 'building' AND p_target_id IS NOT NULL THEN
    SELECT city, community INTO v_city, v_community FROM buildings WHERE id = p_target_id;
  END IF;

  INSERT INTO public.service_requests (
    request_number, catalog_id, title, category, category_other, is_workflow,
    target_type, target_id, priority, scheduled_date,
    delivery, billing, assigned_vendor_id, assigned_person_id,
    requested_by_person_id, source, cost_estimate,
    description, internal_notes,
    bill_to, bill_to_mode, landlord_share_percent, tenant_share_percent,
    auto_invite_vendors, service_area_city, service_area_community
  ) VALUES (
    v_request_number, v_catalog.id,
    COALESCE(p_override_title, v_catalog.name),
    v_catalog.category, v_catalog.category_other, v_catalog.is_workflow,
    p_target_type, p_target_id, p_priority, p_scheduled_date,
    v_catalog.default_delivery, v_catalog.default_billing,
    p_assigned_vendor_id, p_assigned_person_id,
    p_requested_by_person_id, p_source, p_cost_estimate,
    p_description, p_internal_notes,
    v_legacy_bill_to, p_bill_to_mode, p_landlord_share_percent, p_tenant_share_percent,
    p_auto_invite_vendors, v_city, v_community
  )
  RETURNING id INTO v_request_id;

  -- Workflow steps
  IF v_catalog.is_workflow THEN
    FOR v_step IN SELECT * FROM jsonb_array_elements(v_catalog.workflow_steps)
    LOOP
      v_catalog_id_text := NULLIF(v_step->>'catalog_id', '');
      IF v_catalog_id_text IS NOT NULL THEN
        SELECT * INTO v_step_catalog FROM public.service_catalog WHERE id = v_catalog_id_text::uuid;
        IF NOT FOUND THEN RAISE EXCEPTION 'Workflow step references missing catalog entry %', v_catalog_id_text; END IF;
        INSERT INTO public.service_request_steps (
          request_id, step_key, title, sort_order, category, category_other,
          delivery, billing, blocks_next, typical_duration_days
        ) VALUES (
          v_request_id,
          COALESCE(NULLIF(v_step->>'key',''), v_step_catalog.code),
          COALESCE(NULLIF(v_step->>'title_override',''), v_step_catalog.name),
          v_idx, v_step_catalog.category, v_step_catalog.category_other,
          v_step_catalog.default_delivery, v_step_catalog.default_billing,
          COALESCE((v_step->>'blocks_next')::boolean, false),
          COALESCE(NULLIF(v_step->>'duration_override_days','')::integer, v_step_catalog.typical_duration_days)
        );
      ELSE
        INSERT INTO public.service_request_steps (
          request_id, step_key, title, sort_order, category, category_other,
          delivery, billing, blocks_next, typical_duration_days
        ) VALUES (
          v_request_id, v_step->>'key', v_step->>'title', v_idx,
          (v_step->>'category')::public.service_category,
          NULLIF(v_step->>'category_other',''),
          COALESCE((v_step->>'default_delivery')::public.service_delivery, 'staff'),
          COALESCE((v_step->>'default_billing')::public.service_billing, 'free'),
          COALESCE((v_step->>'blocks_next')::boolean, false),
          NULLIF(v_step->>'typical_duration_days','')::integer
        );
      END IF;
      v_idx := v_idx + 1;
    END LOOP;
  END IF;

  INSERT INTO public.service_request_events (request_id, event_type, description, to_value)
  VALUES (v_request_id, 'created', 'Request created from catalog', v_request_number);

  RETURN v_request_id;
END $$;

-- ============================================================
-- 2. Pick a winning quote -> open cost approvals
-- ============================================================
CREATE OR REPLACE FUNCTION public.select_winning_quote(
  p_request_id uuid,
  p_quote_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sr public.service_requests%ROWTYPE;
  q  public.service_request_quotes%ROWTYPE;
BEGIN
  SELECT * INTO sr FROM service_requests WHERE id = p_request_id;
  SELECT * INTO q  FROM service_request_quotes WHERE id = p_quote_id;
  IF q.request_id <> p_request_id THEN
    RAISE EXCEPTION 'Quote does not belong to request';
  END IF;

  UPDATE service_requests
  SET winning_quote_id = p_quote_id,
      assigned_vendor_id = q.vendor_id,
      cost_estimate = COALESCE(q.amount, cost_estimate),
      landlord_cost_approval_status = CASE
        WHEN landlord_share_percent > 0 THEN 'pending'::public.party_cost_approval_status
        ELSE 'not_required' END,
      tenant_cost_approval_status = CASE
        WHEN tenant_share_percent > 0 THEN 'pending'::public.party_cost_approval_status
        ELSE 'not_required' END
  WHERE id = p_request_id;

  INSERT INTO public.service_request_events (request_id, event_type, description, to_value)
  VALUES (p_request_id, 'quote_winner_selected',
          'Winning quote selected; awaiting cost approval',
          COALESCE(q.amount::text, ''));
END $$;

-- ============================================================
-- 3. Respond to winning quote (party approval)
-- ============================================================
CREATE OR REPLACE FUNCTION public.respond_winning_quote(
  p_request_id uuid,
  p_role text,           -- 'landlord' | 'tenant'
  p_decision text,       -- 'approved' | 'rejected'
  p_notes text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sr public.service_requests%ROWTYPE;
  v_status public.party_cost_approval_status;
  q public.service_request_quotes%ROWTYPE;
BEGIN
  IF p_role NOT IN ('landlord','tenant') THEN
    RAISE EXCEPTION 'Invalid role: %', p_role;
  END IF;
  IF p_decision NOT IN ('approved','rejected') THEN
    RAISE EXCEPTION 'Invalid decision: %', p_decision;
  END IF;
  v_status := p_decision::public.party_cost_approval_status;

  IF p_role = 'landlord' THEN
    UPDATE service_requests
    SET landlord_cost_approval_status = v_status,
        landlord_cost_approved_at = CASE WHEN v_status = 'approved' THEN now() ELSE landlord_cost_approved_at END
    WHERE id = p_request_id;
  ELSE
    UPDATE service_requests
    SET tenant_cost_approval_status = v_status,
        tenant_cost_approved_at = CASE WHEN v_status = 'approved' THEN now() ELSE tenant_cost_approved_at END
    WHERE id = p_request_id;
  END IF;

  -- Audit
  INSERT INTO public.service_request_events (request_id, event_type, description, to_value)
  VALUES (p_request_id, 'cost_approval_' || p_decision,
          p_role || ' ' || p_decision || COALESCE(' — '||p_notes,''),
          p_role);

  -- Promote quote when both required parties have approved
  SELECT * INTO sr FROM service_requests WHERE id = p_request_id;
  IF sr.winning_quote_id IS NOT NULL
     AND sr.landlord_cost_approval_status IN ('approved','not_required')
     AND sr.tenant_cost_approval_status IN ('approved','not_required') THEN
    SELECT * INTO q FROM service_request_quotes WHERE id = sr.winning_quote_id;
    UPDATE service_request_quotes
       SET status = 'accepted', decided_at = now()
     WHERE id = sr.winning_quote_id AND status <> 'accepted';
    UPDATE service_requests
       SET status = CASE WHEN status = 'open' THEN 'scheduled'::public.service_request_status ELSE status END
     WHERE id = p_request_id;
    INSERT INTO public.service_request_events (request_id, event_type, description)
    VALUES (p_request_id, 'quote_accepted', 'All parties approved; quote accepted');
  END IF;
END $$;

-- ============================================================
-- 4. Propose / accept cost split
-- ============================================================
CREATE OR REPLACE FUNCTION public.propose_cost_split(
  p_request_id uuid,
  p_role text,                       -- 'landlord' | 'tenant' | 'staff'
  p_landlord_share_percent numeric,
  p_tenant_share_percent numeric,
  p_message text DEFAULT NULL,
  p_proposed_by_person_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_ws uuid;
BEGIN
  IF p_landlord_share_percent + p_tenant_share_percent <> 100 THEN
    RAISE EXCEPTION 'Shares must sum to 100';
  END IF;
  SELECT workspace_id INTO v_ws FROM service_requests WHERE id = p_request_id;

  -- Mark prior open proposals as superseded
  UPDATE service_request_cost_split
     SET status = 'superseded'
   WHERE request_id = p_request_id AND status = 'proposed';

  INSERT INTO service_request_cost_split (
    workspace_id, request_id, proposed_by_role, proposed_by_person_id,
    landlord_share_percent, tenant_share_percent, message
  ) VALUES (
    v_ws, p_request_id, p_role, p_proposed_by_person_id,
    p_landlord_share_percent, p_tenant_share_percent, p_message
  ) RETURNING id INTO v_id;

  INSERT INTO public.service_request_events (request_id, event_type, description, to_value)
  VALUES (p_request_id, 'cost_split_proposed',
          p_role || ' proposed ' || p_landlord_share_percent || '/' || p_tenant_share_percent,
          v_id::text);
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.accept_cost_split(
  p_proposal_id uuid,
  p_role text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.service_request_cost_split%ROWTYPE;
BEGIN
  SELECT * INTO p FROM service_request_cost_split WHERE id = p_proposal_id;
  IF p.id IS NULL THEN RAISE EXCEPTION 'Proposal not found'; END IF;

  UPDATE service_request_cost_split
     SET status = 'accepted', decided_at = now()
   WHERE id = p_proposal_id;

  UPDATE service_requests
     SET landlord_share_percent = p.landlord_share_percent,
         tenant_share_percent   = p.tenant_share_percent,
         bill_to_mode = CASE
           WHEN p.tenant_share_percent = 100 THEN 'tenant_only'::public.bill_to_mode
           WHEN p.landlord_share_percent = 100 THEN 'landlord_only'::public.bill_to_mode
           ELSE 'split'::public.bill_to_mode END,
         cost_split_resolved_at = now()
   WHERE id = p.request_id;

  INSERT INTO public.service_request_events (request_id, event_type, description, to_value)
  VALUES (p.request_id, 'cost_split_accepted',
          p_role || ' accepted ' || p.landlord_share_percent || '/' || p.tenant_share_percent,
          p_proposal_id::text);
END $$;
