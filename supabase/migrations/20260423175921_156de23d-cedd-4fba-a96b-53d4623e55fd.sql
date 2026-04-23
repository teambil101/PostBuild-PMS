
-- =========================================================
-- FINANCIALS MODULE — Phase 1 foundation
-- =========================================================

-- ---------- ENUMS ----------
CREATE TYPE public.account_type AS ENUM ('asset','liability','equity','income','expense');
CREATE TYPE public.invoice_status AS ENUM ('draft','issued','partial','paid','void');
CREATE TYPE public.bill_status AS ENUM ('draft','approved','partial','paid','void');
CREATE TYPE public.payment_direction AS ENUM ('in','out');
CREATE TYPE public.payment_method AS ENUM ('cash','cheque','bank_transfer','card','online','other');
CREATE TYPE public.quote_status AS ENUM ('submitted','approved','rejected','converted','expired');
CREATE TYPE public.statement_status AS ENUM ('draft','issued','paid');
CREATE TYPE public.bill_to_role AS ENUM ('landlord','tenant');

-- ---------- CHART OF ACCOUNTS ----------
CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  account_type public.account_type NOT NULL,
  is_system boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view accounts" ON public.accounts FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert accounts" ON public.accounts FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated can update accounts" ON public.accounts FOR UPDATE USING (true);
CREATE POLICY "Authenticated can delete accounts" ON public.accounts FOR DELETE USING (true);

-- Seed standard chart of accounts
INSERT INTO public.accounts (code, name, account_type, is_system, description) VALUES
  ('1000','Cash & Bank','asset',true,'Aggregate of bank accounts'),
  ('1100','Accounts Receivable','asset',true,'Money owed to PM by tenants & landlords'),
  ('1200','Security Deposits Held (Asset)','asset',true,'Tenant deposits held in trust'),
  ('1500','Undeposited Funds','asset',false,'Payments received but not yet deposited'),
  ('2000','Accounts Payable','liability',true,'Money PM owes to vendors'),
  ('2100','Owner Payable','liability',true,'Net rent owed to landlords pending remittance'),
  ('2200','Security Deposit Liability','liability',true,'Tenant deposits owed back'),
  ('2300','Tax Payable','liability',true,'VAT/sales tax collected, owed to authority'),
  ('3000','Owner Equity','equity',true,'PM company equity'),
  ('4000','Rent Income','income',true,'Rent collected on behalf of landlords'),
  ('4100','PM Fee Income','income',true,'Management fees earned by PM company'),
  ('4200','Lease-Up Fee Income','income',true,'Commission earned on new leases'),
  ('4300','Service Margin Income','income',true,'Markup earned on vendor services'),
  ('4900','Other Income','income',false,NULL),
  ('5000','Vendor Expense','expense',true,'Payments to vendors for services'),
  ('5100','Refunds & Adjustments','expense',true,NULL),
  ('5900','Other Expense','expense',false,NULL);

-- ---------- BANK ACCOUNTS ----------
CREATE TABLE public.bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  account_number_masked text,
  bank_name text,
  currency text NOT NULL DEFAULT 'AED',
  gl_account_id uuid REFERENCES public.accounts(id),
  opening_balance numeric(14,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view bank_accounts" ON public.bank_accounts FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert bank_accounts" ON public.bank_accounts FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated can update bank_accounts" ON public.bank_accounts FOR UPDATE USING (true);
CREATE POLICY "Authenticated can delete bank_accounts" ON public.bank_accounts FOR DELETE USING (true);

-- ---------- INVOICES (AR) ----------
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL UNIQUE,
  party_person_id uuid REFERENCES public.people(id),
  contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  lease_contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  service_request_id uuid REFERENCES public.service_requests(id) ON DELETE SET NULL,
  bill_to_role public.bill_to_role NOT NULL DEFAULT 'tenant',
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL,
  currency text NOT NULL DEFAULT 'AED',
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  tax numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  amount_paid numeric(14,2) NOT NULL DEFAULT 0,
  status public.invoice_status NOT NULL DEFAULT 'draft',
  notes text,
  voided_at timestamptz,
  voided_reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_invoices_party ON public.invoices(party_person_id);
CREATE INDEX idx_invoices_lease ON public.invoices(lease_contract_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE INDEX idx_invoices_due ON public.invoices(due_date);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view invoices" ON public.invoices FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert invoices" ON public.invoices FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated can update invoices" ON public.invoices FOR UPDATE USING (true);
CREATE POLICY "Authenticated can delete invoices" ON public.invoices FOR DELETE USING (true);

CREATE TABLE public.invoice_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric(14,2) NOT NULL DEFAULT 1,
  unit_price numeric(14,2) NOT NULL DEFAULT 0,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  account_id uuid REFERENCES public.accounts(id),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_invoice_lines_invoice ON public.invoice_lines(invoice_id);

ALTER TABLE public.invoice_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view invoice_lines" ON public.invoice_lines FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert invoice_lines" ON public.invoice_lines FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated can update invoice_lines" ON public.invoice_lines FOR UPDATE USING (true);
CREATE POLICY "Authenticated can delete invoice_lines" ON public.invoice_lines FOR DELETE USING (true);

-- ---------- BILLS (AP) ----------
CREATE TABLE public.bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL UNIQUE,
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  party_person_id uuid REFERENCES public.people(id),
  contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  vsa_contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  service_request_id uuid REFERENCES public.service_requests(id) ON DELETE SET NULL,
  owner_statement_id uuid,
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL,
  currency text NOT NULL DEFAULT 'AED',
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  tax numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  amount_paid numeric(14,2) NOT NULL DEFAULT 0,
  status public.bill_status NOT NULL DEFAULT 'draft',
  notes text,
  voided_at timestamptz,
  voided_reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_bills_vendor ON public.bills(vendor_id);
CREATE INDEX idx_bills_status ON public.bills(status);
CREATE INDEX idx_bills_due ON public.bills(due_date);
CREATE INDEX idx_bills_request ON public.bills(service_request_id);

ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view bills" ON public.bills FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert bills" ON public.bills FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated can update bills" ON public.bills FOR UPDATE USING (true);
CREATE POLICY "Authenticated can delete bills" ON public.bills FOR DELETE USING (true);

CREATE TABLE public.bill_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric(14,2) NOT NULL DEFAULT 1,
  unit_price numeric(14,2) NOT NULL DEFAULT 0,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  account_id uuid REFERENCES public.accounts(id),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_bill_lines_bill ON public.bill_lines(bill_id);

ALTER TABLE public.bill_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view bill_lines" ON public.bill_lines FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert bill_lines" ON public.bill_lines FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated can update bill_lines" ON public.bill_lines FOR UPDATE USING (true);
CREATE POLICY "Authenticated can delete bill_lines" ON public.bill_lines FOR DELETE USING (true);

-- ---------- VENDOR QUOTES ----------
CREATE TABLE public.vendor_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL UNIQUE,
  service_request_id uuid REFERENCES public.service_requests(id) ON DELETE CASCADE,
  service_request_step_id uuid REFERENCES public.service_request_steps(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  currency text NOT NULL DEFAULT 'AED',
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  tax numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  valid_until date,
  status public.quote_status NOT NULL DEFAULT 'submitted',
  accepted_bill_id uuid REFERENCES public.bills(id) ON DELETE SET NULL,
  notes text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decided_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_quotes_request ON public.vendor_quotes(service_request_id);
CREATE INDEX idx_quotes_vendor ON public.vendor_quotes(vendor_id);

ALTER TABLE public.vendor_quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view vendor_quotes" ON public.vendor_quotes FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert vendor_quotes" ON public.vendor_quotes FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated can update vendor_quotes" ON public.vendor_quotes FOR UPDATE USING (true);
CREATE POLICY "Authenticated can delete vendor_quotes" ON public.vendor_quotes FOR DELETE USING (true);

CREATE TABLE public.quote_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.vendor_quotes(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric(14,2) NOT NULL DEFAULT 1,
  unit_price numeric(14,2) NOT NULL DEFAULT 0,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_quote_lines_quote ON public.quote_lines(quote_id);

ALTER TABLE public.quote_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view quote_lines" ON public.quote_lines FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert quote_lines" ON public.quote_lines FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated can update quote_lines" ON public.quote_lines FOR UPDATE USING (true);
CREATE POLICY "Authenticated can delete quote_lines" ON public.quote_lines FOR DELETE USING (true);

-- ---------- PAYMENTS & ALLOCATIONS ----------
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL UNIQUE,
  direction public.payment_direction NOT NULL,
  method public.payment_method NOT NULL DEFAULT 'bank_transfer',
  amount numeric(14,2) NOT NULL,
  currency text NOT NULL DEFAULT 'AED',
  paid_on date NOT NULL DEFAULT CURRENT_DATE,
  bank_account_id uuid REFERENCES public.bank_accounts(id),
  reference text,
  party_person_id uuid REFERENCES public.people(id),
  party_vendor_id uuid REFERENCES public.vendors(id),
  notes text,
  voided_at timestamptz,
  voided_reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_direction ON public.payments(direction);
CREATE INDEX idx_payments_paid_on ON public.payments(paid_on);
CREATE INDEX idx_payments_party_person ON public.payments(party_person_id);
CREATE INDEX idx_payments_party_vendor ON public.payments(party_vendor_id);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view payments" ON public.payments FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert payments" ON public.payments FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated can update payments" ON public.payments FOR UPDATE USING (true);
CREATE POLICY "Authenticated can delete payments" ON public.payments FOR DELETE USING (true);

CREATE TABLE public.payment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE CASCADE,
  bill_id uuid REFERENCES public.bills(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_allocation_target CHECK (
    (invoice_id IS NOT NULL AND bill_id IS NULL) OR
    (invoice_id IS NULL AND bill_id IS NOT NULL)
  )
);
CREATE INDEX idx_alloc_payment ON public.payment_allocations(payment_id);
CREATE INDEX idx_alloc_invoice ON public.payment_allocations(invoice_id);
CREATE INDEX idx_alloc_bill ON public.payment_allocations(bill_id);

ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view payment_allocations" ON public.payment_allocations FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert payment_allocations" ON public.payment_allocations FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated can update payment_allocations" ON public.payment_allocations FOR UPDATE USING (true);
CREATE POLICY "Authenticated can delete payment_allocations" ON public.payment_allocations FOR DELETE USING (true);

-- ---------- JOURNAL (GL) ----------
CREATE TABLE public.journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  posted_at timestamptz NOT NULL DEFAULT now(),
  source_type text NOT NULL,
  source_id uuid NOT NULL,
  memo text,
  is_reversal boolean NOT NULL DEFAULT false,
  reverses_entry_id uuid REFERENCES public.journal_entries(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_type, source_id, is_reversal)
);
CREATE INDEX idx_journal_source ON public.journal_entries(source_type, source_id);
CREATE INDEX idx_journal_posted ON public.journal_entries(posted_at);

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view journal_entries" ON public.journal_entries FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert journal_entries" ON public.journal_entries FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated can update journal_entries" ON public.journal_entries FOR UPDATE USING (true);
CREATE POLICY "Authenticated can delete journal_entries" ON public.journal_entries FOR DELETE USING (true);

CREATE TABLE public.journal_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id),
  debit numeric(14,2) NOT NULL DEFAULT 0,
  credit numeric(14,2) NOT NULL DEFAULT 0,
  party_person_id uuid REFERENCES public.people(id),
  party_vendor_id uuid REFERENCES public.vendors(id),
  landlord_person_id uuid REFERENCES public.people(id),
  memo text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_dr_or_cr CHECK ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0))
);
CREATE INDEX idx_journal_lines_entry ON public.journal_lines(entry_id);
CREATE INDEX idx_journal_lines_account ON public.journal_lines(account_id);
CREATE INDEX idx_journal_lines_landlord ON public.journal_lines(landlord_person_id);

ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view journal_lines" ON public.journal_lines FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert journal_lines" ON public.journal_lines FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated can update journal_lines" ON public.journal_lines FOR UPDATE USING (true);
CREATE POLICY "Authenticated can delete journal_lines" ON public.journal_lines FOR DELETE USING (true);

-- ---------- OWNER STATEMENTS ----------
CREATE TABLE public.owner_statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL UNIQUE,
  ma_contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  landlord_person_id uuid REFERENCES public.people(id),
  period_start date NOT NULL,
  period_end date NOT NULL,
  currency text NOT NULL DEFAULT 'AED',
  gross_rent numeric(14,2) NOT NULL DEFAULT 0,
  pm_fee numeric(14,2) NOT NULL DEFAULT 0,
  expenses_total numeric(14,2) NOT NULL DEFAULT 0,
  other_adjustments numeric(14,2) NOT NULL DEFAULT 0,
  net_remittance numeric(14,2) NOT NULL DEFAULT 0,
  status public.statement_status NOT NULL DEFAULT 'draft',
  remittance_bill_id uuid REFERENCES public.bills(id) ON DELETE SET NULL,
  notes text,
  issued_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_statements_ma ON public.owner_statements(ma_contract_id);
CREATE INDEX idx_statements_period ON public.owner_statements(period_start, period_end);

ALTER TABLE public.owner_statements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view owner_statements" ON public.owner_statements FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert owner_statements" ON public.owner_statements FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated can update owner_statements" ON public.owner_statements FOR UPDATE USING (true);
CREATE POLICY "Authenticated can delete owner_statements" ON public.owner_statements FOR DELETE USING (true);

-- Backfill the bills FK now that owner_statements exists
ALTER TABLE public.bills
  ADD CONSTRAINT bills_owner_statement_fk
  FOREIGN KEY (owner_statement_id) REFERENCES public.owner_statements(id) ON DELETE SET NULL;

CREATE TABLE public.owner_statement_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_id uuid NOT NULL REFERENCES public.owner_statements(id) ON DELETE CASCADE,
  line_type text NOT NULL,
  description text NOT NULL,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  source_type text,
  source_id uuid,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_statement_lines_stmt ON public.owner_statement_lines(statement_id);

ALTER TABLE public.owner_statement_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view owner_statement_lines" ON public.owner_statement_lines FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert owner_statement_lines" ON public.owner_statement_lines FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated can update owner_statement_lines" ON public.owner_statement_lines FOR UPDATE USING (true);
CREATE POLICY "Authenticated can delete owner_statement_lines" ON public.owner_statement_lines FOR DELETE USING (true);

-- ---------- RECURRING INVOICE SCHEDULES ----------
CREATE TABLE public.recurring_invoice_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  installment_number integer NOT NULL,
  total_installments integer NOT NULL,
  amount numeric(14,2) NOT NULL,
  due_date date NOT NULL,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  generated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lease_contract_id, installment_number)
);
CREATE INDEX idx_ris_lease ON public.recurring_invoice_schedules(lease_contract_id);
CREATE INDEX idx_ris_due ON public.recurring_invoice_schedules(due_date);

ALTER TABLE public.recurring_invoice_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view recurring_invoice_schedules" ON public.recurring_invoice_schedules FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert recurring_invoice_schedules" ON public.recurring_invoice_schedules FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated can update recurring_invoice_schedules" ON public.recurring_invoice_schedules FOR UPDATE USING (true);
CREATE POLICY "Authenticated can delete recurring_invoice_schedules" ON public.recurring_invoice_schedules FOR DELETE USING (true);

-- ---------- SERVICE REQUEST: bill_to ----------
ALTER TABLE public.service_requests
  ADD COLUMN bill_to public.bill_to_role NOT NULL DEFAULT 'landlord';

-- ---------- updated_at triggers ----------
CREATE TRIGGER trg_accounts_updated BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_bank_accounts_updated BEFORE UPDATE ON public.bank_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_invoices_updated BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_bills_updated BEFORE UPDATE ON public.bills FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_quotes_updated BEFORE UPDATE ON public.vendor_quotes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_payments_updated BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_owner_statements_updated BEFORE UPDATE ON public.owner_statements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
