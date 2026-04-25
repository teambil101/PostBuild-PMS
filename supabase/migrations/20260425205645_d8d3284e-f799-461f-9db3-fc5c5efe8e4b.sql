
-- =====================================================================
-- PHASE 1b: WORKSPACE-SCOPED RLS + AUTH RE-ENABLE PREP
-- =====================================================================

-- 1. AUTO-ENROLL EXISTING USERS --------------------------------------------

DO $$
DECLARE bootstrap_id uuid;
BEGIN
  SELECT id INTO bootstrap_id FROM public.workspaces WHERE slug = 'true-build-hq';
  IF bootstrap_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  SELECT bootstrap_id, u.id, 'admin'::public.workspace_member_role
  FROM auth.users u
  ON CONFLICT (workspace_id, user_id) DO NOTHING;
END $$;

-- 2. SIGNUP TRIGGER --------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user_workspace()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_ws_id uuid; display_name text; base_slug text; candidate_slug text; suffix int := 0;
BEGIN
  IF EXISTS (SELECT 1 FROM public.workspace_members WHERE user_id = NEW.id) THEN RETURN NEW; END IF;
  display_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1), 'My Workspace');
  base_slug := regexp_replace(lower(display_name), '[^a-z0-9]+', '-', 'g');
  base_slug := trim(both '-' from base_slug);
  IF base_slug = '' THEN base_slug := 'workspace'; END IF;
  candidate_slug := base_slug;
  WHILE EXISTS (SELECT 1 FROM public.workspaces WHERE slug = candidate_slug) LOOP
    suffix := suffix + 1; candidate_slug := base_slug || '-' || suffix::text;
  END LOOP;
  INSERT INTO public.workspaces (name, slug, kind, plan, created_by)
  VALUES (display_name || '''s workspace', candidate_slug, 'owner', 'free', NEW.id)
  RETURNING id INTO new_ws_id;
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (new_ws_id, NEW.id, 'owner');
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created_workspace ON auth.users;
CREATE TRIGGER on_auth_user_created_workspace
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_workspace();

-- 3. ENABLE RLS WHERE MISSING ---------------------------------------------

ALTER TABLE public.buildings              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.people                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.people_documents       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_owners        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_documents     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_status_history    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_contacts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_events          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_events            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.number_sequences       ENABLE ROW LEVEL SECURITY;

-- 4. DROP OLD PERMISSIVE POLICIES -----------------------------------------

DO $$
DECLARE
  pol record; t text;
  target_tables text[] := ARRAY[
    'accounts','bank_accounts','bill_lines','bills',
    'contracts','contract_parties','contract_subjects','contract_events',
    'invoices','invoice_lines','journal_entries','journal_lines',
    'leases','management_agreements','vendor_service_agreements',
    'owner_statements','owner_statement_lines','payments','payment_allocations',
    'quote_lines','recurring_invoice_schedules',
    'service_catalog','service_requests','service_request_steps','service_request_quotes',
    'service_request_events','service_feedback','vendor_quotes'];
BEGIN
  FOREACH t IN ARRAY target_tables LOOP
    FOR pol IN SELECT policyname FROM pg_policies
      WHERE schemaname='public' AND tablename=t
        AND policyname ILIKE 'Authenticated can %'
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, t);
    END LOOP;
  END LOOP;
END $$;

-- 5. STANDARD WORKSPACE-SCOPED POLICIES ----------------------------------

DO $$
DECLARE
  t text;
  direct_ws_tables text[] := ARRAY[
    'buildings','units','people','vendors',
    'contracts','leases','management_agreements','vendor_service_agreements',
    'service_catalog','service_requests',
    'leads',
    'invoices','bills','payments',
    'journal_entries','accounts','bank_accounts',
    'owner_statements','recurring_invoice_schedules',
    'property_owners','notes','documents','photos','people_documents','property_documents'];
BEGIN
  FOREACH t IN ARRAY direct_ws_tables LOOP
    EXECUTE format($f$
      CREATE POLICY "Members select %1$s" ON public.%1$I FOR SELECT TO authenticated
      USING (workspace_id IN (SELECT public.current_user_workspace_ids()))$f$, t);
    EXECUTE format($f$
      CREATE POLICY "Members insert %1$s" ON public.%1$I FOR INSERT TO authenticated
      WITH CHECK (workspace_id IN (SELECT public.current_user_workspace_ids()))$f$, t);
    EXECUTE format($f$
      CREATE POLICY "Members update %1$s" ON public.%1$I FOR UPDATE TO authenticated
      USING (workspace_id IN (SELECT public.current_user_workspace_ids()))
      WITH CHECK (workspace_id IN (SELECT public.current_user_workspace_ids()))$f$, t);
    EXECUTE format($f$
      CREATE POLICY "Members delete %1$s" ON public.%1$I FOR DELETE TO authenticated
      USING (workspace_id IN (SELECT public.current_user_workspace_ids()))$f$, t);
  END LOOP;
END $$;

-- 6. CHILD TABLES VIA PARENT ---------------------------------------------

CREATE POLICY "Members select invoice_lines" ON public.invoice_lines FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id
    AND i.workspace_id IN (SELECT public.current_user_workspace_ids())));
CREATE POLICY "Members write invoice_lines" ON public.invoice_lines FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id
    AND i.workspace_id IN (SELECT public.current_user_workspace_ids())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id
    AND i.workspace_id IN (SELECT public.current_user_workspace_ids())));

CREATE POLICY "Members select bill_lines" ON public.bill_lines FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.bills b WHERE b.id = bill_id
    AND b.workspace_id IN (SELECT public.current_user_workspace_ids())));
CREATE POLICY "Members write bill_lines" ON public.bill_lines FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.bills b WHERE b.id = bill_id
    AND b.workspace_id IN (SELECT public.current_user_workspace_ids())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.bills b WHERE b.id = bill_id
    AND b.workspace_id IN (SELECT public.current_user_workspace_ids())));

CREATE POLICY "Members select journal_lines" ON public.journal_lines FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.journal_entries je WHERE je.id = entry_id
    AND je.workspace_id IN (SELECT public.current_user_workspace_ids())));
CREATE POLICY "Members write journal_lines" ON public.journal_lines FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.journal_entries je WHERE je.id = entry_id
    AND je.workspace_id IN (SELECT public.current_user_workspace_ids())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.journal_entries je WHERE je.id = entry_id
    AND je.workspace_id IN (SELECT public.current_user_workspace_ids())));

CREATE POLICY "Members select payment_allocations" ON public.payment_allocations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.payments p WHERE p.id = payment_id
    AND p.workspace_id IN (SELECT public.current_user_workspace_ids())));
CREATE POLICY "Members write payment_allocations" ON public.payment_allocations FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.payments p WHERE p.id = payment_id
    AND p.workspace_id IN (SELECT public.current_user_workspace_ids())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.payments p WHERE p.id = payment_id
    AND p.workspace_id IN (SELECT public.current_user_workspace_ids())));

CREATE POLICY "Members select owner_statement_lines" ON public.owner_statement_lines FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.owner_statements os WHERE os.id = statement_id
    AND os.workspace_id IN (SELECT public.current_user_workspace_ids())));
CREATE POLICY "Members write owner_statement_lines" ON public.owner_statement_lines FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.owner_statements os WHERE os.id = statement_id
    AND os.workspace_id IN (SELECT public.current_user_workspace_ids())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.owner_statements os WHERE os.id = statement_id
    AND os.workspace_id IN (SELECT public.current_user_workspace_ids())));

CREATE POLICY "Members select contract_parties" ON public.contract_parties FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.contracts ct WHERE ct.id = contract_id
    AND ct.workspace_id IN (SELECT public.current_user_workspace_ids())));
CREATE POLICY "Members write contract_parties" ON public.contract_parties FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.contracts ct WHERE ct.id = contract_id
    AND ct.workspace_id IN (SELECT public.current_user_workspace_ids())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.contracts ct WHERE ct.id = contract_id
    AND ct.workspace_id IN (SELECT public.current_user_workspace_ids())));

CREATE POLICY "Members select contract_subjects" ON public.contract_subjects FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.contracts ct WHERE ct.id = contract_id
    AND ct.workspace_id IN (SELECT public.current_user_workspace_ids())));
CREATE POLICY "Members write contract_subjects" ON public.contract_subjects FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.contracts ct WHERE ct.id = contract_id
    AND ct.workspace_id IN (SELECT public.current_user_workspace_ids())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.contracts ct WHERE ct.id = contract_id
    AND ct.workspace_id IN (SELECT public.current_user_workspace_ids())));

CREATE POLICY "Members select contract_events" ON public.contract_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.contracts ct WHERE ct.id = contract_id
    AND ct.workspace_id IN (SELECT public.current_user_workspace_ids())));
CREATE POLICY "Members insert contract_events" ON public.contract_events FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.contracts ct WHERE ct.id = contract_id
    AND ct.workspace_id IN (SELECT public.current_user_workspace_ids())));

CREATE POLICY "Members select service_request_steps" ON public.service_request_steps FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.service_requests sr WHERE sr.id = request_id
    AND sr.workspace_id IN (SELECT public.current_user_workspace_ids())));
CREATE POLICY "Members write service_request_steps" ON public.service_request_steps FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.service_requests sr WHERE sr.id = request_id
    AND sr.workspace_id IN (SELECT public.current_user_workspace_ids())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.service_requests sr WHERE sr.id = request_id
    AND sr.workspace_id IN (SELECT public.current_user_workspace_ids())));

CREATE POLICY "Members select service_request_events" ON public.service_request_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.service_requests sr WHERE sr.id = request_id
    AND sr.workspace_id IN (SELECT public.current_user_workspace_ids())));
CREATE POLICY "Members insert service_request_events" ON public.service_request_events FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.service_requests sr WHERE sr.id = request_id
    AND sr.workspace_id IN (SELECT public.current_user_workspace_ids())));

CREATE POLICY "Members select service_feedback" ON public.service_feedback FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.service_requests sr WHERE sr.id = service_request_id
    AND sr.workspace_id IN (SELECT public.current_user_workspace_ids())));
CREATE POLICY "Members write service_feedback" ON public.service_feedback FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.service_requests sr WHERE sr.id = service_request_id
    AND sr.workspace_id IN (SELECT public.current_user_workspace_ids())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.service_requests sr WHERE sr.id = service_request_id
    AND sr.workspace_id IN (SELECT public.current_user_workspace_ids())));

CREATE POLICY "Members select service_request_quotes" ON public.service_request_quotes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.service_requests sr WHERE sr.id = request_id
    AND sr.workspace_id IN (SELECT public.current_user_workspace_ids())));
CREATE POLICY "Members write service_request_quotes" ON public.service_request_quotes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.service_requests sr WHERE sr.id = request_id
    AND sr.workspace_id IN (SELECT public.current_user_workspace_ids())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.service_requests sr WHERE sr.id = request_id
    AND sr.workspace_id IN (SELECT public.current_user_workspace_ids())));

CREATE POLICY "Members select quote_lines" ON public.quote_lines FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.service_request_quotes srq
    JOIN public.service_requests sr ON sr.id = srq.request_id
    WHERE srq.id = quote_id
      AND sr.workspace_id IN (SELECT public.current_user_workspace_ids())));
CREATE POLICY "Members write quote_lines" ON public.quote_lines FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.service_request_quotes srq
    JOIN public.service_requests sr ON sr.id = srq.request_id
    WHERE srq.id = quote_id
      AND sr.workspace_id IN (SELECT public.current_user_workspace_ids())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.service_request_quotes srq
    JOIN public.service_requests sr ON sr.id = srq.request_id
    WHERE srq.id = quote_id
      AND sr.workspace_id IN (SELECT public.current_user_workspace_ids())));

-- vendor_quotes uses service_request_id (legacy)
CREATE POLICY "Members access vendor_quotes" ON public.vendor_quotes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.service_requests sr WHERE sr.id = service_request_id
    AND sr.workspace_id IN (SELECT public.current_user_workspace_ids())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.service_requests sr WHERE sr.id = service_request_id
    AND sr.workspace_id IN (SELECT public.current_user_workspace_ids())));

CREATE POLICY "Members access lead_events" ON public.lead_events FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id
    AND l.workspace_id IN (SELECT public.current_user_workspace_ids())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id
    AND l.workspace_id IN (SELECT public.current_user_workspace_ids())));

CREATE POLICY "Members access vendor_events" ON public.vendor_events FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = vendor_id
    AND v.workspace_id IN (SELECT public.current_user_workspace_ids())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = vendor_id
    AND v.workspace_id IN (SELECT public.current_user_workspace_ids())));

CREATE POLICY "Members access vendor_contacts" ON public.vendor_contacts FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = vendor_id
    AND v.workspace_id IN (SELECT public.current_user_workspace_ids())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = vendor_id
    AND v.workspace_id IN (SELECT public.current_user_workspace_ids())));

CREATE POLICY "Members access property_status_history" ON public.property_status_history FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.units u WHERE u.id = unit_id
    AND u.workspace_id IN (SELECT public.current_user_workspace_ids())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.units u WHERE u.id = unit_id
    AND u.workspace_id IN (SELECT public.current_user_workspace_ids())));

CREATE POLICY "Members access unit_status_history" ON public.unit_status_history FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.units u WHERE u.id = unit_id
    AND u.workspace_id IN (SELECT public.current_user_workspace_ids())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.units u WHERE u.id = unit_id
    AND u.workspace_id IN (SELECT public.current_user_workspace_ids())));

-- 7. APP_SETTINGS / USER_ROLES / NUMBER_SEQUENCES ------------------------

CREATE POLICY "Members access app_settings" ON public.app_settings FOR ALL TO authenticated
  USING (workspace_id IN (SELECT public.current_user_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT public.current_user_workspace_ids()));

CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Authenticated access number_sequences" ON public.number_sequences FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
