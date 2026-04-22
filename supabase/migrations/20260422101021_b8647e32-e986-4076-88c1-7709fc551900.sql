-- Add listing fields to units
ALTER TABLE public.units
  ADD COLUMN IF NOT EXISTS listed_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS asking_rent numeric NULL,
  ADD COLUMN IF NOT EXISTS asking_rent_currency text NULL DEFAULT 'AED',
  ADD COLUMN IF NOT EXISTS listing_notes text NULL;

-- Auto-clear listing when unit leaves the vacant state
CREATE OR REPLACE FUNCTION public.clear_unit_listing_on_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'vacant' THEN
    NEW.listed_at := NULL;
    NEW.asking_rent := NULL;
    NEW.listing_notes := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_units_clear_listing ON public.units;
CREATE TRIGGER trg_units_clear_listing
BEFORE UPDATE ON public.units
FOR EACH ROW
EXECUTE FUNCTION public.clear_unit_listing_on_status_change();

-- Helpful index for the lifecycle funnel
CREATE INDEX IF NOT EXISTS idx_units_listed_at ON public.units(listed_at) WHERE listed_at IS NOT NULL;