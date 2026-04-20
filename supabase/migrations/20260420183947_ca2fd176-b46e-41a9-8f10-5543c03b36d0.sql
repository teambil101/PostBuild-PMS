-- Admin-only RPC: list every auth.users row paired with their linked person (if any).
-- Used by the Settings → Team Members section to assign auth identities to people records.

CREATE OR REPLACE FUNCTION public.list_auth_users_with_person()
RETURNS TABLE (
  auth_user_id uuid,
  email text,
  created_at timestamptz,
  person_id uuid,
  person_first_name text,
  person_last_name text,
  person_ref_code text,
  person_roles person_role[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    u.id          AS auth_user_id,
    u.email::text AS email,
    u.created_at  AS created_at,
    p.id          AS person_id,
    p.first_name  AS person_first_name,
    p.last_name   AS person_last_name,
    p.ref_code    AS person_ref_code,
    p.roles       AS person_roles
  FROM auth.users u
  LEFT JOIN public.people p ON p.auth_user_id = u.id
  WHERE public.has_role(auth.uid(), 'admin'::app_role)
  ORDER BY u.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.list_auth_users_with_person() TO authenticated;

-- Admin helper to clear auth_user_id on a given person row.
-- (Linking is done via a normal UPDATE on people.auth_user_id, gated by the
-- existing Staff/admin update policy.)
COMMENT ON FUNCTION public.list_auth_users_with_person() IS
  'Admin-only: lists every auth.users row joined to their linked people record. Used by Settings.';
