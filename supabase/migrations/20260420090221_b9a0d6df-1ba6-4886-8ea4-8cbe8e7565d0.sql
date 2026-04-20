DROP VIEW IF EXISTS public.units_without_owners;

CREATE VIEW public.units_without_owners
  WITH (security_invoker = true)
AS
SELECT u.*
  FROM public.units u
  LEFT JOIN public.property_owners po
    ON po.entity_type = 'unit' AND po.entity_id = u.id
  LEFT JOIN public.property_owners pob
    ON pob.entity_type = 'building' AND pob.entity_id = u.building_id
 WHERE po.id IS NULL AND pob.id IS NULL;