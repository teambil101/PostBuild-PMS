-- Add new address column
ALTER TABLE public.buildings ADD COLUMN IF NOT EXISTS address text;

-- Backfill address from existing fields if any data exists
UPDATE public.buildings
SET address = COALESCE(
  NULLIF(TRIM(CONCAT_WS(', ',
    NULLIF(street, ''),
    NULLIF(address_formatted, '')
  )), ''),
  'Address not specified'
)
WHERE address IS NULL;

-- Backfill city for existing rows
UPDATE public.buildings SET city = 'Dubai' WHERE city IS NULL OR city = '';
UPDATE public.buildings SET country = 'AE' WHERE country IS NULL OR country = '';

-- Drop unused columns
ALTER TABLE public.buildings
  DROP COLUMN IF EXISTS street,
  DROP COLUMN IF EXISTS state_region,
  DROP COLUMN IF EXISTS postal_code,
  DROP COLUMN IF EXISTS latitude,
  DROP COLUMN IF EXISTS longitude,
  DROP COLUMN IF EXISTS place_id,
  DROP COLUMN IF EXISTS address_formatted,
  DROP COLUMN IF EXISTS notes;

-- Make required fields NOT NULL
ALTER TABLE public.buildings ALTER COLUMN address SET NOT NULL;
ALTER TABLE public.buildings ALTER COLUMN city SET NOT NULL;
ALTER TABLE public.buildings ALTER COLUMN country SET NOT NULL;
ALTER TABLE public.buildings ALTER COLUMN country SET DEFAULT 'AE';

-- Drop old index if it exists
DROP INDEX IF EXISTS idx_buildings_country_community;

-- New filtering index
CREATE INDEX IF NOT EXISTS idx_buildings_country_city_community
  ON public.buildings (country, city, community);

-- Update validation trigger
CREATE OR REPLACE FUNCTION public.validate_building_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.building_type NOT IN ('residential_tower','villa_compound','mixed_use','commercial','other') THEN
    RAISE EXCEPTION 'Invalid building_type: %', NEW.building_type;
  END IF;
  IF NEW.country IS NULL OR char_length(NEW.country) <> 2 THEN
    RAISE EXCEPTION 'country must be a 2-char ISO code, got: %', NEW.country;
  END IF;
  IF NEW.address IS NULL OR char_length(TRIM(NEW.address)) < 3 THEN
    RAISE EXCEPTION 'address is required (min 3 chars)';
  END IF;
  IF NEW.city IS NULL OR char_length(TRIM(NEW.city)) = 0 THEN
    RAISE EXCEPTION 'city is required';
  END IF;
  RETURN NEW;
END;
$function$;

-- Ensure trigger is attached
DROP TRIGGER IF EXISTS validate_building_fields_trigger ON public.buildings;
CREATE TRIGGER validate_building_fields_trigger
  BEFORE INSERT OR UPDATE ON public.buildings
  FOR EACH ROW EXECUTE FUNCTION public.validate_building_fields();