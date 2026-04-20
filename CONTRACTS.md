# Contracts Module — Architecture & Extension Guide

This document is for anyone (engineer, future Claude/Lovable session, or
you in six months) who needs to add a new contract subtype, extend an
existing one, or understand why the contracts module looks the way it
does.

It is a **convention document**, not a field-level reference. Specific
column names and types live in migrations; this doc captures the
patterns and the reasoning behind them.

---

## 1. Purpose

A property management platform deals with many kinds of contracts:
management agreements (PM ↔ landlord), leases (landlord ↔ tenant),
service agreements (PM ↔ vendor), brokerage agreements, sale/purchase,
NOCs, addendums.

All of these share structural commonality — parties, subject
properties, status, start/end dates, documents, audit history — while
each has type-specific fields (fee structures, cheque schedules,
commissions, scope of work, etc.).

The contracts module models this with **Class Table Inheritance (CTI)**:
a single parent `contracts` table holding the shared fields, plus one
child table per subtype holding the type-specific fields, in a 1:1
relationship.

---

## 2. Why CTI (and not the alternatives)

Three patterns were considered. Reasoning below so we don't re-litigate
this every time someone joins the codebase.

**Single-table inheritance (one fat `contracts` table with every
subtype's fields as nullable columns).** Rejected. The table becomes
unreadable (dozens of columns most of which are null for any given
row), and adding a subtype means an ALTER TABLE on the hot entity.

**Concrete table inheritance (separate tables per subtype with
duplicated common fields).** Rejected. "All contracts" queries become
UNIONs, parties and documents logic duplicates across every subtype,
and cross-type dashboards get hairy fast.

**CTI (parent + 1:1 child tables).** Chosen.
- Parent queries stay clean: `SELECT * FROM contracts WHERE status='active' AND end_date < now() + interval '30 days'` works across every subtype.
- Child tables stay focused on their specific domain.
- Adding a subtype means adding one new child table; nothing touches existing data.
- Shared infrastructure (parties, subjects, documents, events, notes) attaches to the parent, inherited for free by every subtype.

---

## 3. Schema Layout

### Parent

`contracts` — one row per contract, regardless of type.

Holds: id, contract_type (enum), contract_number (CTR-YYYY-NNNN),
external_reference, title, status, start_date, end_date, auto_renew,
currency, total_value, parent_contract_id (for addendums/renewals),
notes, terminated_at, terminated_reason, audit columns.

### Children (1:1 with parent via `contract_id` FK)

- `management_agreements` — built. Fee structure, scope, lease-up fee, repair threshold.
- `leases` — next up (Pass B). Annual rent, payment frequency, security deposit, commission, Ejari number. Cheques live in `lease_cheques` as a grandchild.
- `service_agreements` — deferred. Will ship with vendor management.
- `brokerage_agreements` — deferred. Will ship with broker/deal tracking.
- `sale_purchase_agreements`, `noc`, `addendum` — future.

### Shared cross-cutting tables

- `contract_parties` — who's in the contract and in what role. Person_id + role + is_signatory + signed_at.
- `contract_subjects` — what properties the contract covers. Polymorphic: entity_type ('building' | 'unit'), entity_id.
- `contract_events` — append-only audit log. Every status change, amendment, signing, termination logged here.
- `documents`, `notes`, `photos` (shared infrastructure from properties module) — extended to accept entity_type='contract'.

---

## 4. Party Roles

Roles live in `contract_parties.role` as a constrained enum. The enum
is intentionally broad, but the UI filters by contract type.

### Role filtering

`getAllowedPartyRoles(contractType: string): string[]` returns the
subset of roles appropriate for each contract type:

| Contract type | Allowed roles |
|---|---|
| management_agreement | service_provider, client, other |
| service_agreement | service_provider, client, other |
| lease | landlord, tenant, broker, guarantor, other |
| brokerage_agreement | broker, client, other |
| sale_purchase_agreement | seller, buyer, broker, other |
| noc | issuer, recipient, other |
| addendum | inherits from parent contract's type |
| other (generic) | all values |

When adding a new subtype, extend this helper with the subtype's
allowed roles. Do NOT just show every role — it creates cognitive
noise and lets users pick semantically wrong combinations.

### The PM company as a party

The PM company is a row in `people` with `person_type='company'` and
`is_self=true`. There is exactly one such row globally, pinned from
`app_settings.self_person_id`.

Every contract where the PM is a party auto-fills this person on the
appropriate side. On management agreements the PM is
`role='service_provider'`. On future service agreements (with vendors)
the PM becomes `role='client'` — same person, different role depending
on which side of the contract we're on.

### Self-person protection

UI must prevent removal of the self-person from any contract. If the
user tries, block with a tooltip. This protects against accidentally
orphaning contracts from their intended PM party.

---

## 5. Contract Subjects

Polymorphic link — a contract can cover buildings AND/OR units.

`contract_subjects` rows: `(contract_id, entity_type, entity_id)`.

A management agreement might cover an entire building (single row,
entity_type='building'). A different agreement might cover specific
units across multiple buildings (multiple rows, entity_type='unit').

### Why polymorphic instead of separate tables

Separate tables (`contract_buildings`, `contract_units`) would require
UNION queries to ask "what properties does this contract cover?" The
polymorphic pattern makes that a single SELECT. The same pattern is
used for photos, documents, and notes across the app.

The tradeoff: no referential integrity from `entity_id` to the target
table at the DB level (it's just a uuid column). We accept this
because app-level enforcement is sufficient and the pattern's query
ergonomics win.

---

## 6. Contract Number Generation

Format: `CTR-YYYY-NNNN` (configurable per subtype — leases will use
`LSE-YYYY-NNNN`, invoices `INV-YYYY-NNNN`, etc.).

Generation via the shared `next_number(prefix, year)` function backed
by the `number_sequences` table.

### Why a counter table and not Postgres sequences

- **Auditability**: `SELECT * FROM number_sequences` shows the current counter. Sequences hide behind metadata queries.
- **Portability**: the counter table dumps and restores like any other data. Sequences complicate backups and branching.
- **Flexibility**: need to bump a year's counter for data migration? Single UPDATE. With sequences, it's DDL surgery.
- **Performance cost is irrelevant**: PM platforms create hundreds, not millions, of contracts per year. The row lock serializing inserts is unmeasurable.

### Adding a new prefix

When adding a subtype, just call `next_number('LSE', year)` — no
schema change needed. The counter row is lazily created on first use.

---

## 7. Status Lifecycle

Every contract uses the same status enum on the parent:

```
draft → pending_signature → active → (expired | terminated | cancelled)
```

- **draft** — captured but not finalized. Editable freely, deletable.
- **pending_signature** — all terms agreed, awaiting physical signing. Transitions to active when all signatories have `signed_at` populated (automatic prompt offered).
- **active** — signed and in effect. Type-specific side effects may trigger (e.g., activating a lease flips the unit to occupied).
- **expired** — end_date passed, not renewed. Automatic via the lifecycle function.
- **terminated** — ended early by a party. Captures reason and optional notes.
- **cancelled** — abandoned before signing. Rare.

### Type-specific side effects on status change

Some subtypes have triggers that cascade status changes to other
tables. Document these in the subtype's own section below.

- Management agreement: no cascading side effects.
- Lease: active → units.status='occupied' + status_locked_by_lease_id set. Terminated/expired → revert.

When you add a new subtype with cascading effects, add them as DB
triggers, not app-level logic. This ensures consistency regardless of
whether the state change came from the UI, an API call, the lifecycle
function, or a manual SQL edit.

---

## 8. The Lifecycle Function

`process_contract_lifecycle()` — idempotent SECURITY DEFINER function.

Each invocation:
1. Expires contracts where `status='active'`, `end_date < current_date`, `auto_renew=false`.
2. Auto-renews contracts where the same conditions but `auto_renew=true`, extending `end_date` by the original duration.
3. Logs one `contract_events` row per affected contract.
4. Returns a jsonb summary.

### Scheduling

Currently invoked from the `/contracts` list page on mount, throttled
to once per 6 hours via localStorage. This is a stopgap.

**Long term**: the invocation moves to n8n. n8n runs a daily job that
calls the RPC, handles failures with retries, and triggers downstream
side effects (email notifications, review tickets, etc.). At that
point, remove the client-side invocation.

Do NOT enable pg_cron. All scheduling lives in n8n.

---

## 9. Wizard Pattern for Subtype Creation

Every subtype gets its own multi-step wizard. Conventions:

- **Modal-based**, max-width 680–720px.
- **4 steps** is the sweet spot. Fewer for simple types (NOC might be 2), more only if genuinely needed.
- **Step 1** always captures parties + period (universal across types).
- **Last step** always includes: documents upload, notes, review summary, status selector (Draft | Pending signature | Active), [Create contract] button.
- **Middle steps** are type-specific (fee structure for mgmt, rent/cheques for lease, scope of work for service, etc.).
- **Transactional save**: creating a contract inserts into parent + child + parties + subjects in a single transaction. Any failure rolls back.
- **Save as draft**: every wizard supports "Save as draft" at any step — creates the contract with status='draft', closes wizard, navigates to detail page where user can resume via Edit.

### Edit mode

The same wizard, reused with pre-filled fields, opened from the detail
page [Edit] button. Status selector is hidden in edit mode — status
transitions happen through dedicated actions (Activate / Mark as
signed / Terminate).

---

## 10. Detail Page Pattern

Every contract type uses the same detail page layout. Subtype-specific
content slots into the Overview tab; everything else is shared.

### Layout

- **Header**: breadcrumb, entity label ("MANAGEMENT AGREEMENT · CTR-2026-0042"), title, subtitle (parties and period), action buttons.
- **Summary cards row (5 cards)**: status, type, value/fee summary, subjects count, period. Card 3 (value/fee) is subtype-specific.
- **Tabs**: Overview, Parties, Subjects, Documents, Notes, History. Subtypes may add tabs (e.g., leases add Cheques).

### Action buttons

Standard set visible on every contract detail page:
- `Edit` — always, except expired/cancelled.
- `Activate` — when draft or pending_signature.
- `Mark as signed` — when pending_signature.
- `Terminate` — when active.
- `Delete` — only when draft.
- `Duplicate` — always.

Subtypes may add subtype-specific actions (e.g., leases add "Record
rent payment", "Mark cheque bounced" on the Cheques tab).

### Overview tab customization

The Overview tab is where subtypes render their specific fields.
Conventions:
- Render in read-only cards by default.
- A subset of fields allow inline edit for quick tweaks (notes, external reference, auto-renew toggle).
- Structural fields (fee model, rent amount, payment frequency) require opening the wizard in edit mode — they have interdependencies that inline editing can't handle safely.

---

## 11. How to Add a New Contract Subtype

Use this as a checklist. Worked example below in §12.

1. **Add the enum value** to `contracts.contract_type` check constraint. Extend the check, don't replace it.
2. **Create the child table** `<subtype_name>s` (plural, snake_case) with `contract_id uuid not null unique fk → contracts(id) on delete cascade` as the first column.
3. **Add subtype-specific columns** to the child table. Keep common fields on the parent.
4. **Extend `getAllowedPartyRoles`** in the frontend with the roles this subtype uses.
5. **Build the wizard**. 4 steps, transactional save, draft/active status selector at the end.
6. **Add subtype to the type-picker** modal. Remove the "Coming soon" pill from that card.
7. **Build the Overview tab section** for the subtype — how its specific fields render on the detail page.
8. **Add type-specific triggers** if the subtype cascades state elsewhere (e.g., lease→unit status).
9. **Extend the lifecycle function** if the subtype needs custom expire/renew logic (rare — most subtypes inherit parent behavior).
10. **Update this document** with a new section describing the subtype's specifics.
11. **Add a number prefix** decision: reuse `CTR` or pick a subtype-specific prefix (e.g., `LSE` for leases). If subtype-specific, decide now — changing later means re-numbering existing rows.

### Do NOT

- Do not touch the parent `contracts` table to accommodate one subtype's needs. If it's subtype-specific, it goes in the child.
- Do not bypass `contract_parties` / `contract_subjects` with "simpler" inline fields like `landlord_id` or `unit_id` on the child. The shared tables work for every subtype; shortcutting breaks cross-type queries.
- Do not create per-subtype status enums. Use the parent's status column.
- Do not bypass `contract_events` for subtype-specific audit needs. Add new event_type values instead.

---

## 12. Worked Example: `management_agreements` (Reference Subtype)

The first subtype built. Read this file's git history alongside the
migration for specifics.

### Child table

`management_agreements` — 1:1 with contracts via `contract_id`.

Type-specific fields:
- Fee model: `fee_model` (enum: percentage_of_rent, flat_annual, flat_per_unit, hybrid), `fee_value`, `fee_applies_to` (contracted_rent vs collected_rent).
- Hybrid-specific: `hybrid_base_flat`, `hybrid_threshold`, `hybrid_overage_percentage`.
- Lease-up fee: `lease_up_fee_model`, `lease_up_fee_value` (one-time fee when placing new tenants).
- Operational terms: `repair_approval_threshold`, `termination_notice_days`.
- Scope: `scope_of_services` jsonb array of service codes, `scope_of_services_other` free-text.

### Allowed roles

`service_provider` (PM company), `client` (landlord), `other`.

### Wizard

4 steps: Parties & Period → Properties Managed → Fee Structure & Scope → Documents, Review, Activate.

### Overview tab

Renders fee structure, scope (as tag pills), repair threshold,
termination notice. Notes, external reference, auto-renew toggle,
and termination notice days are inline-editable. Fee model and
scope require opening the wizard in edit mode.

### Triggers

None. Management agreements don't cascade state elsewhere — activating
one doesn't change any other table.

---

## 12b. Worked Example: `leases` (Second Reference Subtype)

Adds two layers on top of the base CTI pattern: a child table
(`leases`) for type-specific fields, and a **grandchild** table
(`lease_cheques`) for the rent payment schedule.

### Child & grandchild tables

`leases` (1:1 with `contracts`):
- `annual_rent`, `payment_frequency` (`1_cheque` / `2_cheques` / `4_cheques` / `6_cheques` / `12_cheques` / `custom`)
- `first_cheque_date`
- `security_deposit_amount`, `security_deposit_status`, `security_deposit_notes`
- `commission_amount`, `commission_payer` (tenant/landlord/split), `commission_status` (pending/paid)
- `ejari_number`

`lease_cheques` (N per lease):
- `sequence_number` (unique per lease, gaps allowed after regeneration)
- `amount`, `due_date`
- `cheque_number`, `bank_name` (filled when physical cheques are collected)
- `status` (`pending` → `deposited` → `cleared`, with `bounced` / `returned` / `replaced` branches)
- `deposited_on`, `cleared_on`, `bounced_on`, `bounce_reason`
- `replacement_cheque_id` (self-FK — points the bounced cheque to its replacement)

### Allowed roles

`getAllowedPartyRoles('lease')` returns `landlord`, `tenant`, `broker`,
`guarantor`, `other`. **The PM company is intentionally NOT a party** —
the lease is between landlord and tenant. The PM's authority derives
from the active management agreement covering the unit.

### Number prefix

`LSE` (e.g., `LSE-2026-0001`). Independent counter from `CTR` —
separate row in `number_sequences`.

### Wizard

`LeaseWizard` (4 steps): (1) tenant + landlord + period, (2) rent +
cheque schedule, (3) deposit + commission, (4) docs + review.
Auto-fills landlord from `resolveUnitOwners()`. Cheque schedule
auto-generated from `generateChequeSchedule()` (in `src/lib/leases.ts`)
for fixed frequencies; `custom` requires manual rows.

### Detail page

Adds a **Cheques tab** between Documents and Notes with per-cheque
status actions (mark deposited / cleared / bounced / returned, replace).
Summary cards swap to lease-relevant metrics: rent (annual + monthly),
next cheque due, tenant.

### Triggers (lease-specific)

1. **`sync_unit_status_on_lease_state_change`** — fires on
   `contracts.status` change when `contract_type='lease'`. On `→ active`,
   sets the unit's status to `occupied` and `status_locked_by_lease_id`
   to the lease's contract id. On `active → expired/terminated/cancelled`,
   reverts the unit to `vacant` and clears the lock (only if THIS lease
   set it — defensive against races).

2. **`check_no_overlapping_active_lease`** — DB-level integrity backstop.
   Fires before activating a lease; raises `ERRCODE='P0001'` if another
   active lease covers the same unit on overlapping dates. Wizard mirrors
   this check at Step 1 advance for friendly UX; trigger ensures DB
   consistency even if the wizard is bypassed.

### Precondition: management agreement must cover the unit

Soft-block (warning + override) when creating a lease on a unit not
covered by an active management agreement. The RPC
`has_active_mgmt_agreement_for_unit(unit_id)` returns true if any
active management agreement subjects the unit directly OR its building.
If the user proceeds without one, a `contract_events` note is logged on
the new lease so the gap is auditable.

### Duplicate flow

The base contract duplicate clones the `contracts` row, parties, and
subjects. `duplicateLeaseExtras()` then inserts a fresh `leases` row
copying structural fields (annual_rent, payment_frequency,
first_cheque_date, deposit/commission amounts) but resetting
transactional state (statuses → pending, ejari_number → null).
**Cheques are NOT cloned** — the wizard auto-generates a fresh
schedule when the user sets dates and advances to Step 2.

### Convention: subtype-specific preconditions

The mgmt-agreement precondition for leases is the first example of a
**dependency precondition**. Future subtypes that have similar gating
(e.g., a brokerage agreement might require a valid trade license)
should follow the same pattern: a SECURITY DEFINER RPC that returns
a boolean, soft-block in the UI, audit log on override.

---

## 13. Deferred Subtypes (Roadmap)

### `leases` — **shipped (Pass B)**. See §12b below for the worked example.

### `service_agreements` — **shipped (V3)**. See §12c for the worked example.

### `brokerage_agreements` — ships with broker/deal tracking

Commission %, exclusivity, territories, duration.

### `sale_purchase_agreements`, `noc`, `addendum`

Future, no prioritization yet.

---

## 12c. Worked Example: `service_agreements` (Third Reference Subtype)

Adds a vendor-anchored subtype: every service agreement is owned by
exactly one vendor, captured as a direct FK on the child table.

### Child table

`service_agreements` (1:1 with `contracts`):
- `vendor_id` — direct FK to `vendors`, `ON DELETE RESTRICT`
  (don't allow deleting a vendor with active or historical agreements).
- `scope_of_services` — `jsonb` array of scope codes
  (`preventive_maintenance`, `cleaning`, `pest_control`,
  `hvac_maintenance`, `plumbing_services`, etc.) plus an
  `scope_of_services_other` free-text fallback.
- `service_frequency` — `on_demand | weekly | biweekly | monthly |
  quarterly | semi_annually | annually`.
- Fee model — `fixed_monthly | fixed_annual | per_call | per_unit |
  hybrid | time_and_materials | quote_based`. Conditional fields:
  `fee_value` (single-number models), `hybrid_base_monthly` +
  `hybrid_per_call_or_unit` + `hybrid_mode` (hybrid),
  `hourly_rate` + `call_out_fee` + `materials_markup_percent` (T&M).
- `materials_included` boolean + `materials_notes`.
- `response_time_urgent_hours`, `response_time_standard_hours`,
  `sla_notes` (optional MVP-simple SLA).

### Number prefix

`SVA` (e.g., `SVA-2026-0001`). Independent counter from `CTR` and `LSE`.

### Allowed roles

`getAllowedPartyRoles('service_agreement')` returns `service_provider`,
`client`, `other`. **Convention:**
- PM (self-person) → `client`
- Vendor signatory (a person from `vendor_contacts`) → `service_provider`
- The vendor entity itself is on `service_agreements.vendor_id`, not
  `contract_parties`.

### Wizard

`ServiceAgreementWizard` (4 steps): (1) vendor + signatory + period,
(2) properties covered, (3) scope/frequency/fee model, (4) docs +
review + activate. Reused in edit mode from the detail page (matches
the wizard-as-edit pattern set by mgmt agreements and leases).

### Detail page

Standard contract detail scaffold with a service-agreement-specific
Overview block: vendor card + signatory, scope chips + frequency,
fee structure (model-specific rendering), materials block, optional
SLA block, coverage list. Inline-editable: `sla_notes`,
`materials_notes`, `scope_of_services_other`, parent `notes` and
`external_reference`. Structural fields (fee model, fee values,
vendor) require opening the wizard.

### Soft precondition (cross-module)

The vendor-assignment dialog on tickets calls
`has_active_service_agreement_for_vendor_and_unit(p_vendor_id, p_unit_id)`
to surface a non-blocking warning when no active agreement covers
the vendor + unit (or its building). Same SECURITY DEFINER + soft-block
+ wizard quick-launch pattern as the mgmt-agreement precondition for
leases (see §12b).

### Triggers

None. Service agreements don't cascade state to other tables — they're
the contractual backing for ad-hoc and scheduled vendor work, but
they don't gate ticket creation or vendor assignment hard.

---

## 14. Non-Obvious Decisions (the "why" log)

Reasons for choices that might otherwise be re-litigated:

- **Lessor/Lessee roles dropped** — pure legal synonyms for landlord/tenant. UAE Ejari uses landlord/tenant exclusively. Keeping both invites inconsistency.
- **Witness role dropped from `contract_parties`** — legal witnesses sign contracts but aren't typically modeled as parties. They sign on a signature block. If really needed, use role='other' with a descriptive party note.
- **`app_settings` singleton, not `organizations`** — we're single-tenant today. Paying the multi-tenancy tax (org_id on every table, RLS policies everywhere) before there's a second tenant is premature. `app_settings` gives us a home for global configuration today; renaming to `organizations` with added columns is the migration path if multi-tenancy ever arrives.
- **Contract number = counter table, not sequence** — see §6.
- **Scheduling in n8n, not pg_cron** — one scheduling system, not two. pg_cron splits the workflow surface and offers weaker observability than n8n.
- **Polymorphic `entity_type` + `entity_id`** — used for photos, documents, notes, and contract_subjects. Mild loss of DB-level referential integrity in exchange for dramatically better query ergonomics across entity types.
- **Status locking via DB triggers** — centralizes the "active lease locks unit to occupied" rule so it can't be bypassed from the UI, API, or manual SQL.
- **is_self as a column on `people`, not a separate `self_person` table** — one source of truth for person data. The `is_self` flag plus the pointer from `app_settings.self_person_id` is cheap and symmetric.
- **`parent_contract_id` on contracts** — reserved for addendums and renewals. Not used in UI yet; column exists so we don't have to migrate later.
- **Overview tab has limited inline edit** — structural fields (fee model, rent, payment schedule) have interdependencies that inline save can't validate. Edit mode via wizard forces the user through validation for those changes. Low-risk fields (notes, boolean toggles) stay inline-editable for ergonomics.

---

## 15. Glossary

- **CTI** — Class Table Inheritance. Parent table with shared fields, 1:1 child tables for per-subtype fields.
- **Subtype** — a specific type of contract (management agreement, lease, etc.). Same word, both in code (child table name) and in conversation.
- **Self-person** — the `people` row representing the PM company itself, flagged with `is_self=true` and pointed to from `app_settings.self_person_id`.
- **Subject** — a property (building or unit) that a contract covers. Stored in `contract_subjects`.
- **Signatory** — a party to the contract who needs to sign. `contract_parties.is_signatory=true`.
- **Lifecycle function** — `process_contract_lifecycle()`. The scheduled job that handles auto-expiry and auto-renewal.

---

*Last updated: V3 shipped — service_agreements subtype + soft precondition for vendor assignment. See §12c for the service-agreement worked example.*
