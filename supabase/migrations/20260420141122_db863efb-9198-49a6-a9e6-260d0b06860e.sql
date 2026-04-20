-- 1. Dedup key + indexes
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS system_dedup_key text;

CREATE INDEX IF NOT EXISTS idx_tickets_dedup
  ON public.tickets (target_entity_type, target_entity_id, ticket_type, status);

CREATE INDEX IF NOT EXISTS idx_tickets_system_dedup
  ON public.tickets (system_dedup_key)
  WHERE system_dedup_key IS NOT NULL;

-- 2. Bounced cheque trigger function
CREATE OR REPLACE FUNCTION public.auto_create_bounced_cheque_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contract_number text;
  v_ticket_number   text;
  v_dedup_key       text;
BEGIN
  v_dedup_key := 'cheque_bounce:' || NEW.id::text;

  -- Skip if a non-terminal ticket for this bounce already exists.
  IF EXISTS (
    SELECT 1 FROM public.tickets
     WHERE system_dedup_key = v_dedup_key
       AND status NOT IN ('closed', 'cancelled')
  ) THEN
    RETURN NEW;
  END IF;

  SELECT c.contract_number
    INTO v_contract_number
    FROM public.leases l
    JOIN public.contracts c ON c.id = l.contract_id
   WHERE l.id = NEW.lease_id;

  v_ticket_number := public.next_number('TKT', EXTRACT(YEAR FROM now())::int);

  INSERT INTO public.tickets (
    ticket_number, subject, description,
    ticket_type, priority, status,
    target_entity_type, target_entity_id,
    is_system_generated, created_by, system_dedup_key
  ) VALUES (
    v_ticket_number,
    'Bounced cheque: ' || COALESCE(v_contract_number, 'lease') || ' #' || NEW.sequence_number,
    'Cheque for AED ' || to_char(NEW.amount, 'FM999G999G999D00') ||
      ' bounced on ' || COALESCE(NEW.bounced_on::text, 'unknown date') ||
      '. Reason: ' || COALESCE(NEW.bounce_reason, 'not specified') ||
      E'.\n\nContact tenant to arrange replacement cheque. Log replacement on the lease Cheques tab.',
    'rent_follow_up',
    'high',
    'open',
    'cheque',
    NEW.id,
    true,
    NULL,
    v_dedup_key
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_create_bounced_cheque_ticket ON public.lease_cheques;

CREATE TRIGGER trg_auto_create_bounced_cheque_ticket
  AFTER UPDATE OF status ON public.lease_cheques
  FOR EACH ROW
  WHEN (NEW.status = 'bounced' AND OLD.status IS DISTINCT FROM 'bounced')
  EXECUTE FUNCTION public.auto_create_bounced_cheque_ticket();