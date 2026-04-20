-- Add structured location fields back for Google Places integration
ALTER TABLE public.buildings
  ADD COLUMN IF NOT EXISTS address_formatted text,
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric,
  ADD COLUMN IF NOT EXISTS place_id text;

-- Relax the address validation trigger: address becomes optional now that we have structured fields
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
  -- Require at least one of: address (free text) OR address_formatted (from Places)
  IF (NEW.address IS NULL OR char_length(TRIM(NEW.address)) < 3)
     AND (NEW.address_formatted IS NULL OR char_length(TRIM(NEW.address_formatted)) < 3) THEN
    RAISE EXCEPTION 'address is required (min 3 chars)';
  END IF;
  IF NEW.city IS NULL OR char_length(TRIM(NEW.city)) = 0 THEN
    RAISE EXCEPTION 'city is required';
  END IF;
  RETURN NEW;
END;
$function$;

-- Make legacy address column nullable now that address_formatted can satisfy the requirement
ALTER TABLE public.buildings ALTER COLUMN address DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_buildings_place_id ON public.buildings(place_id);