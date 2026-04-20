
-- =========================================================
-- 1a. Extend tickets table
-- =========================================================
ALTER TABLE public.tickets
  ADD COLUMN workflow_key text,
  ADD COLUMN current_stage_key text;

ALTER TABLE public.tickets
  ADD CONSTRAINT tickets_workflow_consistency_check
  CHECK ((workflow_key IS NULL) = (current_stage_key IS NULL) OR (workflow_key IS NOT NULL AND current_stage_key IS NULL));

-- Note: allow workflow_key set with current_stage_key NULL (workflow completed state).
-- The check above: either both null (no workflow) OR workflow_key set (current_stage_key may be null when complete).

-- =========================================================
-- 1b. ticket_workflow_stages
-- =========================================================
CREATE TABLE public.ticket_workflow_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  workflow_key text NOT NULL,
  stage_key text NOT NULL,
  stage_label text NOT NULL,
  order_index integer NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','in_progress','complete','skipped')),
  started_at timestamptz,
  completed_at timestamptz,
  completed_by uuid REFERENCES auth.users(id),
  skipped_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ticket_id, stage_key)
);

CREATE INDEX idx_ticket_workflow_stages_ticket_order
  ON public.ticket_workflow_stages (ticket_id, order_index);

-- Only one in_progress stage per ticket
CREATE UNIQUE INDEX uniq_ticket_workflow_stages_one_in_progress
  ON public.ticket_workflow_stages (ticket_id)
  WHERE status = 'in_progress';

CREATE TRIGGER trg_ticket_workflow_stages_updated_at
  BEFORE UPDATE ON public.ticket_workflow_stages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.ticket_workflow_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view ticket_workflow_stages"
  ON public.ticket_workflow_stages FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid()));

CREATE POLICY "Staff/admin can insert ticket_workflow_stages"
  ON public.ticket_workflow_stages FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'staff'::app_role));

CREATE POLICY "Staff/admin can update ticket_workflow_stages"
  ON public.ticket_workflow_stages FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'staff'::app_role));

CREATE POLICY "Admin can delete ticket_workflow_stages"
  ON public.ticket_workflow_stages FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role));

-- =========================================================
-- 1c. ticket_workflow_steps
-- =========================================================
CREATE TABLE public.ticket_workflow_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  workflow_key text NOT NULL,
  stage_key text NOT NULL,
  step_key text NOT NULL,
  step_label text NOT NULL,
  step_description text,
  order_index integer NOT NULL,
  is_required boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','complete','skipped')),
  completed_at timestamptz,
  completed_by uuid REFERENCES auth.users(id),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ticket_id, stage_key, step_key)
);

CREATE INDEX idx_ticket_workflow_steps_ticket_stage_order
  ON public.ticket_workflow_steps (ticket_id, stage_key, order_index);

CREATE TRIGGER trg_ticket_workflow_steps_updated_at
  BEFORE UPDATE ON public.ticket_workflow_steps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.ticket_workflow_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view ticket_workflow_steps"
  ON public.ticket_workflow_steps FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid()));

CREATE POLICY "Staff/admin can insert ticket_workflow_steps"
  ON public.ticket_workflow_steps FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'staff'::app_role));

CREATE POLICY "Staff/admin can update ticket_workflow_steps"
  ON public.ticket_workflow_steps FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'staff'::app_role));

CREATE POLICY "Admin can delete ticket_workflow_steps"
  ON public.ticket_workflow_steps FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role));

-- =========================================================
-- 1d. Extend ticket_events event_type enum (check constraint)
-- =========================================================
ALTER TABLE public.ticket_events DROP CONSTRAINT ticket_events_event_type_check;
ALTER TABLE public.ticket_events ADD CONSTRAINT ticket_events_event_type_check
  CHECK (event_type IN (
    'created','status_changed','priority_changed','assignee_changed','reporter_changed',
    'target_changed','due_date_changed','cost_estimated','cost_actual_recorded',
    'cost_approval_requested','cost_approval_approved','cost_approval_rejected',
    'reopened','updated',
    'workflow_initialized','workflow_changed','workflow_completed','workflow_removed',
    'stage_started','stage_completed','stage_skipped',
    'step_completed','step_uncompleted','step_skipped','step_note_updated'
  ));

-- =========================================================
-- 3a. initialize_ticket_workflow
-- =========================================================
CREATE OR REPLACE FUNCTION public.initialize_ticket_workflow(
  p_ticket_id uuid,
  p_workflow_key text,
  p_stages jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_existing text;
  v_stage jsonb;
  v_step jsonb;
  v_stage_idx int := 0;
  v_step_idx int;
  v_first_stage_key text;
BEGIN
  SELECT workflow_key INTO v_existing FROM tickets WHERE id = p_ticket_id;
  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'Ticket % already has a workflow (%). Use change_ticket_workflow.', p_ticket_id, v_existing;
  END IF;

  FOR v_stage IN SELECT * FROM jsonb_array_elements(p_stages) LOOP
    INSERT INTO ticket_workflow_stages
      (ticket_id, workflow_key, stage_key, stage_label, order_index, status, started_at)
    VALUES
      (p_ticket_id, p_workflow_key,
       v_stage->>'key', v_stage->>'label', v_stage_idx,
       CASE WHEN v_stage_idx = 0 THEN 'in_progress' ELSE 'pending' END,
       CASE WHEN v_stage_idx = 0 THEN now() ELSE NULL END);

    IF v_stage_idx = 0 THEN
      v_first_stage_key := v_stage->>'key';
    END IF;

    v_step_idx := 0;
    FOR v_step IN SELECT * FROM jsonb_array_elements(v_stage->'steps') LOOP
      INSERT INTO ticket_workflow_steps
        (ticket_id, workflow_key, stage_key, step_key, step_label, step_description,
         order_index, is_required)
      VALUES
        (p_ticket_id, p_workflow_key, v_stage->>'key', v_step->>'key',
         v_step->>'label', v_step->>'description', v_step_idx,
         COALESCE((v_step->>'required')::boolean, true));
      v_step_idx := v_step_idx + 1;
    END LOOP;

    v_stage_idx := v_stage_idx + 1;
  END LOOP;

  UPDATE tickets
     SET workflow_key = p_workflow_key,
         current_stage_key = v_first_stage_key
   WHERE id = p_ticket_id;

  INSERT INTO ticket_events (ticket_id, event_type, to_value, actor_id)
  VALUES (p_ticket_id, 'workflow_initialized', p_workflow_key, auth.uid());
END;
$$;

-- =========================================================
-- 3b. complete_ticket_step
-- =========================================================
CREATE OR REPLACE FUNCTION public.complete_ticket_step(
  p_ticket_id uuid,
  p_stage_key text,
  p_step_key text,
  p_note text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_step_label text;
BEGIN
  SELECT step_label INTO v_step_label
    FROM ticket_workflow_steps
   WHERE ticket_id = p_ticket_id AND stage_key = p_stage_key AND step_key = p_step_key;

  IF v_step_label IS NULL THEN
    RAISE EXCEPTION 'Step %/% not found on ticket %', p_stage_key, p_step_key, p_ticket_id;
  END IF;

  UPDATE ticket_workflow_steps
     SET status = 'complete',
         completed_at = now(),
         completed_by = auth.uid(),
         note = COALESCE(p_note, note)
   WHERE ticket_id = p_ticket_id AND stage_key = p_stage_key AND step_key = p_step_key;

  INSERT INTO ticket_events (ticket_id, event_type, to_value, description, actor_id)
  VALUES (p_ticket_id, 'step_completed', p_stage_key || '/' || p_step_key, v_step_label, auth.uid());
END;
$$;

-- =========================================================
-- 3c. uncomplete_ticket_step
-- =========================================================
CREATE OR REPLACE FUNCTION public.uncomplete_ticket_step(
  p_ticket_id uuid,
  p_stage_key text,
  p_step_key text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_stage_status text;
  v_step_label text;
BEGIN
  SELECT status INTO v_stage_status
    FROM ticket_workflow_stages
   WHERE ticket_id = p_ticket_id AND stage_key = p_stage_key;

  IF v_stage_status IS NULL THEN
    RAISE EXCEPTION 'Stage % not found on ticket %', p_stage_key, p_ticket_id;
  END IF;

  IF v_stage_status <> 'in_progress' THEN
    RAISE EXCEPTION 'Cannot uncomplete in advanced stage (stage status: %)', v_stage_status;
  END IF;

  SELECT step_label INTO v_step_label
    FROM ticket_workflow_steps
   WHERE ticket_id = p_ticket_id AND stage_key = p_stage_key AND step_key = p_step_key;

  IF v_step_label IS NULL THEN
    RAISE EXCEPTION 'Step %/% not found on ticket %', p_stage_key, p_step_key, p_ticket_id;
  END IF;

  UPDATE ticket_workflow_steps
     SET status = 'pending',
         completed_at = NULL,
         completed_by = NULL
   WHERE ticket_id = p_ticket_id AND stage_key = p_stage_key AND step_key = p_step_key;

  INSERT INTO ticket_events (ticket_id, event_type, to_value, description, actor_id)
  VALUES (p_ticket_id, 'step_uncompleted', p_stage_key || '/' || p_step_key, v_step_label, auth.uid());
END;
$$;

-- =========================================================
-- 3d. skip_ticket_step
-- =========================================================
CREATE OR REPLACE FUNCTION public.skip_ticket_step(
  p_ticket_id uuid,
  p_stage_key text,
  p_step_key text,
  p_reason text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_required boolean;
  v_step_label text;
BEGIN
  SELECT is_required, step_label INTO v_required, v_step_label
    FROM ticket_workflow_steps
   WHERE ticket_id = p_ticket_id AND stage_key = p_stage_key AND step_key = p_step_key;

  IF v_step_label IS NULL THEN
    RAISE EXCEPTION 'Step %/% not found on ticket %', p_stage_key, p_step_key, p_ticket_id;
  END IF;

  IF v_required THEN
    RAISE EXCEPTION 'Cannot skip required step %/%', p_stage_key, p_step_key;
  END IF;

  UPDATE ticket_workflow_steps
     SET status = 'skipped',
         completed_at = now(),
         completed_by = auth.uid(),
         note = p_reason
   WHERE ticket_id = p_ticket_id AND stage_key = p_stage_key AND step_key = p_step_key;

  INSERT INTO ticket_events (ticket_id, event_type, to_value, description, actor_id)
  VALUES (p_ticket_id, 'step_skipped', p_stage_key || '/' || p_step_key, COALESCE(p_reason, v_step_label), auth.uid());
END;
$$;

-- =========================================================
-- 3e. advance_ticket_stage
-- =========================================================
CREATE OR REPLACE FUNCTION public.advance_ticket_stage(
  p_ticket_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_current_stage record;
  v_pending_count int;
  v_pending_label text;
  v_next_stage record;
BEGIN
  SELECT id, stage_key, stage_label, order_index
    INTO v_current_stage
    FROM ticket_workflow_stages
   WHERE ticket_id = p_ticket_id AND status = 'in_progress'
   LIMIT 1;

  IF v_current_stage.id IS NULL THEN
    RAISE EXCEPTION 'No in-progress stage on ticket %', p_ticket_id;
  END IF;

  SELECT count(*) INTO v_pending_count
    FROM ticket_workflow_steps
   WHERE ticket_id = p_ticket_id
     AND stage_key = v_current_stage.stage_key
     AND is_required = true
     AND status = 'pending';

  IF v_pending_count > 0 THEN
    RAISE EXCEPTION 'Cannot advance: % required step(s) pending in stage %', v_pending_count, v_current_stage.stage_label;
  END IF;

  UPDATE ticket_workflow_stages
     SET status = 'complete',
         completed_at = now(),
         completed_by = auth.uid()
   WHERE id = v_current_stage.id;

  INSERT INTO ticket_events (ticket_id, event_type, to_value, description, actor_id)
  VALUES (p_ticket_id, 'stage_completed', v_current_stage.stage_key, v_current_stage.stage_label, auth.uid());

  SELECT id, stage_key, stage_label, order_index
    INTO v_next_stage
    FROM ticket_workflow_stages
   WHERE ticket_id = p_ticket_id AND order_index > v_current_stage.order_index
   ORDER BY order_index ASC
   LIMIT 1;

  IF v_next_stage.id IS NOT NULL THEN
    UPDATE ticket_workflow_stages
       SET status = 'in_progress', started_at = now()
     WHERE id = v_next_stage.id;

    UPDATE tickets
       SET current_stage_key = v_next_stage.stage_key
     WHERE id = p_ticket_id;

    INSERT INTO ticket_events (ticket_id, event_type, to_value, description, actor_id)
    VALUES (p_ticket_id, 'stage_started', v_next_stage.stage_key, v_next_stage.stage_label, auth.uid());
  ELSE
    UPDATE tickets SET current_stage_key = NULL WHERE id = p_ticket_id;

    INSERT INTO ticket_events (ticket_id, event_type, actor_id, description)
    VALUES (p_ticket_id, 'workflow_completed', auth.uid(), 'All workflow stages completed');
  END IF;
END;
$$;

-- =========================================================
-- 3f. change_ticket_workflow
-- =========================================================
CREATE OR REPLACE FUNCTION public.change_ticket_workflow(
  p_ticket_id uuid,
  p_new_workflow_key text,
  p_new_stages jsonb,
  p_preserved_step_keys text[] DEFAULT '{}'
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_old_workflow text;
  v_stage jsonb;
  v_step jsonb;
  v_stage_idx int := 0;
  v_step_idx int;
  v_new_current_stage text;
  v_preserved jsonb := '[]'::jsonb;
  v_snap record;
BEGIN
  SELECT workflow_key INTO v_old_workflow FROM tickets WHERE id = p_ticket_id;

  -- Snapshot preserved step progress
  IF p_preserved_step_keys IS NOT NULL AND array_length(p_preserved_step_keys, 1) > 0 THEN
    FOR v_snap IN
      SELECT step_key, status, completed_at, completed_by, note
        FROM ticket_workflow_steps
       WHERE ticket_id = p_ticket_id
         AND step_key = ANY(p_preserved_step_keys)
    LOOP
      v_preserved := v_preserved || jsonb_build_object(
        'step_key', v_snap.step_key,
        'status', v_snap.status,
        'completed_at', v_snap.completed_at,
        'completed_by', v_snap.completed_by,
        'note', v_snap.note
      );
    END LOOP;
  END IF;

  -- Wipe old
  DELETE FROM ticket_workflow_steps WHERE ticket_id = p_ticket_id;
  DELETE FROM ticket_workflow_stages WHERE ticket_id = p_ticket_id;

  -- Insert new (all pending; we'll set in_progress after restoring)
  FOR v_stage IN SELECT * FROM jsonb_array_elements(p_new_stages) LOOP
    INSERT INTO ticket_workflow_stages
      (ticket_id, workflow_key, stage_key, stage_label, order_index, status)
    VALUES
      (p_ticket_id, p_new_workflow_key, v_stage->>'key', v_stage->>'label', v_stage_idx, 'pending');

    v_step_idx := 0;
    FOR v_step IN SELECT * FROM jsonb_array_elements(v_stage->'steps') LOOP
      INSERT INTO ticket_workflow_steps
        (ticket_id, workflow_key, stage_key, step_key, step_label, step_description,
         order_index, is_required)
      VALUES
        (p_ticket_id, p_new_workflow_key, v_stage->>'key', v_step->>'key',
         v_step->>'label', v_step->>'description', v_step_idx,
         COALESCE((v_step->>'required')::boolean, true));
      v_step_idx := v_step_idx + 1;
    END LOOP;
    v_stage_idx := v_stage_idx + 1;
  END LOOP;

  -- Restore preserved progress
  UPDATE ticket_workflow_steps s
     SET status = (p->>'status'),
         completed_at = (p->>'completed_at')::timestamptz,
         completed_by = NULLIF(p->>'completed_by','')::uuid,
         note = p->>'note'
    FROM jsonb_array_elements(v_preserved) AS p
   WHERE s.ticket_id = p_ticket_id
     AND s.step_key = (p->>'step_key');

  -- Determine new current stage = first stage with required pending steps
  SELECT stage_key INTO v_new_current_stage
    FROM ticket_workflow_stages
   WHERE ticket_id = p_ticket_id
     AND EXISTS (
       SELECT 1 FROM ticket_workflow_steps st
        WHERE st.ticket_id = p_ticket_id
          AND st.stage_key = ticket_workflow_stages.stage_key
          AND st.is_required = true
          AND st.status = 'pending'
     )
   ORDER BY order_index ASC
   LIMIT 1;

  IF v_new_current_stage IS NOT NULL THEN
    UPDATE ticket_workflow_stages
       SET status = 'in_progress', started_at = now()
     WHERE ticket_id = p_ticket_id AND stage_key = v_new_current_stage;

    -- Mark prior stages complete
    UPDATE ticket_workflow_stages
       SET status = 'complete', completed_at = COALESCE(completed_at, now())
     WHERE ticket_id = p_ticket_id
       AND order_index < (SELECT order_index FROM ticket_workflow_stages
                           WHERE ticket_id = p_ticket_id AND stage_key = v_new_current_stage);
  ELSE
    -- All complete → mark all stages complete
    UPDATE ticket_workflow_stages
       SET status = 'complete', completed_at = COALESCE(completed_at, now())
     WHERE ticket_id = p_ticket_id;
  END IF;

  UPDATE tickets
     SET workflow_key = p_new_workflow_key,
         current_stage_key = v_new_current_stage
   WHERE id = p_ticket_id;

  INSERT INTO ticket_events (ticket_id, event_type, from_value, to_value, actor_id, description)
  VALUES (p_ticket_id, 'workflow_changed', v_old_workflow, p_new_workflow_key, auth.uid(),
          'Preserved steps: ' || COALESCE(array_to_string(p_preserved_step_keys, ','), '(none)'));
END;
$$;

-- =========================================================
-- 3g. remove_ticket_workflow
-- =========================================================
CREATE OR REPLACE FUNCTION public.remove_ticket_workflow(
  p_ticket_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_old text;
BEGIN
  SELECT workflow_key INTO v_old FROM tickets WHERE id = p_ticket_id;

  DELETE FROM ticket_workflow_steps WHERE ticket_id = p_ticket_id;
  DELETE FROM ticket_workflow_stages WHERE ticket_id = p_ticket_id;

  UPDATE tickets
     SET workflow_key = NULL, current_stage_key = NULL
   WHERE id = p_ticket_id;

  INSERT INTO ticket_events (ticket_id, event_type, from_value, actor_id, description)
  VALUES (p_ticket_id, 'workflow_removed', v_old, auth.uid(), 'Workflow stripped from ticket');
END;
$$;

-- =========================================================
-- 4. get_ticket_workflow_summary
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_ticket_workflow_summary(
  p_ticket_id uuid
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_t record;
  v_stages jsonb;
  v_current_label text;
BEGIN
  SELECT workflow_key, current_stage_key INTO v_t FROM tickets WHERE id = p_ticket_id;
  IF v_t.workflow_key IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT stage_label INTO v_current_label
    FROM ticket_workflow_stages
   WHERE ticket_id = p_ticket_id AND stage_key = v_t.current_stage_key;

  SELECT jsonb_agg(jsonb_build_object(
    'key', s.stage_key,
    'label', s.stage_label,
    'order_index', s.order_index,
    'status', s.status,
    'started_at', s.started_at,
    'completed_at', s.completed_at,
    'total_steps', (SELECT count(*) FROM ticket_workflow_steps st
                     WHERE st.ticket_id = p_ticket_id AND st.stage_key = s.stage_key),
    'completed_steps', (SELECT count(*) FROM ticket_workflow_steps st
                         WHERE st.ticket_id = p_ticket_id AND st.stage_key = s.stage_key
                           AND st.status IN ('complete','skipped')),
    'required_pending_count', (SELECT count(*) FROM ticket_workflow_steps st
                                WHERE st.ticket_id = p_ticket_id AND st.stage_key = s.stage_key
                                  AND st.is_required = true AND st.status = 'pending')
  ) ORDER BY s.order_index) INTO v_stages
  FROM ticket_workflow_stages s
  WHERE s.ticket_id = p_ticket_id;

  RETURN jsonb_build_object(
    'workflow_key', v_t.workflow_key,
    'current_stage_key', v_t.current_stage_key,
    'current_stage_label', v_current_label,
    'stages', COALESCE(v_stages, '[]'::jsonb)
  );
END;
$$;
