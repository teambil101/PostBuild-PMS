-- ============================================================
-- L2 Schema changes: leads conversion + tickets target 'lead'
-- ============================================================

-- 1a. Prevent multiple leads claiming the same contract.
CREATE UNIQUE INDEX IF NOT EXISTS leads_won_contract_id_unique
  ON public.leads (won_contract_id)
  WHERE won_contract_id IS NOT NULL;

-- 1b. Allow tickets.target_entity_type = 'lead'.
ALTER TABLE public.tickets
  DROP CONSTRAINT IF EXISTS tickets_target_entity_type_check;

ALTER TABLE public.tickets
  ADD CONSTRAINT tickets_target_entity_type_check
  CHECK (target_entity_type = ANY (
    ARRAY['unit'::text, 'building'::text, 'contract'::text,
          'person'::text, 'cheque'::text, 'vendor'::text, 'lead'::text]
  ));

-- 1c. Extend resolve_ticket_target_label RPC to handle 'lead'.
CREATE OR REPLACE FUNCTION public.resolve_ticket_target_label(p_entity_type text, p_entity_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_label text;
BEGIN
  IF p_entity_type = 'unit' THEN
    SELECT 'Unit ' || u.unit_number || ' · ' || b.name
      INTO v_label
      FROM units u
      JOIN buildings b ON b.id = u.building_id
     WHERE u.id = p_entity_id;
  ELSIF p_entity_type = 'building' THEN
    SELECT b.name INTO v_label FROM buildings b WHERE b.id = p_entity_id;
  ELSIF p_entity_type = 'contract' THEN
    SELECT
      CASE c.contract_type
        WHEN 'lease' THEN 'Lease ' || c.contract_number
        WHEN 'management_agreement' THEN 'Management Agreement ' || c.contract_number
        ELSE initcap(replace(c.contract_type,'_',' ')) || ' ' || c.contract_number
      END
      INTO v_label
      FROM contracts c
     WHERE c.id = p_entity_id;
  ELSIF p_entity_type = 'person' THEN
    SELECT trim(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,''))
      INTO v_label
      FROM people p
     WHERE p.id = p_entity_id;
  ELSIF p_entity_type = 'cheque' THEN
    SELECT 'Cheque #' || lc.sequence_number || ' · ' || c.contract_number
      INTO v_label
      FROM lease_cheques lc
      JOIN leases l ON l.id = lc.lease_id
      JOIN contracts c ON c.id = l.contract_id
     WHERE lc.id = p_entity_id;
  ELSIF p_entity_type = 'vendor' THEN
    SELECT COALESCE(NULLIF(trim(v.display_name), ''), v.legal_name) || ' · ' || v.vendor_number
      INTO v_label
      FROM vendors v
     WHERE v.id = p_entity_id;
  ELSIF p_entity_type = 'lead' THEN
    SELECT trim(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'')) || ' · ' || l.lead_number
      INTO v_label
      FROM leads l
      JOIN people p ON p.id = l.primary_contact_id
     WHERE l.id = p_entity_id;
  ELSE
    RETURN NULL;
  END IF;

  RETURN v_label;
END;
$function$;