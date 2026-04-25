create or replace function public.notify_service_completed()
returns trigger
language plpgsql
security definer
set search_path = public, net, extensions
as $$
declare
  v_url text := 'https://qbponetbczxvqvnilavg.supabase.co/functions/v1/service-completed-webhook';
  v_request_id bigint;
begin
  select net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('service_request_id', NEW.id)
  ) into v_request_id;

  raise log 'notify_service_completed queued request % for service %', v_request_id, NEW.id;
  return NEW;
exception when others then
  raise log 'notify_service_completed failed for service %: %', NEW.id, sqlerrm;
  return NEW;
end;
$$;