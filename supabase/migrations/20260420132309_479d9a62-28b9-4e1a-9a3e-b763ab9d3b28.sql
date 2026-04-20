-- skip_ticket_stage RPC: marks the current stage skipped and advances to the next.
-- Mirrors advance_ticket_stage's stage transition logic but bypasses the
-- "all required steps complete" gate.
CREATE OR REPLACE FUNCTION public.skip_ticket_stage(
  p_ticket_id uuid,
  p_stage_key text,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current RECORD;
  v_next RECORD;
BEGIN
  IF p_reason IS NULL OR length(trim(p_reason)) < 2 THEN
    RAISE EXCEPTION 'Reason is required to skip a stage.';
  END IF;

  -- Verify the stage exists and is the current in_progress one.
  SELECT * INTO v_current
  FROM public.ticket_workflow_stages
  WHERE ticket_id = p_ticket_id AND stage_key = p_stage_key;

  IF v_current IS NULL THEN
    RAISE EXCEPTION 'Stage % not found on ticket.', p_stage_key;
  END IF;

  IF v_current.status <> 'in_progress' THEN
    RAISE EXCEPTION 'Only the current in-progress stage can be skipped.';
  END IF;

  -- Mark stage as skipped.
  UPDATE public.ticket_workflow_stages
  SET status = 'skipped',
      skipped_reason = p_reason,
      completed_at = now(),
      completed_by = auth.uid(),
      updated_at = now()
  WHERE id = v_current.id;

  INSERT INTO public.ticket_events (ticket_id, event_type, from_value, to_value, description, actor_id)
  VALUES (p_ticket_id, 'stage_skipped', NULL, p_stage_key, p_reason, auth.uid());

  -- Find next stage by order_index.
  SELECT * INTO v_next
  FROM public.ticket_workflow_stages
  WHERE ticket_id = p_ticket_id AND order_index > v_current.order_index
  ORDER BY order_index ASC
  LIMIT 1;

  IF v_next IS NULL THEN
    -- Workflow finished.
    UPDATE public.tickets
    SET current_stage_key = NULL, updated_at = now()
    WHERE id = p_ticket_id;

    INSERT INTO public.ticket_events (ticket_id, event_type, to_value, actor_id)
    VALUES (p_ticket_id, 'workflow_completed', NULL, auth.uid());
  ELSE
    UPDATE public.ticket_workflow_stages
    SET status = 'in_progress', started_at = now(), updated_at = now()
    WHERE id = v_next.id;

    UPDATE public.tickets
    SET current_stage_key = v_next.stage_key, updated_at = now()
    WHERE id = p_ticket_id;

    INSERT INTO public.ticket_events (ticket_id, event_type, from_value, to_value, actor_id)
    VALUES (p_ticket_id, 'stage_started', p_stage_key, v_next.stage_key, auth.uid());
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.skip_ticket_stage(uuid, text, text) TO authenticated;