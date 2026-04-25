
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
  generated_ref text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_workspace_member(_workspace_id) THEN
    RAISE EXCEPTION 'Not a member of this workspace';
  END IF;

  generated_ref := 'BLD-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  INSERT INTO public.buildings (workspace_id, name, street, city, country, ref_code, created_by)
  VALUES (_workspace_id, _name, _address_line1, _city, _country, generated_ref, uid)
  RETURNING id INTO new_building_id;

  RETURN new_building_id;
END;
$$;
