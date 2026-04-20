# Vendors Module

## Purpose
Track external specialists and contractors (companies and individuals) we
work with — with compliance, rates, specialties, and contact info — so
operations always knows who to call, what they cost, whether their papers
are in order, and which trades they cover.

## Entity model

- `vendors` — the vendor entity itself (company or individual)
- `vendor_contacts` — junction linking vendors to `people` records (one
  vendor may have many contacts; people can be linked to many vendors)
- `vendor_events` — lightweight audit log (created, status changes,
  blacklisted, reactivated, preferred toggled, compliance updated)

A handyman is modelled as `vendor_type='individual'` with one
`vendor_contacts` row pointing at their personal `people` record. A
maintenance company is `vendor_type='company'` with one or more contacts.

## Schema highlights

- `vendor_number` — `VND-YYYY-NNNN`, auto-assigned via the shared
  `next_number` sequence (BEFORE INSERT trigger).
- `specialties` — `jsonb` array of enum-like strings. Indexed via GIN
  for "vendors who do X" queries. Free-form `specialties_other` for
  exotic specialties.
- Compliance fields — `trade_license_*`, `trn`, `insurance_*`. All
  optional, stored as plain `date` values.
- Status — `active | inactive | blacklisted`. Blacklisting requires
  `blacklist_reason` (DB-enforced check).
- `is_preferred` — separate boolean flag, independent of status. A
  preferred but inactive vendor is hidden from pickers but the badge
  is preserved for when they reactivate.

## Specialties model

Stored as a `jsonb` array. To add a new specialty:

1. Add the key to `SPECIALTIES` in `src/lib/vendors.ts`
2. Add a label in `SPECIALTY_LABELS`
3. Add an icon mapping in `SPECIALTY_ICONS`
4. (Optional) If the new specialty matches a maintenance ticket subtype,
   ensure `maintenanceTypeToSpecialty()` resolves it correctly so the
   vendor picker can smart-filter.

No DB migration is required; new keys are stored alongside existing ones.

## Compliance + expiry semantics

- Dates are stored as `date` (no time component).
- Helpers in `src/lib/vendors.ts`:
  - `complianceState(date, days=60)` → `valid | expiring | expired | missing`
  - `isComplianceExpiringSoon` / `isComplianceExpired` shortcuts
- Detail page shows banners for expiring / expired compliance.
- Directory page surfaces KPIs and per-row compliance dots with
  tooltips.

## Rate model

- `default_hourly_rate` and `default_call_out_fee` are *defaults* — per
  ticket the actual cost may differ.
- `currency` defaults to `AED` but is per-vendor (multi-currency safe).
- `rate_notes` is intentionally free-form — "weekday only", "min 2hrs",
  "+15% materials markup", etc. Don't try to model these as fields.

## Status & preferred tiering

- `active`: shows in pickers by default. Default sort surfaces
  preferred vendors first.
- `inactive`: hidden from pickers by default but kept for history.
  Reactivation is one click.
- `blacklisted`: hidden from pickers; cannot be assigned to new tickets
  via the UI (V2 enforces this). Existing assignments are preserved.

## Non-obvious decisions

- **Vendors are separate from People.** A vendor entity carries
  compliance, rate, and specialty data that doesn't belong on a person
  record. People-as-vendor (handymen) get *both*: a person record
  (their identity) plus a vendor record (their commercial entity).
- **Specialties as `jsonb` array, not a junction table.** Specialties
  are a small enumerable list. A junction table would mean a join on
  every list query — not worth the schema overhead for ~15 values.
- **No per-specialty rates.** A plumber who also does electrical
  doesn't typically charge differently per trade. If they do, capture
  it in `rate_notes` or split into two vendors.
- **Compliance dates instead of timestamps.** "License expires Dec 31"
  is not a 23:59:59 event — calendar-day semantics avoid timezone
  pitfalls.
- **One primary contact per vendor.** Enforced via partial unique
  index AND a BEFORE INSERT/UPDATE trigger that demotes other
  primaries when a new one is set. Application code can naively flip
  `is_primary=true` and trust the DB to maintain the invariant.

## Service agreements (V3)

Service agreements are a contract subtype (`contract_type='service_agreement'`,
prefix `SVA-YYYY-NNNN`) with a direct `vendor_id` FK on
`service_agreements.vendor_id`. They cover the commercial relationship
between the PM and a vendor for ongoing or on-call work.

- **Schema** — `service_agreements` child table holds fee model
  (`fixed_monthly | fixed_annual | per_call | per_unit | hybrid |
  time_and_materials | quote_based`), service frequency, scope as a
  `jsonb` array, materials handling, and SLA response times.
- **Vendor as entity, signatory as party** — the vendor entity is
  `service_agreements.vendor_id`. The person signing on the vendor's
  behalf is a `contract_parties` row with `role='service_provider'`,
  picked from `vendor_contacts`. PM (self-person) is `role='client'`.
- **Wizard** — `ServiceAgreementWizard` (4 steps): Parties & Period →
  Properties Covered → Scope & Fees → Documents, Review & Activate.
  Reused in edit mode from the contract detail page.
- **Vendor detail integration** — Service Agreements tab on the vendor
  page lists every agreement (active first, inactive muted). Empty
  state launches the wizard with the vendor pre-filled.
- **Soft precondition on vendor assignment** — when assigning a vendor
  to a maintenance ticket targeting a unit, the Assign Vendor dialog
  calls `has_active_service_agreement_for_vendor_and_unit(vendor, unit)`.
  If no active agreement covers vendor + unit (or its building), an
  amber, non-blocking warning surfaces with a "Create agreement" CTA
  that launches the wizard pre-filled with the vendor. Users can
  proceed without an agreement.

## Compliance auto-tickets (T3a extension)

`detectVendorComplianceExpiry()` in `src/lib/automations.ts` sweeps
active vendors whose `trade_license_expiry_date` or
`insurance_expiry_date` falls within 60 days (or is already past).

- **Dedup key** — `vendor_compliance:{trade_license|insurance}:{vendor_id}:{expiry_iso}`.
  The expiry date is part of the key so renewals (which move the date
  forward) cleanly trigger a fresh ticket on the next sweep without
  needing the prior ticket to be deleted.
- **Priority** — already expired → `urgent`; ≤30 days → `high`;
  ≤60 days → `medium`.
- **Target** — `target_entity_type='vendor'`, surfaced via the vendor
  detail page Tickets tab.
- **Type** — `compliance_reminder`. Canonical target is `vendor`.

## Ticket integration (V2)

- **`tickets.vendor_id`** — separate from `assignee_id` (an internal
  person). Nullable; set/unset via the Assign/Change Vendor dialog,
  the New Ticket dialog, or the Edit Ticket dialog.
- **Vendor Dispatch workflow** — auto-initializes the first time a
  vendor is assigned to a ticket *that has no workflow yet*. Existing
  workflows are NEVER replaced; users can switch separately.
- **Cost approval ↔ workflow step sync** — the
  `vendor_quote_landlord_approval` step auto-completes on `approved`
  and auto-skips on `not_required` via a DB trigger
  (`sync_vendor_workflow_approval_step`). On `rejected` the step
  stays pending so the stage can't advance.
- **Smart specialty filter** — vendor pickers default to vendors whose
  `specialties` array matches the ticket's maintenance type. Users can
  toggle "Show all specialties".
- **Vendor detail Tickets tab** — two grouped sections:
  - *Assigned tickets* — `vendor_id = this vendor`
  - *Tickets about this vendor* — `target_entity_type='vendor'`
  Two distinct CTAs cover both creation patterns.
- **Blacklisted vendors** are excluded from pickers; existing
  assignments remain valid for historical integrity.

## Glossary

- **VND #** — vendor number, format `VND-YYYY-NNNN`.
- **Specialty** — trade or service category (AC, plumbing, etc.).
- **Compliance** — trade license + insurance (and TRN for VAT).
- **Preferred vendor** — operator-flagged, gold star, sorted first in
  pickers. Independent of active/inactive status.
- **Blacklist** — strong "do not use" flag with required reason. Lifts
  via Reactivate / Lift blacklist action.

---

Last updated: V3 shipped.
