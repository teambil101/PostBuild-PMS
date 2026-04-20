-- ============================================================
-- 1. people.auth_user_id
-- ============================================================
ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS people_auth_user_id_unique
  ON public.people(auth_user_id)
  WHERE auth_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS people_auth_user_id_idx
  ON public.people(auth_user_id)
  WHERE auth_user_id IS NOT NULL;

-- Backfill: case-insensitive match on email or primary_email
-- Only match unambiguous rows (auth user with exactly one matching person)
WITH matches AS (
  SELECT
    u.id AS auth_id,
    p.id AS person_id,
    ROW_NUMBER() OVER (PARTITION BY u.id ORDER BY p.created_at) AS rn,
    COUNT(*) OVER (PARTITION BY u.id) AS cnt
  FROM auth.users u
  JOIN public.people p
    ON LOWER(u.email) = LOWER(COALESCE(p.email, p.primary_email))
   AND p.auth_user_id IS NULL
  WHERE u.email IS NOT NULL
)
UPDATE public.people p
SET auth_user_id = m.auth_id
FROM matches m
WHERE m.person_id = p.id
  AND m.cnt = 1
  AND m.rn = 1
  AND p.auth_user_id IS NULL;

-- ============================================================
-- 2. tickets.status_changed_at + lifecycle trigger update
-- ============================================================
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS status_changed_at timestamptz;

UPDATE public.tickets
SET status_changed_at = COALESCE(status_changed_at, updated_at, created_at)
WHERE status_changed_at IS NULL;

CREATE OR REPLACE FUNCTION public.manage_ticket_lifecycle_timestamps()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Initialize status_changed_at on insert
  IF TG_OP = 'INSERT' THEN
    NEW.status_changed_at = COALESCE(NEW.status_changed_at, now());
  END IF;

  -- Bump status_changed_at on status transition
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status_changed_at = now();
  END IF;

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

-- ============================================================
-- 3. current_user_person_id() helper
-- ============================================================
CREATE OR REPLACE FUNCTION public.current_user_person_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.people WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.current_user_person_id() TO authenticated;

-- ============================================================
-- 4. get_operations_dashboard()
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_operations_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_person_id uuid;
  v_today date := current_date;
  v_week_end date := current_date + 7;
  v_result jsonb;
  v_my_open jsonb;
  v_my_leads jsonb;
  v_awaiting jsonb;
  v_cheques jsonb;
  v_blocked int;
  v_overdue jsonb;
  v_q_urgent jsonb;
  v_q_leads jsonb;
  v_q_cheques jsonb;
  v_q_awaiting jsonb;
BEGIN
  v_person_id := public.current_user_person_id();

  IF v_person_id IS NULL THEN
    RETURN jsonb_build_object(
      'person_id', NULL,
      'has_linked_person', false,
      'kpis', jsonb_build_object(
        'my_open_tickets', jsonb_build_object('total', 0, 'urgent', 0, 'overdue', 0),
        'my_leads', jsonb_build_object('total', 0, 'stuck', 0),
        'tickets_awaiting_me', jsonb_build_object('total', 0, 'waiting_over_3_days', 0),
        'cheques_due_this_week', jsonb_build_object('count', 0, 'total_amount', 0, 'currency', 'AED'),
        'workflow_steps_blocked', 0,
        'overdue_on_my_plate', jsonb_build_object('tickets', 0, 'leads', 0, 'total', 0)
      ),
      'queues', jsonb_build_object(
        'urgent_tickets', '[]'::jsonb,
        'my_leads_follow_up', '[]'::jsonb,
        'cheques_due_this_week', '[]'::jsonb,
        'awaiting_my_response', '[]'::jsonb
      )
    );
  END IF;

  -- KPI: my_open_tickets
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'urgent', COUNT(*) FILTER (WHERE priority = 'urgent'),
    'overdue', COUNT(*) FILTER (WHERE due_date IS NOT NULL AND due_date < v_today)
  ) INTO v_my_open
  FROM public.tickets
  WHERE assignee_id = v_person_id
    AND status IN ('open','in_progress','awaiting');

  -- KPI: my_leads
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'stuck', COUNT(*) FILTER (
      WHERE status IN ('proposal','negotiating')
        AND stage_entered_at < now() - interval '14 days'
    )
  ) INTO v_my_leads
  FROM public.leads
  WHERE assignee_id = v_person_id
    AND status NOT IN ('contract_signed','lost','on_hold');

  -- KPI: tickets_awaiting_me
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'waiting_over_3_days', COUNT(*) FILTER (
      WHERE status_changed_at IS NOT NULL
        AND status_changed_at < now() - interval '3 days'
    )
  ) INTO v_awaiting
  FROM public.tickets
  WHERE assignee_id = v_person_id
    AND status = 'awaiting'
    AND waiting_on = 'internal';

  -- KPI: cheques_due_this_week (default currency only for MVP)
  SELECT jsonb_build_object(
    'count', COUNT(*),
    'total_amount', COALESCE(SUM(lc.amount), 0),
    'currency', 'AED'
  ) INTO v_cheques
  FROM public.lease_cheques lc
  JOIN public.leases l ON l.id = lc.lease_id
  JOIN public.contracts c ON c.id = l.contract_id
  WHERE lc.status = 'pending'
    AND lc.due_date BETWEEN v_today AND v_week_end
    AND c.status = 'active';

  -- KPI: workflow_steps_blocked
  SELECT COUNT(*) INTO v_blocked
  FROM public.ticket_workflow_steps s
  JOIN public.tickets t ON t.id = s.ticket_id
  WHERE s.status = 'pending'
    AND s.is_required = true
    AND s.stage_key = t.current_stage_key
    AND t.assignee_id = v_person_id
    AND t.status NOT IN ('closed','cancelled');

  -- KPI: overdue_on_my_plate
  WITH t AS (
    SELECT COUNT(*) AS cnt FROM public.tickets
    WHERE assignee_id = v_person_id
      AND due_date IS NOT NULL AND due_date < v_today
      AND status NOT IN ('closed','cancelled','resolved')
  ), l AS (
    SELECT COUNT(*) AS cnt FROM public.leads
    WHERE assignee_id = v_person_id
      AND target_close_date IS NOT NULL AND target_close_date < v_today
      AND status NOT IN ('contract_signed','lost','on_hold')
  )
  SELECT jsonb_build_object(
    'tickets', t.cnt,
    'leads', l.cnt,
    'total', t.cnt + l.cnt
  ) INTO v_overdue FROM t, l;

  -- Queue: urgent_tickets
  SELECT COALESCE(jsonb_agg(row_to_json(q)), '[]'::jsonb) INTO v_q_urgent FROM (
    SELECT
      t.id,
      t.ticket_number,
      t.subject,
      t.priority,
      t.status,
      t.due_date,
      t.created_at,
      public.resolve_ticket_target_label(t.target_entity_id, t.target_entity_type) AS target_label
    FROM public.tickets t
    WHERE t.assignee_id = v_person_id
      AND t.status IN ('open','in_progress','awaiting')
      AND (t.priority = 'urgent' OR (t.due_date IS NOT NULL AND t.due_date < v_today))
    ORDER BY
      CASE WHEN t.priority = 'urgent' THEN 0 ELSE 1 END,
      t.due_date ASC NULLS LAST,
      t.created_at ASC
    LIMIT 10
  ) q;

  -- Queue: my_leads_follow_up
  SELECT COALESCE(jsonb_agg(row_to_json(q)), '[]'::jsonb) INTO v_q_leads FROM (
    SELECT
      l.id,
      l.lead_number,
      TRIM(CONCAT(p.first_name, ' ', p.last_name)) AS contact_name,
      co.first_name AS company_name,
      l.status,
      EXTRACT(DAY FROM (now() - l.stage_entered_at))::int AS stage_age_days,
      l.target_close_date
    FROM public.leads l
    JOIN public.people p ON p.id = l.primary_contact_id
    LEFT JOIN public.people co ON co.id = l.company_id
    WHERE l.assignee_id = v_person_id
      AND l.status NOT IN ('contract_signed','lost','on_hold')
    ORDER BY
      CASE WHEN l.target_close_date IS NOT NULL AND l.target_close_date < v_today THEN 0 ELSE 1 END,
      l.target_close_date ASC NULLS LAST,
      l.stage_entered_at ASC
    LIMIT 10
  ) q;

  -- Queue: cheques_due_this_week
  SELECT COALESCE(jsonb_agg(row_to_json(q)), '[]'::jsonb) INTO v_q_cheques FROM (
    SELECT
      lc.id,
      c.contract_number AS lease_contract_number,
      lc.amount,
      lc.due_date,
      (lc.due_date - v_today)::int AS days_until_due
    FROM public.lease_cheques lc
    JOIN public.leases l ON l.id = lc.lease_id
    JOIN public.contracts c ON c.id = l.contract_id
    WHERE lc.status = 'pending'
      AND lc.due_date BETWEEN v_today AND v_week_end
      AND c.status = 'active'
    ORDER BY lc.due_date ASC
    LIMIT 10
  ) q;

  -- Queue: awaiting_my_response
  SELECT COALESCE(jsonb_agg(row_to_json(q)), '[]'::jsonb) INTO v_q_awaiting FROM (
    SELECT
      t.id,
      t.ticket_number,
      t.subject,
      t.waiting_on,
      EXTRACT(DAY FROM (now() - COALESCE(t.status_changed_at, t.updated_at)))::int AS days_waiting
    FROM public.tickets t
    WHERE t.assignee_id = v_person_id
      AND t.status = 'awaiting'
      AND t.waiting_on = 'internal'
    ORDER BY COALESCE(t.status_changed_at, t.updated_at) ASC
    LIMIT 10
  ) q;

  v_result := jsonb_build_object(
    'person_id', v_person_id,
    'has_linked_person', true,
    'kpis', jsonb_build_object(
      'my_open_tickets', v_my_open,
      'my_leads', v_my_leads,
      'tickets_awaiting_me', v_awaiting,
      'cheques_due_this_week', v_cheques,
      'workflow_steps_blocked', v_blocked,
      'overdue_on_my_plate', v_overdue
    ),
    'queues', jsonb_build_object(
      'urgent_tickets', v_q_urgent,
      'my_leads_follow_up', v_q_leads,
      'cheques_due_this_week', v_q_cheques,
      'awaiting_my_response', v_q_awaiting
    )
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_operations_dashboard() TO authenticated;

-- ============================================================
-- 5. get_management_dashboard()
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_management_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := current_date;
  v_period_start date := current_date - 90;
  v_default_currency text := 'AED';
  v_units_total int;
  v_units_occupied int;
  v_units_new_in_period int;
  v_occupancy_rate numeric;
  v_rent_roll numeric;
  v_active_leases int;
  v_leases_expiring_90d int;
  v_open_tickets int;
  v_urgent_tickets int;
  v_pipeline numeric;
  v_pm_fees numeric := 0;
  v_active_mgmt int := 0;
  v_overdue_cheques jsonb;
  v_leases_expiring jsonb;
  v_stuck_leads jsonb;
  v_compliance jsonb;
  v_data_gaps jsonb;
  v_aging_tickets jsonb;
  v_attention_score int;
  v_overdue_count int;
  v_stuck_count int;
  v_aging_count int;
  v_mgmt_60 int;
  v_lic_60 int;
  v_ins_60 int;
  v_units_no_owners int;
  v_occupied_no_lease int;
  v_unlinked_auth int;
BEGIN
  -- KPI: units_managed
  SELECT COUNT(*) INTO v_units_total FROM public.units;
  SELECT COUNT(*) INTO v_units_occupied FROM public.units WHERE status = 'occupied';
  SELECT COUNT(*) INTO v_units_new_in_period
    FROM public.units WHERE created_at >= v_period_start;

  v_occupancy_rate := CASE WHEN v_units_total > 0
    THEN ROUND((v_units_occupied::numeric / v_units_total::numeric) * 100, 1)
    ELSE 0 END;

  -- Rent roll
  SELECT COALESCE(SUM(l.annual_rent), 0) INTO v_rent_roll
  FROM public.leases l
  JOIN public.contracts c ON c.id = l.contract_id
  WHERE c.status = 'active';

  -- Active leases + expiring
  SELECT COUNT(*) INTO v_active_leases
  FROM public.contracts WHERE contract_type = 'lease' AND status = 'active';

  SELECT COUNT(*) INTO v_leases_expiring_90d
  FROM public.contracts
  WHERE contract_type = 'lease' AND status = 'active'
    AND end_date IS NOT NULL AND end_date <= v_today + 90;

  -- Open tickets
  SELECT
    COUNT(*) FILTER (WHERE status IN ('open','in_progress','awaiting')),
    COUNT(*) FILTER (WHERE status IN ('open','in_progress','awaiting') AND priority = 'urgent')
  INTO v_open_tickets, v_urgent_tickets
  FROM public.tickets;

  -- Pipeline
  SELECT COALESCE(SUM(estimated_annual_fee * COALESCE(probability_percent, 0) / 100.0), 0)
  INTO v_pipeline
  FROM public.leads
  WHERE status NOT IN ('contract_signed','lost','on_hold')
    AND estimated_annual_fee IS NOT NULL;

  -- PM fees (default currency only)
  SELECT COUNT(*) INTO v_active_mgmt
  FROM public.contracts c
  WHERE c.contract_type = 'management_agreement' AND c.status = 'active'
    AND c.currency = v_default_currency;

  WITH agreements AS (
    SELECT
      ma.contract_id,
      ma.fee_model,
      ma.fee_value,
      ma.hybrid_base_flat,
      (
        SELECT COUNT(*) FROM public.contract_subjects cs
        WHERE cs.contract_id = ma.contract_id AND cs.entity_type = 'unit'
      ) AS unit_count,
      (
        SELECT COALESCE(SUM(l2.annual_rent), 0)
        FROM public.contract_subjects cs2
        JOIN public.leases l2 ON l2.contract_id IN (
          SELECT c2.id FROM public.contracts c2
          WHERE c2.contract_type = 'lease' AND c2.status = 'active'
            AND EXISTS (
              SELECT 1 FROM public.contract_subjects cs3
              WHERE cs3.contract_id = c2.id
                AND cs3.entity_type = cs2.entity_type
                AND cs3.entity_id = cs2.entity_id
            )
        )
        WHERE cs2.contract_id = ma.contract_id
      ) AS covered_rent
    FROM public.management_agreements ma
    JOIN public.contracts c ON c.id = ma.contract_id
    WHERE c.status = 'active' AND c.currency = v_default_currency
  )
  SELECT COALESCE(SUM(
    CASE fee_model
      WHEN 'flat_annual' THEN fee_value
      WHEN 'flat_monthly' THEN fee_value * 12
      WHEN 'flat_per_unit' THEN fee_value * unit_count
      WHEN 'percentage_of_rent' THEN covered_rent * fee_value / 100.0
      WHEN 'hybrid' THEN COALESCE(hybrid_base_flat, 0) * 12
      ELSE 0
    END
  ), 0) INTO v_pm_fees FROM agreements;

  -- Attention items: overdue_cheques
  WITH overdue AS (
    SELECT lc.id, lc.amount, lc.due_date, c.contract_number,
           (v_today - lc.due_date)::int AS days_overdue
    FROM public.lease_cheques lc
    JOIN public.leases l ON l.id = lc.lease_id
    JOIN public.contracts c ON c.id = l.contract_id
    WHERE lc.status = 'pending' AND lc.due_date < v_today AND c.status = 'active'
  )
  SELECT
    COUNT(*),
    jsonb_build_object(
      'count', COUNT(*),
      'total_amount', COALESCE(SUM(amount), 0),
      'currency', v_default_currency,
      'top_5', COALESCE((
        SELECT jsonb_agg(row_to_json(t)) FROM (
          SELECT id, contract_number, amount, due_date, days_overdue
          FROM overdue ORDER BY due_date ASC LIMIT 5
        ) t
      ), '[]'::jsonb)
    )
  INTO v_overdue_count, v_overdue_cheques
  FROM overdue;

  -- Attention: leases_expiring (30/60/90)
  WITH exp AS (
    SELECT id, contract_number, title, end_date, (end_date - v_today)::int AS days_until
    FROM public.contracts
    WHERE contract_type = 'lease' AND status = 'active'
      AND end_date IS NOT NULL AND end_date <= v_today + 90
  )
  SELECT jsonb_build_object(
    'in_30d', COUNT(*) FILTER (WHERE end_date <= v_today + 30),
    'in_60d', COUNT(*) FILTER (WHERE end_date <= v_today + 60),
    'in_90d', COUNT(*),
    'top_5', COALESCE((
      SELECT jsonb_agg(row_to_json(t)) FROM (
        SELECT id, contract_number, title, end_date, days_until
        FROM exp ORDER BY end_date ASC LIMIT 5
      ) t
    ), '[]'::jsonb)
  ) INTO v_leases_expiring FROM exp;

  -- Attention: stuck_leads
  WITH stuck AS (
    SELECT l.id, l.lead_number, l.status,
           EXTRACT(DAY FROM (now() - l.stage_entered_at))::int AS stage_age_days,
           COALESCE(l.estimated_annual_fee * COALESCE(l.probability_percent, 0) / 100.0, 0) AS weighted,
           TRIM(CONCAT(p.first_name, ' ', p.last_name)) AS contact_name
    FROM public.leads l
    JOIN public.people p ON p.id = l.primary_contact_id
    WHERE l.status IN ('proposal','negotiating')
      AND l.stage_entered_at < now() - interval '14 days'
  )
  SELECT
    COUNT(*),
    jsonb_build_object(
      'count', COUNT(*),
      'weighted_value', COALESCE(SUM(weighted), 0),
      'currency', v_default_currency,
      'top_5', COALESCE((
        SELECT jsonb_agg(row_to_json(t)) FROM (
          SELECT id, lead_number, contact_name, status, stage_age_days, weighted
          FROM stuck ORDER BY stage_age_days DESC LIMIT 5
        ) t
      ), '[]'::jsonb)
    )
  INTO v_stuck_count, v_stuck_leads
  FROM stuck;

  -- Compliance expiring 60d
  SELECT COUNT(*) INTO v_mgmt_60 FROM public.contracts
  WHERE contract_type = 'management_agreement' AND status = 'active'
    AND end_date IS NOT NULL AND end_date <= v_today + 60;

  SELECT COUNT(*) INTO v_lic_60 FROM public.vendors
  WHERE status = 'active'
    AND trade_license_expiry_date IS NOT NULL
    AND trade_license_expiry_date <= v_today + 60;

  SELECT COUNT(*) INTO v_ins_60 FROM public.vendors
  WHERE status = 'active'
    AND insurance_expiry_date IS NOT NULL
    AND insurance_expiry_date <= v_today + 60;

  v_compliance := jsonb_build_object(
    'mgmt_agreements_60d', v_mgmt_60,
    'vendor_trade_license_60d', v_lic_60,
    'vendor_insurance_60d', v_ins_60
  );

  -- Data gaps
  SELECT COUNT(*) INTO v_units_no_owners FROM public.units_without_owners;
  SELECT COUNT(*) INTO v_occupied_no_lease FROM public.units
    WHERE status = 'occupied' AND status_locked_by_lease_id IS NULL;
  SELECT COUNT(*) INTO v_unlinked_auth FROM auth.users u
    WHERE NOT EXISTS (SELECT 1 FROM public.people p WHERE p.auth_user_id = u.id);

  v_data_gaps := jsonb_build_object(
    'units_without_owners', v_units_no_owners,
    'occupied_no_lease', v_occupied_no_lease,
    'unlinked_auth_users', v_unlinked_auth
  );

  -- Aging tickets >30d
  WITH aging AS (
    SELECT id, ticket_number, subject, status, priority, created_at,
           EXTRACT(DAY FROM (now() - created_at))::int AS age_days
    FROM public.tickets
    WHERE created_at < now() - interval '30 days'
      AND status NOT IN ('closed','cancelled')
  )
  SELECT
    COUNT(*),
    jsonb_build_object(
      'count_over_30_days', COUNT(*),
      'top_5', COALESCE((
        SELECT jsonb_agg(row_to_json(t)) FROM (
          SELECT id, ticket_number, subject, status, priority, age_days
          FROM aging ORDER BY age_days DESC LIMIT 5
        ) t
      ), '[]'::jsonb)
    )
  INTO v_aging_count, v_aging_tickets
  FROM aging;

  -- Attention score (composite signal)
  v_attention_score := v_overdue_count + v_stuck_count + v_aging_count
    + v_mgmt_60 + v_lic_60 + v_ins_60
    + v_units_no_owners + v_occupied_no_lease + v_unlinked_auth;

  RETURN jsonb_build_object(
    'kpis', jsonb_build_object(
      'units_managed', jsonb_build_object(
        'total', v_units_total,
        'delta_this_period', v_units_new_in_period
      ),
      'occupancy_rate', jsonb_build_object(
        'percent', v_occupancy_rate,
        'occupied', v_units_occupied,
        'total', v_units_total,
        'delta', NULL
      ),
      'annualized_rent_roll', jsonb_build_object(
        'amount', v_rent_roll,
        'currency', v_default_currency,
        'delta', NULL
      ),
      'annualized_pm_fees', jsonb_build_object(
        'amount', v_pm_fees,
        'currency', v_default_currency,
        'active_agreements', v_active_mgmt
      ),
      'active_leases', jsonb_build_object(
        'total', v_active_leases,
        'expiring_90d', v_leases_expiring_90d
      ),
      'open_tickets', jsonb_build_object(
        'total', v_open_tickets,
        'urgent', v_urgent_tickets
      ),
      'weighted_pipeline_value', jsonb_build_object(
        'amount', v_pipeline,
        'currency', v_default_currency
      ),
      'attention_score', v_attention_score
    ),
    'attention_items', jsonb_build_object(
      'overdue_cheques', v_overdue_cheques,
      'leases_expiring', v_leases_expiring,
      'stuck_leads', v_stuck_leads,
      'compliance_expiring', v_compliance,
      'data_gaps', v_data_gaps,
      'aging_tickets', v_aging_tickets
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_management_dashboard() TO authenticated;