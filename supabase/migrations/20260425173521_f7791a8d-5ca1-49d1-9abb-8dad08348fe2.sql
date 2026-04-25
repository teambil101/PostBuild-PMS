-- Ensure pg_net is available
create extension if not exists pg_net with schema extensions;

-- Trigger function: posts to our edge function when a request becomes completed
create or replace function public.notify_service_completed()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url text;
begin
  v_url := 'https://qbponetbczxvqvnilavg.supabase.co/functions/v1/service-completed-webhook';

  perform extensions.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('service_request_id', NEW.id)::text
  );

  return NEW;
exception when others then
  -- Never block the update if the webhook call fails
  raise warning 'notify_service_completed failed: %', sqlerrm;
  return NEW;
end;
$$;

drop trigger if exists trg_service_completed_webhook on public.service_requests;

create trigger trg_service_completed_webhook
after update of status on public.service_requests
for each row
when (NEW.status = 'completed' and OLD.status is distinct from 'completed')
execute function public.notify_service_completed();