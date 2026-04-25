ALTER TABLE public.number_sequences ADD COLUMN IF NOT EXISTS workspace_id uuid;
ALTER TABLE public.number_sequences DROP CONSTRAINT IF EXISTS number_sequences_pkey;
CREATE UNIQUE INDEX IF NOT EXISTS number_sequences_uniq ON public.number_sequences (workspace_id, prefix, year);

DROP POLICY IF EXISTS "Authenticated access number_sequences" ON public.number_sequences;

CREATE POLICY "Members read own number_sequences"
  ON public.number_sequences FOR SELECT
  TO authenticated
  USING (workspace_id IS NULL OR workspace_id IN (SELECT current_user_workspace_ids()));

CREATE OR REPLACE FUNCTION public.next_doc_number(_prefix text, _workspace_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _year int := EXTRACT(YEAR FROM now())::int;
  _next int;
BEGIN
  IF _workspace_id IS NULL OR _workspace_id NOT IN (SELECT current_user_workspace_ids()) THEN
    RAISE EXCEPTION 'Not a member of workspace %', _workspace_id USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.number_sequences (workspace_id, prefix, year, last_seq, updated_at)
  VALUES (_workspace_id, _prefix, _year, 1, now())
  ON CONFLICT (workspace_id, prefix, year)
  DO UPDATE SET last_seq = public.number_sequences.last_seq + 1, updated_at = now()
  RETURNING last_seq INTO _next;

  RETURN format('%s-%s-%s', _prefix, _year, lpad(_next::text, 4, '0'));
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_doc_number(text, uuid) TO authenticated;

ALTER VIEW IF EXISTS public.units_with_data_gaps SET (security_invoker = true);
ALTER VIEW IF EXISTS public.units_without_owners SET (security_invoker = true);