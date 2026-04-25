CREATE OR REPLACE FUNCTION public.handle_new_user_workspace()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_ws_id uuid;
  display_name text;
  base_slug text;
  candidate_slug text;
  suffix int := 0;
  ws_kind public.workspace_kind;
  ws_role public.workspace_member_role;
  meta_kind text;
BEGIN
  IF EXISTS (SELECT 1 FROM public.workspace_members WHERE user_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  display_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1),
    'My Workspace'
  );

  meta_kind := lower(COALESCE(NEW.raw_user_meta_data->>'workspace_kind', 'owner'));
  IF meta_kind NOT IN ('owner', 'broker', 'internal') THEN
    meta_kind := 'owner';
  END IF;
  ws_kind := meta_kind::public.workspace_kind;

  IF ws_kind = 'owner' THEN
    ws_role := 'owner';
  ELSE
    ws_role := 'admin';
  END IF;

  base_slug := regexp_replace(lower(display_name), '[^a-z0-9]+', '-', 'g');
  base_slug := trim(both '-' from base_slug);
  IF base_slug = '' THEN base_slug := 'workspace'; END IF;
  candidate_slug := base_slug;
  WHILE EXISTS (SELECT 1 FROM public.workspaces WHERE slug = candidate_slug) LOOP
    suffix := suffix + 1;
    candidate_slug := base_slug || '-' || suffix::text;
  END LOOP;

  INSERT INTO public.workspaces (name, slug, kind, plan, created_by)
  VALUES (
    CASE
      WHEN ws_kind = 'owner' THEN display_name || '''s workspace'
      WHEN ws_kind = 'broker' THEN display_name || ' Brokerage'
      ELSE display_name || ' Operations'
    END,
    candidate_slug,
    ws_kind,
    'free',
    NEW.id
  )
  RETURNING id INTO new_ws_id;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (new_ws_id, NEW.id, ws_role);

  RETURN NEW;
END $$;