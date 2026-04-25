
ALTER TABLE public.service_catalog
  ADD COLUMN IF NOT EXISTS default_assignee_person_id uuid NULL REFERENCES public.people(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS default_assignee_vendor_id uuid NULL REFERENCES public.vendors(id) ON DELETE SET NULL;
