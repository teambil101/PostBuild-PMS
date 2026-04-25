create table if not exists public.ai_chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null default 'New chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_chat_sessions_user_idx
  on public.ai_chat_sessions(user_id, updated_at desc);

alter table public.ai_chat_sessions enable row level security;

create policy "Users manage own chat sessions"
  on public.ai_chat_sessions
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create table if not exists public.ai_chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.ai_chat_sessions(id) on delete cascade,
  role text not null check (role in ('user','assistant','tool')),
  content text not null default '',
  tool_calls jsonb,
  tool_results jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_chat_messages_session_idx
  on public.ai_chat_messages(session_id, created_at);

alter table public.ai_chat_messages enable row level security;

create policy "Users access messages in own sessions"
  on public.ai_chat_messages
  for all
  to authenticated
  using (
    exists (
      select 1 from public.ai_chat_sessions s
      where s.id = ai_chat_messages.session_id and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.ai_chat_sessions s
      where s.id = ai_chat_messages.session_id and s.user_id = auth.uid()
    )
  );

create or replace function public.run_readonly_sql(query_text text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  q text;
  q_lower text;
  result jsonb;
  row_count int;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if not (
    public.has_role(auth.uid(), 'admin'::app_role)
    or public.has_role(auth.uid(), 'staff'::app_role)
  ) then
    raise exception 'forbidden: staff role required';
  end if;

  q := btrim(coalesce(query_text, ''));
  if q = '' then
    raise exception 'empty_query';
  end if;

  q := regexp_replace(q, ';\s*$', '');
  if position(';' in q) > 0 then
    raise exception 'multiple_statements_not_allowed';
  end if;

  q_lower := lower(q);

  if not (q_lower ~ '^\s*(select|with)\b') then
    raise exception 'only_select_allowed';
  end if;

  if q_lower ~ '\b(insert|update|delete|drop|alter|truncate|create|grant|revoke|comment|copy|vacuum|analyze|reindex|cluster|listen|notify|do|call|execute|prepare|deallocate|reset|lock|refresh)\b' then
    raise exception 'forbidden_keyword';
  end if;

  if q_lower ~ '\bset\s+(session|role)\b' then
    raise exception 'forbidden_keyword';
  end if;

  if q_lower ~ '\b(pg_catalog|pg_authid|pg_shadow|pg_user|pg_roles|auth\.|storage\.|vault\.|supabase_functions\.|net\.|extensions\.)' then
    raise exception 'forbidden_schema';
  end if;

  if q_lower ~ '\b(pg_read_server_files|pg_write_server_files|pg_ls_dir|pg_read_file|dblink)\b' then
    raise exception 'forbidden_function';
  end if;

  perform set_config('statement_timeout', '8000', true);
  perform set_config('transaction_read_only', 'on', true);

  execute format(
    'select coalesce(jsonb_agg(t), ''[]''::jsonb) from (%s limit 500) t',
    q
  ) into result;

  row_count := jsonb_array_length(coalesce(result, '[]'::jsonb));

  return jsonb_build_object(
    'rows', result,
    'row_count', row_count,
    'truncated', row_count = 500
  );
exception when others then
  return jsonb_build_object(
    'error', sqlerrm,
    'sqlstate', sqlstate
  );
end;
$$;

revoke all on function public.run_readonly_sql(text) from public;
grant execute on function public.run_readonly_sql(text) to authenticated;

create or replace function public.touch_ai_chat_session()
returns trigger language plpgsql as $$
begin
  update public.ai_chat_sessions set updated_at = now() where id = new.session_id;
  return new;
end;
$$;

drop trigger if exists trg_touch_ai_chat_session on public.ai_chat_messages;
create trigger trg_touch_ai_chat_session
after insert on public.ai_chat_messages
for each row execute function public.touch_ai_chat_session();