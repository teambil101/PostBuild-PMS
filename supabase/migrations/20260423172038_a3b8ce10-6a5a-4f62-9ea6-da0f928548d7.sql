CREATE OR REPLACE FUNCTION public.create_service_request_from_catalog(
  p_catalog_id uuid,
  p_target_type text,
  p_target_id uuid,
  p_priority service_request_priority DEFAULT 'normal'::service_request_priority,
  p_scheduled_date date DEFAULT NULL::date,
  p_description text DEFAULT NULL::text,
  p_assigned_vendor_id uuid DEFAULT NULL::uuid,
  p_assigned_person_id uuid DEFAULT NULL::uuid,
  p_requested_by_person_id uuid DEFAULT NULL::uuid,
  p_source text DEFAULT 'staff'::text,
  p_cost_estimate numeric DEFAULT NULL::numeric,
  p_override_title text DEFAULT NULL::text,
  p_internal_notes text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_catalog public.service_catalog%ROWTYPE;
  v_step_catalog public.service_catalog%ROWTYPE;
  v_request_id uuid;
  v_request_number text;
  v_year integer := EXTRACT(YEAR FROM now())::integer;
  v_step jsonb;
  v_idx integer := 0;
  v_catalog_id_text text;
BEGIN
  SELECT * INTO v_catalog FROM public.service_catalog WHERE id = p_catalog_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Catalog entry not found: %', p_catalog_id;
  END IF;

  v_request_number := public.next_number('SRQ', v_year);

  INSERT INTO public.service_requests (
    request_number, catalog_id, title, category, category_other, is_workflow,
    target_type, target_id, priority, scheduled_date,
    delivery, billing, assigned_vendor_id, assigned_person_id,
    requested_by_person_id, source, cost_estimate,
    description, internal_notes
  ) VALUES (
    v_request_number, v_catalog.id,
    COALESCE(p_override_title, v_catalog.name),
    v_catalog.category, v_catalog.category_other, v_catalog.is_workflow,
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
      v_catalog_id_text := NULLIF(v_step->>'catalog_id', '');

      IF v_catalog_id_text IS NOT NULL THEN
        -- New shape: step references another catalog entry
        SELECT * INTO v_step_catalog
          FROM public.service_catalog
         WHERE id = v_catalog_id_text::uuid;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'Workflow step references missing catalog entry %', v_catalog_id_text;
        END IF;

        INSERT INTO public.service_request_steps (
          request_id, step_key, title, sort_order, category, category_other,
          delivery, billing, blocks_next, typical_duration_days
        ) VALUES (
          v_request_id,
          COALESCE(NULLIF(v_step->>'key', ''), v_step_catalog.code),
          COALESCE(NULLIF(v_step->>'title_override', ''), v_step_catalog.name),
          v_idx,
          v_step_catalog.category,
          v_step_catalog.category_other,
          v_step_catalog.default_delivery,
          v_step_catalog.default_billing,
          COALESCE((v_step->>'blocks_next')::boolean, false),
          COALESCE(
            NULLIF(v_step->>'duration_override_days', '')::integer,
            v_step_catalog.typical_duration_days
          )
        );
      ELSE
        -- Legacy fallback: inline step shape
        INSERT INTO public.service_request_steps (
          request_id, step_key, title, sort_order, category, category_other,
          delivery, billing, blocks_next, typical_duration_days
        ) VALUES (
          v_request_id,
          v_step->>'key',
          v_step->>'title',
          v_idx,
          (v_step->>'category')::public.service_category,
          NULLIF(v_step->>'category_other', ''),
          COALESCE((v_step->>'default_delivery')::public.service_delivery, 'staff'::public.service_delivery),
          COALESCE((v_step->>'default_billing')::public.service_billing, 'free'::public.service_billing),
          COALESCE((v_step->>'blocks_next')::boolean, false),
          NULLIF(v_step->>'typical_duration_days', '')::integer
        );
      END IF;

      v_idx := v_idx + 1;
    END LOOP;
  END IF;

  -- Audit
  INSERT INTO public.service_request_events (request_id, event_type, description, to_value)
  VALUES (v_request_id, 'created', 'Request created from catalog', v_request_number);

  RETURN v_request_id;
END;
$function$;