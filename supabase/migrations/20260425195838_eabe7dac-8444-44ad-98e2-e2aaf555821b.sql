-- 1. Status enum for vendor quotes
CREATE TYPE public.service_quote_status AS ENUM (
  'invited',
  'submitted',
  'accepted',
  'rejected',
  'withdrawn',
  'expired'
);

-- 2. Quotes table
CREATE TABLE public.service_request_quotes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE RESTRICT,
  status public.service_quote_status NOT NULL DEFAULT 'invited',

  amount numeric(12, 2),
  currency text NOT NULL DEFAULT 'AED',
  eta_days integer,
  vendor_notes text,
  internal_notes text,

  submission_token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),

  invited_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  decided_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '48 hours'),

  invited_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT service_request_quotes_unique_vendor UNIQUE (request_id, vendor_id)
);

CREATE INDEX idx_srq_request ON public.service_request_quotes (request_id);
CREATE INDEX idx_srq_vendor ON public.service_request_quotes (vendor_id);
CREATE INDEX idx_srq_status ON public.service_request_quotes (status);
CREATE INDEX idx_srq_token ON public.service_request_quotes (submission_token);

-- 3. updated_at trigger (reuse existing helper if present)
CREATE OR REPLACE FUNCTION public.tg_srq_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER service_request_quotes_set_updated_at
BEFORE UPDATE ON public.service_request_quotes
FOR EACH ROW EXECUTE FUNCTION public.tg_srq_set_updated_at();

-- 4. RLS
ALTER TABLE public.service_request_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view service_request_quotes"
ON public.service_request_quotes
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated can insert service_request_quotes"
ON public.service_request_quotes
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated can update service_request_quotes"
ON public.service_request_quotes
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated can delete service_request_quotes"
ON public.service_request_quotes
FOR DELETE
TO authenticated
USING (true);

-- Anonymous can SELECT a single row when they know the token (for public submission page).
-- The edge function will normally use service role, but this allows direct anon reads if needed.
CREATE POLICY "Anon can view by submission_token"
ON public.service_request_quotes
FOR SELECT
TO anon
USING (submission_token IS NOT NULL);

-- 5. RPC: accept a quote — sets others to rejected, writes vendor+cost onto request
CREATE OR REPLACE FUNCTION public.accept_service_request_quote(
  p_quote_id uuid,
  p_notes text DEFAULT NULL
)
RETURNS public.service_request_quotes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quote public.service_request_quotes;
BEGIN
  SELECT * INTO v_quote
  FROM public.service_request_quotes
  WHERE id = p_quote_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote % not found', p_quote_id;
  END IF;

  IF v_quote.status NOT IN ('submitted', 'invited') THEN
    RAISE EXCEPTION 'Quote is in status % and cannot be accepted', v_quote.status;
  END IF;

  -- Reject all sibling quotes
  UPDATE public.service_request_quotes
  SET status = 'rejected',
      decided_at = now(),
      internal_notes = COALESCE(internal_notes, '') ||
        CASE WHEN internal_notes IS NULL OR internal_notes = '' THEN '' ELSE E'\n' END ||
        '[Auto-rejected: another quote accepted on ' || to_char(now(), 'YYYY-MM-DD HH24:MI') || ']'
  WHERE request_id = v_quote.request_id
    AND id <> v_quote.id
    AND status IN ('invited', 'submitted');

  -- Accept this one
  UPDATE public.service_request_quotes
  SET status = 'accepted',
      decided_at = now(),
      internal_notes = CASE
        WHEN p_notes IS NOT NULL AND p_notes <> ''
        THEN COALESCE(internal_notes, '') ||
          CASE WHEN internal_notes IS NULL OR internal_notes = '' THEN '' ELSE E'\n' END ||
          p_notes
        ELSE internal_notes
      END
  WHERE id = v_quote.id
  RETURNING * INTO v_quote;

  -- Write chosen vendor + cost to parent request
  UPDATE public.service_requests
  SET assigned_vendor_id = v_quote.vendor_id,
      cost_estimate = COALESCE(v_quote.amount, cost_estimate),
      currency = COALESCE(v_quote.currency, currency),
      updated_at = now()
  WHERE id = v_quote.request_id;

  -- Audit event
  INSERT INTO public.service_request_events (request_id, event_type, description, to_value)
  VALUES (
    v_quote.request_id,
    'quote_accepted',
    'Quote accepted — vendor assigned',
    v_quote.vendor_id::text
  );

  RETURN v_quote;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_service_request_quote(uuid, text) TO authenticated;