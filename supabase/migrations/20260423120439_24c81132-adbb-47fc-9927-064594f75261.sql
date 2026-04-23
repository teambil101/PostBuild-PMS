DROP TABLE IF EXISTS public.lease_cheques CASCADE;
DROP TABLE IF EXISTS public.leases CASCADE;
DROP TABLE IF EXISTS public.management_agreements CASCADE;
DROP TABLE IF EXISTS public.contract_parties CASCADE;
DROP TABLE IF EXISTS public.contract_subjects CASCADE;
DROP TABLE IF EXISTS public.contract_events CASCADE;
DROP TABLE IF EXISTS public.contracts CASCADE;

ALTER TABLE public.units DROP COLUMN IF EXISTS status_locked_by_lease_id CASCADE;
ALTER TABLE public.leads DROP COLUMN IF EXISTS won_contract_id;

-- Recreate the two helper views without the lease-lock column.
CREATE OR REPLACE VIEW public.units_with_data_gaps AS
SELECT u.*
FROM public.units u
WHERE u.size_sqm IS NULL
   OR u.bedrooms IS NULL
   OR u.bathrooms IS NULL;

CREATE OR REPLACE VIEW public.units_without_owners AS
SELECT u.*
FROM public.units u
WHERE NOT EXISTS (
  SELECT 1 FROM public.property_owners po
  WHERE po.entity_type = 'unit' AND po.entity_id = u.id
);