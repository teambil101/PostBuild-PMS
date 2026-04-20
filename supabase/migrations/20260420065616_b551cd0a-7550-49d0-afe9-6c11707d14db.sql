-- Drop columns no longer used
ALTER TABLE public.buildings
  DROP COLUMN IF EXISTS description,
  DROP COLUMN IF EXISTS year_built,
  DROP COLUMN IF EXISTS total_floors,
  DROP COLUMN IF EXISTS cover_image_url,
  DROP COLUMN IF EXISTS address_line2;

-- Rename existing columns to match new schema
ALTER TABLE public.buildings RENAME COLUMN address_line1 TO street;
ALTER TABLE public.buildings RENAME COLUMN state TO state_region;

-- Add new columns
ALTER TABLE public.buildings
  ADD COLUMN IF NOT EXISTS address_formatted text,
  ADD COLUMN IF NOT EXISTS place_id text,
  ADD COLUMN IF NOT EXISTS building_type text NOT NULL DEFAULT 'residential_tower',
  ADD COLUMN IF NOT EXISTS community text;

-- Country: default to AE, enforce 2-char ISO code
ALTER TABLE public.buildings
  ALTER COLUMN country SET DEFAULT 'AE';

UPDATE public.buildings SET country = 'AE' WHERE country IS NULL;

-- Validation trigger for building_type and country length
CREATE OR REPLACE FUNCTION public.validate_building_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.building_type NOT IN ('residential_tower','villa_compound','mixed_use','commercial','other') THEN
    RAISE EXCEPTION 'Invalid building_type: %', NEW.building_type;
  END IF;
  IF NEW.country IS NOT NULL AND char_length(NEW.country) <> 2 THEN
    RAISE EXCEPTION 'country must be a 2-char ISO code, got: %', NEW.country;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_building_fields_trigger ON public.buildings;
CREATE TRIGGER validate_building_fields_trigger
  BEFORE INSERT OR UPDATE ON public.buildings
  FOR EACH ROW EXECUTE FUNCTION public.validate_building_fields();

-- Index for portfolio filtering
CREATE INDEX IF NOT EXISTS idx_buildings_country_community
  ON public.buildings (country, community);