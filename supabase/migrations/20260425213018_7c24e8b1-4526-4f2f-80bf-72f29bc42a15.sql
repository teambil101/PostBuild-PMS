-- Defense in depth: brokers (and owners) cannot publish service_catalog rows.
-- Only workspaces of kind 'internal' (and future 'provider') may write.

-- Helper: is the given workspace a publisher (internal/provider)?
CREATE OR REPLACE FUNCTION public.is_publisher_workspace(_workspace_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE id = _workspace_id
      AND kind IN ('internal')  -- 'provider' will join here in Phase 4
  );
$$;

-- Drop any existing write policies on service_catalog so we can re-define cleanly
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'service_catalog'
      AND cmd IN ('INSERT','UPDATE','DELETE')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.service_catalog', pol.policyname);
  END LOOP;
END $$;

-- INSERT: only members of a publisher workspace, inserting into that workspace
CREATE POLICY "publishers can insert catalog"
ON public.service_catalog
FOR INSERT
TO authenticated
WITH CHECK (
  workspace_id IN (SELECT public.current_user_workspace_ids())
  AND public.is_publisher_workspace(workspace_id)
);

-- UPDATE: same rule
CREATE POLICY "publishers can update catalog"
ON public.service_catalog
FOR UPDATE
TO authenticated
USING (
  workspace_id IN (SELECT public.current_user_workspace_ids())
  AND public.is_publisher_workspace(workspace_id)
)
WITH CHECK (
  workspace_id IN (SELECT public.current_user_workspace_ids())
  AND public.is_publisher_workspace(workspace_id)
);

-- DELETE: same rule
CREATE POLICY "publishers can delete catalog"
ON public.service_catalog
FOR DELETE
TO authenticated
USING (
  workspace_id IN (SELECT public.current_user_workspace_ids())
  AND public.is_publisher_workspace(workspace_id)
);