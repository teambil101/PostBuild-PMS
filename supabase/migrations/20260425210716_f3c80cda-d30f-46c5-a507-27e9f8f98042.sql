
-- 1. New columns
ALTER TABLE public.service_catalog
  ADD COLUMN IF NOT EXISTS is_marketplace boolean NOT NULL DEFAULT false;

ALTER TABLE public.service_requests
  ADD COLUMN IF NOT EXISTS fulfilling_workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_service_requests_fulfilling_workspace
  ON public.service_requests(fulfilling_workspace_id);

CREATE INDEX IF NOT EXISTS idx_service_catalog_marketplace
  ON public.service_catalog(is_marketplace) WHERE is_marketplace = true;

-- 2. Seed: all current catalog items in the bootstrap True Build HQ workspace become marketplace
UPDATE public.service_catalog
SET is_marketplace = true
WHERE workspace_id IN (
  SELECT id FROM public.workspaces WHERE kind = 'internal' AND slug = 'true-build-hq'
);

-- 3. RLS: marketplace catalog items visible to any authenticated user
DROP POLICY IF EXISTS "Members can view catalog" ON public.service_catalog;
DROP POLICY IF EXISTS "Marketplace catalog visible to all" ON public.service_catalog;
CREATE POLICY "Marketplace catalog visible to all"
  ON public.service_catalog FOR SELECT
  TO authenticated
  USING (
    is_marketplace = true
    OR workspace_id IN (SELECT public.current_user_workspace_ids())
  );

-- Keep manage policies workspace-scoped
DROP POLICY IF EXISTS "Members can manage their catalog" ON public.service_catalog;
CREATE POLICY "Members can manage their catalog"
  ON public.service_catalog FOR ALL
  TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT public.current_user_workspace_ids()));

-- 4. RLS: service_requests — visible to either workspace
DROP POLICY IF EXISTS "Members can view requests" ON public.service_requests;
DROP POLICY IF EXISTS "Members can view requests in either workspace" ON public.service_requests;
CREATE POLICY "Members can view requests in either workspace"
  ON public.service_requests FOR SELECT
  TO authenticated
  USING (
    workspace_id IN (SELECT public.current_user_workspace_ids())
    OR fulfilling_workspace_id IN (SELECT public.current_user_workspace_ids())
  );

DROP POLICY IF EXISTS "Members can manage requests" ON public.service_requests;
DROP POLICY IF EXISTS "Members can manage requests in either workspace" ON public.service_requests;
CREATE POLICY "Members can manage requests in either workspace"
  ON public.service_requests FOR ALL
  TO authenticated
  USING (
    workspace_id IN (SELECT public.current_user_workspace_ids())
    OR fulfilling_workspace_id IN (SELECT public.current_user_workspace_ids())
  )
  WITH CHECK (
    workspace_id IN (SELECT public.current_user_workspace_ids())
    OR fulfilling_workspace_id IN (SELECT public.current_user_workspace_ids())
  );

-- 5. Cross-workspace request RPC
CREATE OR REPLACE FUNCTION public.create_marketplace_service_request(
  _requester_workspace_id uuid,
  _catalog_id uuid,
  _building_id uuid,
  _description text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  v_catalog public.service_catalog%ROWTYPE;
  v_building public.buildings%ROWTYPE;
  v_request_id uuid;
  v_request_number text;
  v_year integer := EXTRACT(YEAR FROM now())::integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_workspace_member(_requester_workspace_id) THEN
    RAISE EXCEPTION 'Not a member of the requester workspace';
  END IF;

  SELECT * INTO v_catalog FROM public.service_catalog WHERE id = _catalog_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Catalog entry not found'; END IF;
  IF NOT v_catalog.is_marketplace THEN
    RAISE EXCEPTION 'Catalog item is not available on the marketplace';
  END IF;

  SELECT * INTO v_building FROM public.buildings
   WHERE id = _building_id AND workspace_id = _requester_workspace_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Building not found in your workspace'; END IF;

  v_request_number := public.next_number('SRQ', v_year);

  INSERT INTO public.service_requests (
    workspace_id,
    fulfilling_workspace_id,
    request_number,
    catalog_id,
    title,
    category,
    category_other,
    is_workflow,
    target_type,
    target_id,
    description,
    source,
    status,
    priority,
    delivery,
    billing,
    bill_to,
    workflow_steps,
    created_by
  ) VALUES (
    _requester_workspace_id,
    v_catalog.workspace_id, -- fulfillment goes to the catalog publisher
    v_request_number,
    v_catalog.id,
    v_catalog.name,
    v_catalog.category,
    v_catalog.category_other,
    v_catalog.is_workflow,
    'building',
    _building_id,
    _description,
    'marketplace',
    'requested',
    'normal',
    v_catalog.default_delivery,
    v_catalog.default_billing,
    'owner',
    v_catalog.workflow_steps,
    uid
  )
  RETURNING id INTO v_request_id;

  -- Best-effort event log (table may or may not exist)
  BEGIN
    INSERT INTO public.service_request_events (request_id, event_type, description, request_number)
    VALUES (v_request_id, 'created', 'Request submitted from marketplace', v_request_number);
  EXCEPTION WHEN undefined_column OR undefined_table THEN
    NULL;
  END;

  RETURN v_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_marketplace_service_request(uuid, uuid, uuid, text) TO authenticated;
