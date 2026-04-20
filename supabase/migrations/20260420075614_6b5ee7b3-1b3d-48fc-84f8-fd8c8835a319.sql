-- Extend unit_type enum with new values
ALTER TYPE public.unit_type ADD VALUE IF NOT EXISTS 'penthouse';
ALTER TYPE public.unit_type ADD VALUE IF NOT EXISTS 'duplex';
ALTER TYPE public.unit_type ADD VALUE IF NOT EXISTS 'villa';
ALTER TYPE public.unit_type ADD VALUE IF NOT EXISTS 'townhouse';
ALTER TYPE public.unit_type ADD VALUE IF NOT EXISTS 'warehouse';
ALTER TYPE public.unit_type ADD VALUE IF NOT EXISTS 'showroom';

-- Extend property_status enum with new values
ALTER TYPE public.property_status ADD VALUE IF NOT EXISTS 'under_maintenance';
ALTER TYPE public.property_status ADD VALUE IF NOT EXISTS 'reserved';

-- Drop monthly_rent (lives on lease, not unit)
ALTER TABLE public.units DROP COLUMN IF EXISTS monthly_rent;

-- Add new columns
ALTER TABLE public.units
  ADD COLUMN IF NOT EXISTS size_unit_preference TEXT,
  ADD COLUMN IF NOT EXISTS status_locked_by_lease_id UUID;

-- Constrain size_unit_preference to known values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'units_size_unit_preference_check'
  ) THEN
    ALTER TABLE public.units
      ADD CONSTRAINT units_size_unit_preference_check
      CHECK (size_unit_preference IS NULL OR size_unit_preference IN ('sqm', 'sqft'));
  END IF;
END$$;

-- Unique unit_number per building
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'units_building_unit_number_unique'
  ) THEN
    ALTER TABLE public.units
      ADD CONSTRAINT units_building_unit_number_unique
      UNIQUE (building_id, unit_number);
  END IF;
END$$;

-- Data-gap view: occupied but no lease
CREATE OR REPLACE VIEW public.units_with_data_gaps AS
SELECT u.*
FROM public.units u
WHERE u.status = 'occupied'
  AND u.status_locked_by_lease_id IS NULL;

-- Restrict view access to authenticated users with a role
REVOKE ALL ON public.units_with_data_gaps FROM PUBLIC;
GRANT SELECT ON public.units_with_data_gaps TO authenticated;