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

  q := regexp_replace(q, ';[[:space:]]*$', '');
  if position(';' in q) > 0 then
    raise exception 'multiple_statements_not_allowed';
  end if;

  q_lower := lower(q);

  if not (q_lower ~ '^[[:space:]]*(select|with)\y') then
    raise exception 'only_select_allowed';
  end if;

  if q_lower ~ '\y(insert|update|delete|drop|alter|truncate|create|grant|revoke|comment|copy|vacuum|analyze|reindex|cluster|listen|notify|do|call|execute|prepare|deallocate|reset|lock|refresh)\y' then
    raise exception 'forbidden_keyword';
  end if;

  if q_lower ~ '\yset[[:space:]]+(session|role)\y' then
    raise exception 'forbidden_keyword';
  end if;

  if q_lower ~ '\y(pg_catalog|pg_authid|pg_shadow|pg_user|pg_roles)\y' then
    raise exception 'forbidden_schema';
  end if;

  if q_lower ~ '(auth\.|storage\.|vault\.|supabase_functions\.|net\.|extensions\.)' then
    raise exception 'forbidden_schema';
  end if;

  if q_lower ~ '\y(pg_read_server_files|pg_write_server_files|pg_ls_dir|pg_read_file|dblink)\y' then
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