-- 1. People table: add person_type and trade_license_number
ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS person_type text NOT NULL DEFAULT 'individual',
  ADD COLUMN IF NOT EXISTS trade_license_number text;

ALTER TABLE public.people
  DROP CONSTRAINT IF EXISTS people_person_type_check;
ALTER TABLE public.people
  ADD CONSTRAINT people_person_type_check
  CHECK (person_type IN ('individual', 'company'));

-- 2. Drop the old generic links table (confirmed empty)
DROP TABLE IF EXISTS public.people_property_links CASCADE;

-- 3. Create property_owners table
CREATE TABLE public.property_owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  ownership_percentage numeric(5,2) NOT NULL DEFAULT 100.00,
  is_primary boolean NOT NULL DEFAULT false,
  acquired_on date,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT property_owners_entity_type_check CHECK (entity_type IN ('building', 'unit')),
  CONSTRAINT property_owners_percentage_check CHECK (ownership_percentage > 0 AND ownership_percentage <= 100)
);

-- Indexes
CREATE INDEX idx_property_owners_entity ON public.property_owners (entity_type, entity_id, is_primary);
CREATE INDEX idx_property_owners_person ON public.property_owners (person_id);

-- Partial unique index: only one primary per (entity_type, entity_id)
CREATE UNIQUE INDEX idx_property_owners_one_primary
  ON public.property_owners (entity_type, entity_id)
  WHERE is_primary = true;

-- updated_at trigger
CREATE TRIGGER trg_property_owners_updated_at
  BEFORE UPDATE ON public.property_owners
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Sum validation trigger (deferrable so multi-row transactions work)
CREATE OR REPLACE FUNCTION public.validate_owner_percentages()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entity_type text;
  v_entity_id uuid;
  v_sum numeric(7,2);
  v_count integer;
BEGIN
  -- Determine which group to validate
  IF TG_OP = 'DELETE' THEN
    v_entity_type := OLD.entity_type;
    v_entity_id := OLD.entity_id;
  ELSE
    v_entity_type := NEW.entity_type;
    v_entity_id := NEW.entity_id;
  END IF;

  SELECT COALESCE(SUM(ownership_percentage), 0), COUNT(*)
    INTO v_sum, v_count
    FROM public.property_owners
   WHERE entity_type = v_entity_type
     AND entity_id = v_entity_id;

  -- If zero owners remain, that's fine (inheritance / no ownership)
  IF v_count = 0 THEN
    RETURN NULL;
  END IF;

  -- Otherwise, must sum to exactly 100
  IF v_sum <> 100.00 THEN
    RAISE EXCEPTION 'Ownership percentages for % % must sum to 100, got %', v_entity_type, v_entity_id, v_sum;
  END IF;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_validate_owner_percentages
  AFTER INSERT OR UPDATE OR DELETE ON public.property_owners
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_owner_percentages();

-- 5. RLS
ALTER TABLE public.property_owners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view property_owners"
  ON public.property_owners FOR SELECT
  TO authenticated
  USING (public.has_any_role(auth.uid()));

CREATE POLICY "Staff/admin can insert property_owners"
  ON public.property_owners FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

CREATE POLICY "Staff/admin can update property_owners"
  ON public.property_owners FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

CREATE POLICY "Admin can delete property_owners"
  ON public.property_owners FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

-- 6. Helper view: units without resolvable ownership
CREATE OR REPLACE VIEW public.units_without_owners AS
SELECT u.*
  FROM public.units u
  LEFT JOIN public.property_owners po
    ON po.entity_type = 'unit' AND po.entity_id = u.id
  LEFT JOIN public.property_owners pob
    ON pob.entity_type = 'building' AND pob.entity_id = u.building_id
 WHERE po.id IS NULL AND pob.id IS NULL;

-- 7. Helper function: resolve owners for a unit (unit-level, else building-level)
CREATE OR REPLACE FUNCTION public.resolve_unit_owners(_unit_id uuid)
RETURNS TABLE (
  person_id uuid,
  ownership_percentage numeric(5,2),
  is_primary boolean,
  source text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT po.person_id, po.ownership_percentage, po.is_primary, 'unit'::text AS source
    FROM public.property_owners po
   WHERE po.entity_type = 'unit' AND po.entity_id = _unit_id
  UNION ALL
  SELECT pob.person_id, pob.ownership_percentage, pob.is_primary, 'building'::text AS source
    FROM public.units u
    JOIN public.property_owners pob
      ON pob.entity_type = 'building' AND pob.entity_id = u.building_id
   WHERE u.id = _unit_id
     AND NOT EXISTS (
       SELECT 1 FROM public.property_owners po2
        WHERE po2.entity_type = 'unit' AND po2.entity_id = _unit_id
     );
$$;