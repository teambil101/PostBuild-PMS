
DROP POLICY IF EXISTS "Anyone can read invitation by token" ON public.workspace_invitations;
CREATE POLICY "Anyone can read invitation by token"
  ON public.workspace_invitations FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can manage invitations" ON public.workspace_invitations;
CREATE POLICY "Admins can manage invitations"
  ON public.workspace_invitations FOR ALL
  TO authenticated
  USING (public.has_workspace_role(workspace_id, ARRAY['owner','admin','manager']::public.workspace_member_role[]))
  WITH CHECK (public.has_workspace_role(workspace_id, ARRAY['owner','admin','manager']::public.workspace_member_role[]));

CREATE OR REPLACE FUNCTION public.lookup_invitation(_token text)
RETURNS TABLE (
  workspace_id uuid,
  workspace_name text,
  workspace_kind public.workspace_kind,
  email text,
  role public.workspace_member_role,
  expires_at timestamptz,
  accepted_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT wi.workspace_id, w.name, w.kind, wi.email, wi.role, wi.expires_at, wi.accepted_at
  FROM public.workspace_invitations wi
  JOIN public.workspaces w ON w.id = wi.workspace_id
  WHERE wi.token = _token
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.lookup_invitation(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.accept_workspace_invitation(_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv public.workspace_invitations%ROWTYPE;
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO inv FROM public.workspace_invitations WHERE token = _token LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid invitation'; END IF;
  IF inv.accepted_at IS NOT NULL THEN RAISE EXCEPTION 'Invitation already used'; END IF;
  IF inv.expires_at < now() THEN RAISE EXCEPTION 'Invitation expired'; END IF;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (inv.workspace_id, uid, inv.role)
  ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role;

  UPDATE public.workspace_invitations
  SET accepted_at = now(), accepted_by = uid
  WHERE id = inv.id;

  RETURN inv.workspace_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_workspace_invitation(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.owner_onboard_property(
  _workspace_id uuid,
  _name text,
  _address_line1 text,
  _city text,
  _country text DEFAULT 'AE'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  new_building_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_workspace_member(_workspace_id) THEN
    RAISE EXCEPTION 'Not a member of this workspace';
  END IF;

  INSERT INTO public.buildings (workspace_id, name, address_line1, city, country, status)
  VALUES (_workspace_id, _name, _address_line1, _city, _country, 'active')
  RETURNING id INTO new_building_id;

  RETURN new_building_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_onboard_property(uuid, text, text, text, text) TO authenticated;
