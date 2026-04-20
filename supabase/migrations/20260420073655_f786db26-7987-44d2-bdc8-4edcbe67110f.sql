ALTER TABLE public.buildings
  DROP COLUMN IF EXISTS address_formatted,
  DROP COLUMN IF EXISTS latitude,
  DROP COLUMN IF EXISTS longitude,
  DROP COLUMN IF EXISTS place_id,
  DROP COLUMN IF EXISTS address;

ALTER TABLE public.buildings
  ADD COLUMN IF NOT EXISTS location_url text;

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
  IF NEW.city IS NULL OR char_length(TRIM(NEW.city)) = 0 THEN
    RAISE EXCEPTION 'city is required';
  END IF;
  IF NEW.location_url IS NOT NULL AND NEW.location_url !~* '^https?://' THEN
    RAISE EXCEPTION 'location_url must start with http:// or https://';
  END IF;
  RETURN NEW;
END;
$function$;