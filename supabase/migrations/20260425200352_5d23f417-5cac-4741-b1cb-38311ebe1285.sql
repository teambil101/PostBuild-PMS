-- Trigger function that pings the quote-invite-webhook edge function
CREATE OR REPLACE FUNCTION public.notify_quote_invited()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net, extensions
AS $$
DECLARE
  v_url text := 'https://qbponetbczxvqvnilavg.supabase.co/functions/v1/quote-invite-webhook';
  v_request_id bigint;
BEGIN
  IF NEW.status <> 'invited' THEN
    RETURN NEW;
  END IF;

  SELECT net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('quote_id', NEW.id)
  ) INTO v_request_id;

  RAISE LOG 'notify_quote_invited queued request % for quote %', v_request_id, NEW.id;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'notify_quote_invited failed for quote %: %', NEW.id, sqlerrm;
  RETURN NEW;
END;
$$;

-- Fire on insert (any new invitation row)
DROP TRIGGER IF EXISTS trg_notify_quote_invited ON public.service_request_quotes;
CREATE TRIGGER trg_notify_quote_invited
AFTER INSERT ON public.service_request_quotes
FOR EACH ROW
EXECUTE FUNCTION public.notify_quote_invited();