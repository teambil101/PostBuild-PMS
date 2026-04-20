CREATE OR REPLACE FUNCTION public.get_operations_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_person_id uuid;
  v_today date := current_date;
  v_week_end date := current_date + 7;
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
  v_overdue_tickets int;
  v_overdue_leads int;
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

  SELECT jsonb_build_object(
    'total', COUNT(*),
    'urgent', COUNT(*) FILTER (WHERE priority = 'urgent'),
    'overdue', COUNT(*) FILTER (WHERE due_date IS NOT NULL AND due_date < v_today)
  ) INTO v_my_open
  FROM public.tickets
  WHERE assignee_id = v_person_id
    AND status IN ('open','in_progress','awaiting');

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

  SELECT COUNT(*) INTO v_blocked
  FROM public.ticket_workflow_steps s
  JOIN public.tickets t ON t.id = s.ticket_id
  WHERE s.status = 'pending'
    AND s.is_required = true
    AND s.stage_key = t.current_stage_key
    AND t.assignee_id = v_person_id
    AND t.status NOT IN ('closed','cancelled');

  SELECT COUNT(*) INTO v_overdue_tickets
  FROM public.tickets
  WHERE assignee_id = v_person_id
    AND status NOT IN ('closed','cancelled')
    AND due_date IS NOT NULL
    AND due_date < v_today;

  SELECT COUNT(*) INTO v_overdue_leads
  FROM public.leads
  WHERE assignee_id = v_person_id
    AND status NOT IN ('contract_signed','lost','on_hold')
    AND target_close_date IS NOT NULL
    AND target_close_date < v_today;

  v_overdue := jsonb_build_object(
    'tickets', v_overdue_tickets,
    'leads', v_overdue_leads,
    'total', v_overdue_tickets + v_overdue_leads
  );

  -- Queue: urgent tickets (FIX: arg order is entity_type, entity_id)
  SELECT COALESCE(jsonb_agg(row_to_json(x)), '[]'::jsonb) INTO v_q_urgent
  FROM (
    SELECT
      t.id,
      t.ticket_number,
      t.subject,
      t.priority,
      t.status,
      t.due_date,
      t.created_at,
      public.resolve_ticket_target_label(t.target_entity_type, t.target_entity_id) AS target_label
    FROM public.tickets t
    WHERE t.assignee_id = v_person_id
      AND t.status IN ('open','in_progress','awaiting')
      AND t.priority = 'urgent'
    ORDER BY t.due_date ASC NULLS LAST, t.created_at ASC
    LIMIT 10
  ) x;

  -- Queue: my leads follow-up
  SELECT COALESCE(jsonb_agg(row_to_json(x)), '[]'::jsonb) INTO v_q_leads
  FROM (
    SELECT
      l.id,
      l.lead_number,
      TRIM(CONCAT(p.first_name, ' ', p.last_name)) AS contact_name,
      co.company AS company_name,
      l.status,
      GREATEST(0, EXTRACT(DAY FROM now() - l.stage_entered_at)::int) AS stage_age_days,
      l.target_close_date
    FROM public.leads l
    LEFT JOIN public.people p ON p.id = l.primary_contact_id
    LEFT JOIN public.people co ON co.id = l.company_id
    WHERE l.assignee_id = v_person_id
      AND l.status NOT IN ('contract_signed','lost','on_hold')
    ORDER BY l.target_close_date ASC NULLS LAST, l.stage_entered_at ASC
    LIMIT 10
  ) x;

  -- Queue: cheques due this week
  SELECT COALESCE(jsonb_agg(row_to_json(x)), '[]'::jsonb) INTO v_q_cheques
  FROM (
    SELECT
      lc.id,
      c.contract_number AS lease_contract_number,
      lc.amount,
      lc.due_date,
      GREATEST(0, (lc.due_date - v_today))::int AS days_until_due
    FROM public.lease_cheques lc
    JOIN public.leases l ON l.id = lc.lease_id
    JOIN public.contracts c ON c.id = l.contract_id
    WHERE lc.status = 'pending'
      AND lc.due_date BETWEEN v_today AND v_week_end
      AND c.status = 'active'
    ORDER BY lc.due_date ASC
    LIMIT 10
  ) x;

  -- Queue: awaiting my response
  SELECT COALESCE(jsonb_agg(row_to_json(x)), '[]'::jsonb) INTO v_q_awaiting
  FROM (
    SELECT
      t.id,
      t.ticket_number,
      t.subject,
      t.waiting_on,
      GREATEST(0, EXTRACT(DAY FROM now() - COALESCE(t.status_changed_at, t.updated_at))::int) AS days_waiting
    FROM public.tickets t
    WHERE t.assignee_id = v_person_id
      AND t.status = 'awaiting'
      AND t.waiting_on = 'internal'
    ORDER BY COALESCE(t.status_changed_at, t.updated_at) ASC
    LIMIT 10
  ) x;

  RETURN jsonb_build_object(
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
END;
$function$;