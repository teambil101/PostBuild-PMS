-- Recreate view with security_invoker so RLS is enforced per caller
DROP VIEW IF EXISTS public.units_with_data_gaps;

CREATE VIEW public.units_with_data_gaps
WITH (security_invoker = true) AS
SELECT u.*
FROM public.units u
WHERE u.status = 'occupied'
  AND u.status_locked_by_lease_id IS NULL;

REVOKE ALL ON public.units_with_data_gaps FROM PUBLIC;
GRANT SELECT ON public.units_with_data_gaps TO authenticated;