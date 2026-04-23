

## Financials module — design

A new **Financials** module that ties together everything monetary in the app: rent collection from tenants, vendor quotes/bills/payments, monthly owner statements with net remittance, PM company revenue (PM fees, lease-up fees, service margins), refunds, security deposits, and a lightweight General Ledger so you get a real P&L without needing QuickBooks for day-to-day visibility.

Built around four user-approved pillars:
1. **Operational ledger + lightweight GL** — invoices, bills, payments AND auto-generated double-entry journal entries.
2. **PM collects & disburses** — PM is the money hub; tenants pay PM, vendors are paid by PM, landlords get net remittance.
3. **Quote → Approval → Bill → Payment** for vendor work.
4. **Dashboard widget + per-record balance badges** for alerts (no email yet).

---

### A. Core money objects

| Object | Purpose | Key links |
|---|---|---|
| **Invoice** (AR) | Money owed TO PM company by a tenant or landlord | lease, contract, person |
| **Bill** (AP) | Money PM company owes to a vendor (or refund owed to a tenant/landlord) | vendor, service_request, contract |
| **Payment** | A real money movement in or out (cash, cheque, bank transfer, card) | links to invoice(s) or bill(s) via allocations |
| **Payment allocation** | Splits one payment across multiple invoices/bills (e.g. one cheque covers 3 months of rent) | payment ↔ invoice/bill |
| **Security deposit** | Held funds, distinct from revenue | lease |
| **Owner statement** | Monthly per-MA summary: rent collected − fees − bills = net remittance | management_agreement, period |
| **Journal entry** | Auto double-entry posting to the GL whenever an invoice/bill/payment is created or settled | account, debit, credit |
| **Account** (chart of accounts) | Seeded list: Cash, AR, AP, Rent Income, PM Fee Income, Vendor Expense, Security Deposit Liability, Owner Payable, etc. | — |

Every invoice/bill/payment creates corresponding journal entries automatically — the user never touches the GL directly, but the **Reports** tab gives a real P&L and balance sheet.

---

### B. The four money flows (concrete examples)

**1. Rent collection (tenant → PM → landlord)**
```text
Lease activates → invoice schedule auto-generated (e.g. 4 cheques, due dates set)
Tenant pays cheque → Payment recorded → allocated to invoice → invoice marked PAID
                  → GL: DR Cash, CR AR (tenant)
                       DR AR (tenant), CR Rent Income (landlord-tagged)
End of month → Owner statement aggregates: rent collected − PM fee − approved bills
            → "Pay landlord" button creates a Bill (PM → landlord) for the net amount
            → Pay that bill = bank transfer → tenant's rent is now in landlord's hands
```

**2. Vendor service work (Quote → Approval → Bill → Payment)**

Extends the existing service request lifecycle:
```text
Service request step (delivery=vendor, billing=paid)
  → Vendor submits Quote (line items, total, validity)
  → If MA threshold exceeded → landlord approval (already exists in approval_status)
  → On approval, quote converts to Bill (status=draft, due based on VSA payment_terms)
  → Work completes → Bill marked "ready to pay"
  → PM pays vendor → Payment allocated to bill → Bill PAID
  → GL: DR Vendor Expense (landlord-tagged), CR AP (vendor)
       DR AP (vendor), CR Cash
```

**3. Service fees billed to tenant** (e.g. tenant-requested AC servicing)

Service request has a new field: `bill_to` = `landlord` | `tenant`. When `bill_to=tenant`:
- On completion, an **Invoice** is created against the tenant for the service amount (not against landlord).
- Payment + GL flows mirror rent collection.

**4. Early termination + refunds**

- A "Terminate contract" action on lease/MA opens a settlement dialog: prorated rent, deposit return, early termination penalty, refund due.
- Generates a **settlement statement**: list of credits/debits with a final net (refund to tenant, or extra owed by tenant).
- Net amount becomes either an Invoice (tenant owes more) or a Bill (PM owes refund) and posts to GL.
- Security deposit is released from "Security Deposit Liability" → either refunded (Cash → Tenant) or applied to outstanding (offset against invoice).

---

### C. Module surface — `/financials`

**Top tabs:**

1. **Overview** — financial dashboard
2. **Receivables** — invoices list
3. **Payables** — bills list
4. **Payments** — payments ledger
5. **Owner statements** — per-MA monthly statements
6. **Reports** — P&L, balance sheet, AR aging, AP aging, vendor spend by landlord
7. **Settings** — chart of accounts, default tax rate, statement template

**Overview dashboard widgets:**
- Cash on hand (sum of bank/cash accounts)
- AR outstanding + aging buckets (current / 1-30 / 31-60 / 60+)
- AP outstanding + aging buckets
- Rent collected this month vs expected
- PM revenue this month (fee income)
- Owner payable (what PM owes landlords right now, pending statements)
- "Action needed" list: overdue invoices, bills due this week, statements ready to issue, refunds pending

---

### D. Per-record balance badges (live everywhere)

Added inline on existing pages so the user sees money status without leaving the record:

| Page | Badge / section |
|---|---|
| Lease detail | Outstanding rent · Next due date · Deposit held · Last payment |
| MA detail | YTD rent collected · YTD PM fees earned · YTD vendor spend · Owner payable now |
| VSA detail | YTD vendor spend · Open bills · Last paid |
| Vendor profile | Open bills · YTD paid · Average days-to-pay |
| Tenant person profile | Outstanding · Last payment · On-time rate |
| Landlord person profile | Owner payable · YTD net to landlord |
| Service request detail | Quote · Approved cost · Actual cost · Bill status · Who pays |
| Unit detail | Last paid rent · Vacancy days · Open bills tied to this unit |

Color rules: green ≥0 days early, neutral 0–7 days, amber 8–30, red 30+.

---

### E. Schema additions (one migration, no breaking changes)

**New tables**
- `accounts` — chart of accounts (seeded with ~15 standard PM accounts)
- `invoices` — `id, number, party_person_id, contract_id, lease_id, issue_date, due_date, currency, subtotal, tax, total, status, bill_to_role, notes`
- `invoice_lines` — `invoice_id, description, qty, unit_price, amount, account_id`
- `bills` — same shape as invoices but vendor-facing; links to `vendor_id`, `service_request_id`, `vsa_contract_id`
- `bill_lines` — same shape as invoice_lines
- `vendor_quotes` — `id, service_request_id, vendor_id, total, valid_until, status (submitted/approved/rejected/converted), accepted_bill_id`
- `quote_lines` — line items
- `payments` — `id, number, direction (in/out), method, amount, currency, paid_on, bank_account_id, reference, party_person_id|vendor_id, notes`
- `payment_allocations` — `payment_id, invoice_id|bill_id, amount`
- `journal_entries` — `id, posted_at, source_type, source_id, memo`
- `journal_lines` — `entry_id, account_id, debit, credit, party_person_id|vendor_id|landlord_id` (for tagging)
- `owner_statements` — `id, ma_contract_id, period_start, period_end, status (draft/issued/paid), gross_rent, pm_fee, expenses_total, other_adjustments, net_remittance, payment_id`
- `owner_statement_lines` — itemized lines on a statement
- `recurring_invoice_schedules` — derived from lease (stores cheque/installment plan)
- `bank_accounts` — PM company accounts (`name, account_number_masked, currency, gl_account_id`)

**Reused**
- `service_requests.bill_to` (new column: `landlord | tenant`, default landlord)
- `leases` — already has rent/cheques/deposit; we add a trigger to auto-generate invoices on status=active
- `vendor_service_agreements.payment_terms` — drives bill due_date calculation
- `management_agreements.fee_*` — drives PM fee invoice generation per statement period

**Triggers**
- Lease becomes active → generate `invoices` for the cheque schedule
- Invoice/bill/payment insert → write `journal_entries` and `journal_lines` automatically
- Owner statement issued → generate the corresponding "pay landlord" Bill

**RLS** — same authenticated-can-CRUD pattern used elsewhere for v1 (matching existing RLS posture). User-role-based restriction (landlord can only see their own statements, tenant only their own invoices) is a follow-up once portal access is enabled.

---

### F. UI components (new)

- `src/pages/Financials.tsx` — module shell with tabs
- `src/pages/financials/Overview.tsx` — dashboard
- `src/pages/financials/Receivables.tsx` + `InvoiceDetail.tsx` + `NewInvoice.tsx`
- `src/pages/financials/Payables.tsx` + `BillDetail.tsx` + `NewBill.tsx`
- `src/pages/financials/Payments.tsx` + `RecordPaymentDialog.tsx` (handles allocation across multiple invoices/bills)
- `src/pages/financials/OwnerStatements.tsx` + `OwnerStatementDetail.tsx` (with "Issue & generate remittance bill" action)
- `src/pages/financials/Reports.tsx` — P&L, balance sheet, AR/AP aging
- `src/pages/financials/Settings.tsx` — chart of accounts, bank accounts
- `src/components/financials/QuoteCard.tsx` — embedded on service request detail
- `src/components/financials/SettlementDialog.tsx` — early-termination calculator
- `src/components/financials/BalanceBadge.tsx` — reusable status pill
- `src/lib/financials.ts` — money math, GL posting helpers, statement period helpers
- `src/lib/financialFormulas.ts` — central place for proration, late fee calc, statement totals (single source of truth so reports never drift from records)

---

### G. Touch points to existing pages

- `src/lib/modules.ts` — add Financials module
- `src/pages/ContractDetail.tsx` — add "Financials" tab on lease/MA/VSA showing invoices/bills/payments tied to this contract; "Terminate" button opens SettlementDialog
- `src/pages/ServiceRequestDetail.tsx` — add Quote/Bill/Payment section; `bill_to` selector
- `src/pages/NewServiceRequest.tsx` — add `bill_to` step
- `src/pages/VendorDetail.tsx` — add bills/payments tabs and YTD numbers
- `src/pages/PersonDetail.tsx` — add financial summary block (different content for tenant vs landlord vs vendor contact)
- `src/pages/UnitDetail.tsx` — add rent history + open bills
- `src/pages/Dashboard.tsx` — add "Financials at a glance" card

---

### H. Build sequence (staged so nothing ships half-done)

**Phase 1 — foundation** (one PR / one migration)
- Schema + chart of accounts seed + RLS
- `Financials` module shell with empty tabs
- `BalanceBadge` component (no real numbers yet)

**Phase 2 — receivables**
- Invoices CRUD, lease auto-generates invoices on activation
- Payments + allocations
- Tenant invoice display on lease detail
- AR aging on dashboard

**Phase 3 — payables & quotes**
- Vendor quote on service request → approval (reuses existing approval flow) → bill
- Bill payment
- Vendor / VSA payment views

**Phase 4 — owner statements & GL reports**
- Statement generator (period close per MA)
- Auto "pay landlord" bill on issue
- Reports tab: P&L, balance sheet, AR/AP aging

**Phase 5 — terminations & refunds**
- SettlementDialog
- Refund flow (Bill against tenant or landlord)
- Deposit release flow

Each phase is independently shippable — the module is usable after Phase 2 even if statements aren't built yet.

---

### I. Bug-prevention notes

- **Single source of truth for money math**: every total (statement net, AR aging, lease balance) goes through `lib/financialFormulas.ts`. No inline arithmetic in components.
- **Idempotent journal posting**: each invoice/bill/payment carries a `journal_entry_id`; trigger checks before re-posting, so retries can't double-book.
- **Numeric only in money columns**: all money columns are `numeric(14,2)`, never float.
- **Currency stays at the contract level**: invoices/bills inherit currency from the parent contract. Multi-currency conversion is out of scope for v1 (flagged in Reports as "All amounts in AED").
- **Soft-delete for issued invoices/bills**: once a document has a number and is issued, it can be **voided** (creates reversing journal) but never hard-deleted — preserves the audit trail.
- **Number sequences** reuse the existing `number_sequences` table (INV-2026-0001, BILL-2026-0001, PAY-2026-0001, STMT-2026-0001).

