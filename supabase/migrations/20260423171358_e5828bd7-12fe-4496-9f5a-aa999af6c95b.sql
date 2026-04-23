
-- Add free-text companion columns for "Other" dropdown selections.
-- Pattern: when a controlled enum/value is "other", a *_other text column captures the user's specification.

ALTER TABLE public.buildings
  ADD COLUMN IF NOT EXISTS building_type_other text;

ALTER TABLE public.vendor_contacts
  ADD COLUMN IF NOT EXISTS role_other text;

ALTER TABLE public.service_catalog
  ADD COLUMN IF NOT EXISTS category_other text;

ALTER TABLE public.service_requests
  ADD COLUMN IF NOT EXISTS category_other text;

ALTER TABLE public.service_request_steps
  ADD COLUMN IF NOT EXISTS category_other text;

COMMENT ON COLUMN public.buildings.building_type_other IS 'Free-text description used when building_type = other';
COMMENT ON COLUMN public.vendor_contacts.role_other IS 'Free-text description used when role = other';
COMMENT ON COLUMN public.service_catalog.category_other IS 'Free-text description used when category = other';
COMMENT ON COLUMN public.service_requests.category_other IS 'Free-text description used when category = other';
COMMENT ON COLUMN public.service_request_steps.category_other IS 'Free-text description used when category = other';
