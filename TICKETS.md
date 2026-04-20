# Tickets Module — Architecture & Extension Guide

This document is for anyone (engineer, future Claude/Lovable session,
or you in six months) who needs to add a new ticket type, wire up an
automation hook, or understand why the tickets module looks the way
it does.

It is a **convention document**, not a field-level reference. Specific
column names and types live in migrations; this doc captures the
patterns and the reasoning behind them.

---

## 1. Purpose

A property management platform generates a constant stream of work:
broken AC units, missing Ejari registrations, tenant requests for
early termination, expiring trade licenses, bounced cheques to chase,
move-in checklists, complaints to triage, data gaps to plug.

All of this is **work that has a target, a state, and an owner**.
The tickets module models that as a single polymorphic work-tracking
table — `tickets` — that can attach to any entity in the system
(units, buildings, contracts, people, cheques) and ride a uniform
lifecycle from open → done.

Tickets are the system's "to-do list with context": every actionable
item that doesn't fit cleanly inside the lifecycle of another entity
lands here.

---

## 2. Core Concept — Polymorphic Work-Tracking

One table, many subjects. A ticket has:

- A **target** — the thing the ticket is about (`target_entity_type`
  + `target_entity_id`, polymorphic, no FK).
- A **type** — what kind of work this is (`ticket_type`, flat enum).
- A **lifecycle state** — where it is in the process (`status` +
  `waiting_on`).
- A **cost dimension** — optional estimate/actual, with auto-managed
  approval gating tied to the active management agreement.
- An **assignee** — who's responsible right now.
- An **audit trail** — every structural change logged to
  `ticket_events`. Human conversation goes in `notes`.

No subtypes. No CTI. No per-type child tables. The `ticket_type`
enum is the only differentiator, and the schema flexes only via
the polymorphic target and the optional cost block.

### Why no CTI like contracts

Contracts have genuinely different shapes per subtype (a lease has
rent and cheques; a management agreement has fee structure; a
brokerage agreement has commission terms). The shared infrastructure
is a small fraction of the data per row, so CTI earns its keep.

Tickets don't. A maintenance ticket and an admin ticket and a
compliance reminder all share the same fields: subject, status,
priority, due date, assignee, costs. Splitting them into per-type
tables would create N tables holding N copies of the same columns
for no benefit. The flat enum + polymorphic target is the right
shape.

---

## 3. Schema Layout

### `tickets`

One row per work item. Holds: id, ticket_number (`TKT-YYYY-NNNN`),
subject, description, ticket_type, priority, status, waiting_on,
target_entity_type + target_entity_id, parent_ticket_id (for
sibling/subtask relationships), assignee_id, reporter_id,
is_system_generated, due_date, lifecycle timestamps (resolved_at,
closed_at, cancelled_at), cancelled_reason, cost block
(estimated_cost, actual_cost, currency, cost_approval_status,
cost_approved_by_person_id, cost_approved_at, cost_approval_notes),
audit columns.

### `ticket_events`

Append-only audit log for every structural change. One row per
change: status, priority, assignee, reporter, target, due date,
cost estimate, actual cost, cost-approval transitions. Reopens
get their own event in addition to the status_changed row.

### Shared cross-cutting tables

The polymorphic `notes`, `documents`, and `photos` tables all
accept `entity_type='ticket'`. Use them for:
- **notes** — human comments, status updates, conversation
  ("Vendor confirmed visit Tuesday 10am").
- **documents** — invoices, quotes, receipts, signed work orders.
- **photos** — before/after pictures, evidence of damage,
  completion proof. Critical for maintenance tickets.

---

## 4. Ticket Taxonomy

### `ticket_type` (flat enum)

Grouped by prefix for ergonomic filtering, even though there's no
formal hierarchy:

| Prefix / value | Use case |
|---|---|
| `maintenance_ac` | AC repair / service |
| `maintenance_plumbing` | Plumbing |
| `maintenance_electrical` | Electrical |
| `maintenance_appliance` | Appliances (oven, fridge, washer) |
| `maintenance_structural` | Walls, ceilings, doors, windows |
| `maintenance_pest_control` | Pests |
| `maintenance_other` | Catch-all for maintenance |
| `admin_ejari` | Ejari registration / renewal admin work |
| `admin_dewa` | DEWA setup / transfer / disconnect |
| `admin_noc` | NOC chasing / issuance |
| `admin_other` | Catch-all admin |
| `request_renewal` | Tenant or landlord requesting renewal |
| `request_early_termination` | Early termination request |
| `request_sublease` | Sublease permission request |
| `request_modification` | Tenant modification request (paint, fixtures) |
| `request_other` | Catch-all requests |
| `compliance_reminder` | Trade license expiry, insurance renewal, etc. |
| `rent_follow_up` | Chase tenant for rent / bounced cheque follow-up |
| `handover_task` | Move-in checklist item |
| `moveout_task` | Move-out checklist item |
| `data_gap` | Missing required data flagged by the system |
| `complaint` | Tenant or neighbor complaint |
| `other` | True misc. Use sparingly |

The `maintenance_*` prefix is meaningful: the cost-approval trigger
only auto-evaluates tickets matching `maintenance_%`. Other types
leave `cost_approval_status` untouched (typically NULL).

### `priority`

`low` | `medium` | `high` | `urgent`. Drives sorting and SLA later.
No business rules attached at the DB level beyond the enum.

### `status`

The state machine:

```
open → in_progress → (awaiting ↔ in_progress) → resolved → closed
                                                              ↑
                                                  (cancelled at any point)
                                                              ↓
                                                  (reopen → in_progress)
```

- **open** — created, not actively being worked.
- **in_progress** — someone is on it.
- **awaiting** — blocked on a third party. **Requires `waiting_on`
  to be non-null** (DB constraint).
- **resolved** — work done, awaiting confirmation/sign-off.
- **closed** — final state, signed off.
- **cancelled** — abandoned. `cancelled_at` auto-populated.

Reopening a closed/cancelled ticket clears `closed_at` /
`cancelled_at` automatically and emits a `reopened` event.

### `waiting_on`

Only valid when `status='awaiting'`. Values: `tenant`, `landlord`,
`vendor`, `internal`, `external`. Enforced by a check constraint:
`waiting_on` must be set iff status is `awaiting`.

---

## 5. Target Model

`(target_entity_type, target_entity_id)` is the polymorphic pointer.
Allowed entity types:

| Type | What it points at |
|---|---|
| `unit` | A `units` row |
| `building` | A `buildings` row |
| `contract` | A `contracts` row (lease, mgmt agreement, etc.) |
| `person` | A `people` row |
| `cheque` | A `lease_cheques` row |

### Why `contract` and not `lease`

Leases are contracts in the CTI model — `contracts.contract_type='lease'`.
A ticket about a lease uses `target_entity_type='contract'` with the
lease's `contract_id`. The UI resolves display via `contracts.contract_type`
(see `resolve_ticket_target_label`).

The same ticket-target enum value (`contract`) covers tickets about
management agreements, future brokerage agreements, addendums, etc.
If we used `lease` as a separate value we'd be back to the same
per-subtype proliferation problem we avoided in the contracts module.

### Why polymorphic without FK

Identical tradeoff as `contract_subjects`: query ergonomics win over
DB-level referential integrity. App code validates target existence
before insert (`resolve_ticket_target_label` returns NULL for missing
entities, which surfaces in the UI as a broken-target indicator).

### Resolution helper

`resolve_ticket_target_label(entity_type, entity_id) → text` returns
a human-readable label:
- `('unit', uuid)` → `'Unit 1607 · HDS Business Center'`
- `('contract', uuid)` → `'Lease LSE-2026-0042'` or `'Management Agreement CTR-2026-0008'`
- `('person', uuid)` → `'{first_name} {last_name}'`
- `('cheque', uuid)` → `'Cheque #3 · LSE-2026-0042'`
- `('building', uuid)` → `'{building.name}'`

Returns NULL if entity doesn't exist.

---

## 6. Status Lifecycle + `waiting_on` Semantics

The lifecycle is enforced via:

1. **Status enum** (DB constraint).
2. **`waiting_on` consistency** (DB constraint: present iff
   `status='awaiting'`).
3. **`cancelled_at` consistency** (DB constraint: present iff
   `status='cancelled'`).
4. **`manage_ticket_lifecycle_timestamps` trigger** —
   auto-populates `resolved_at` / `closed_at` / `cancelled_at` on
   transition into those states; clears `closed_at` /
   `cancelled_at` on reopen.
5. **`log_ticket_events` trigger** — emits `status_changed` for
   every transition; emits an additional `reopened` event when
   transitioning out of `closed`/`cancelled`.

### Why `waiting_on` is separate from `status`

It would be tempting to bake the blocker into the status enum
(`awaiting_tenant`, `awaiting_vendor`, etc.). We didn't because:

- The status state machine should describe **lifecycle** (is this
  active, done, dead?), not the specific blocker.
- Filtering "what's blocked on the tenant?" cleanly returns
  `waiting_on='tenant'` regardless of whether the underlying status
  semantics shift later.
- Adding a new blocker type doesn't churn the status enum.
- Reporting on resolution time per status is simpler when the
  enum has fewer values.

The DB-level constraint enforces the invariant cheaply.

---

## 7. Audit Trail — `ticket_events` vs `notes`

Two distinct streams:

| | `ticket_events` | `notes` |
|---|---|---|
| What | Structural changes only | Human conversation |
| Who writes | Triggers, never user | Users via UI |
| Schema | Typed events with from/to values | Free text body |
| Mutable | No (admin-only DELETE for cleanup) | Yes (author/admin can edit) |
| Used for | Audit, automation triggers, history timeline | Status updates, vendor coordination, tenant comms |

Both should appear interleaved on the ticket detail page's history
tab — events in a structured "ticket changed status from X to Y"
row, notes in a conversation-like row.

### Why separate

- Events are immutable facts about state changes. Notes are
  editable opinion/conversation. Mixing them makes the audit
  unreliable.
- Events have a closed event_type vocabulary that's safe for
  automation and reporting. Notes are free text.
- Permissions differ: anyone with role 'staff' can write a note,
  but events should only come from triggers.

---

## 8. Cost Approval + Management Agreement Integration

Maintenance tickets often need landlord approval before work
proceeds, but only above a threshold the management agreement
defines (`management_agreements.repair_approval_threshold`).

### How auto-evaluation works

The `auto_set_cost_approval_status` trigger fires `BEFORE INSERT
OR UPDATE OF estimated_cost, ticket_type, target_entity_type,
target_entity_id`. Logic:

1. If `ticket_type` is not `maintenance_*` OR `estimated_cost` is
   NULL → skip. (Status stays as whatever it was, typically NULL.)
2. If current `cost_approval_status` is `'approved'` or
   `'rejected'` → skip. **Manual decisions are sacred.** A
   subsequent estimate change won't auto-reset an approved repair.
3. Resolve the applicable threshold via
   `get_applicable_repair_threshold(target_entity_type,
   target_entity_id)`.
4. If threshold is NULL (no active mgmt agreement covers the
   target) → set `cost_approval_status='pending'`. Safe default:
   surface for human review.
5. If `estimated_cost > threshold` → `'pending'`.
6. Otherwise → `'not_required'`.

### Threshold resolution

`get_applicable_repair_threshold(entity_type, entity_id)`:

1. Resolve the unit (and/or building) from the target:
   - `unit` → that unit.
   - `building` → that building.
   - `contract` → the unit on `contract_subjects`, falling back to
     building.
   - `cheque` → trace to the lease's contract → unit.
   - `person` → no property context, returns NULL.
2. If we have a unit but no building, derive the building.
3. Find the **active** management agreement whose
   `contract_subjects` covers the unit (preferred) or the building.
   Unit-level wins over building-level when both exist; ties broken
   by most recent `start_date`.
4. Return its `repair_approval_threshold`, or NULL.

### Why "pending when threshold unknown"

Erring on the side of human review is cheap: one extra approval
click. Erring the other way (auto-approving without context) could
green-light an expensive repair without landlord sign-off.

### Why manual approval is preserved through cost edits

Once a human has approved a 500 AED repair, bumping the estimate
to 510 shouldn't silently revoke approval and re-prompt. Material
cost changes are a human-judgment call: the user must explicitly
set `cost_approval_status` back to NULL or `'pending'` to re-run
the auto-evaluation. The wizard/UI in T2 will surface a
"Re-evaluate approval" action for this.

---

## 9. Automation Hooks (Reserved for T3)

The schema is prepared for n8n-driven automation to land in T3:

- **System-generated tickets** — `is_system_generated=true` flag
  exists. Triggers/RPCs in T3 will create tickets for: bounced
  cheques, leases ending in 60 days without renewal activity, units
  marked occupied without an active lease, expiring trade licenses,
  Ejari renewals due.
- **Webhook payloads** — `ticket_events` is the source of truth
  for "what changed". An n8n trigger can subscribe to inserts and
  fan out (email tenant, notify assignee, push to Slack).
- **Bulk SLA reporting** — the partial index on `due_date WHERE
  status IN ('open','in_progress','awaiting')` keeps "tickets past
  due" queries cheap.

T3 will add the actual RPCs and the n8n flows. T1 only ships the
substrate.

---

## 10. How to Add a New Ticket Type

Use this checklist when introducing a new value:

1. **Add the enum value** to the `tickets_ticket_type_check`
   constraint. Extend, don't replace.
2. **Pick a prefix carefully**:
   - `maintenance_*` → triggers cost-approval auto-evaluation.
   - Anything else → cost block stays untouched by the trigger.
   - If you want auto-cost-evaluation for a non-maintenance type,
     extend `auto_set_cost_approval_status` to match the new
     prefix instead of inventing a parallel mechanism.
3. **Document the type's purpose** in §4 above.
4. **Decide if it needs a default `priority`** — most types use
   the table default (`medium`). If a type should default to
   `high` (e.g., `complaint`), surface that in the UI's create
   form rather than the DB default; the DB default stays uniform.
5. **Update UI (T2)** type-picker to surface the new type.
6. **Consider automation (T3)** — should anything in the system
   create this type automatically?

### Do NOT

- Do not create a per-type child table. The flat enum is the
  correct shape; if a type genuinely needs structured extra fields,
  store them as a `notes`/`documents` attachment or rethink the
  abstraction.
- Do not introduce per-type status enums. The lifecycle is
  deliberately uniform.
- Do not bypass `ticket_events` with custom audit tables.
- Do not piggyback unrelated work on the cost block — it's
  specifically about repair approval.

---

## 11. Non-Obvious Decisions (the "why" log)

- **Flat `ticket_type` enum, no category+type hierarchy** — the
  prefix convention (`maintenance_*`, `admin_*`, `request_*`)
  gives us ergonomic filtering without the schema cost of a
  separate category column. We can promote the prefix to a
  computed column later if grouping queries get noisy.
- **`contract` as the target type, not `lease`** — leases are
  contracts. Adding per-subtype target enum values invites the
  same sprawl the CTI model in contracts deliberately avoided.
  UI resolves the specific contract subtype via
  `contracts.contract_type` and `resolve_ticket_target_label`.
- **`waiting_on` separate from `status`** — see §6. Lifecycle is
  about state; blocker is about cause. Mixing them inflates the
  status enum and complicates reporting.
- **Single `assignee_id`, not multi-assignee** — most tickets
  have one owner at a time. Watchers/collaborators can be modeled
  later via a join table if real demand emerges. Premature
  multi-assignment was rejected.
- **Cost-approval auto-trigger sets `pending` when threshold is
  unknown** — see §8. Safe default; the cost of human review is
  one click, the cost of silent auto-approval is real money.
- **`notes` and `ticket_events` are separate** — see §7. Audit
  rigor and human conversation have different write patterns,
  permissions, and mutability requirements.
- **No FK on `target_entity_id`** — polymorphic targets need
  app-level validation. Same tradeoff as `contract_subjects`,
  `documents`, `photos`. The query ergonomics ("all tickets for
  this unit") win.
- **`parent_ticket_id` ON DELETE SET NULL, not CASCADE** — when
  a parent ticket is deleted, sibling tickets persist. They
  represent independent work; orphaning them by clearing the
  pointer is correct.
- **`ticket_events` has no INSERT policy** — only the
  `log_ticket_events` SECURITY DEFINER trigger writes. This
  guarantees the audit log can't be forged from the client.
- **`is_system_generated` boolean instead of a separate
  `created_by_system` reference** — we don't need to identify
  *which* system. The flag plus a NULL `created_by` is enough;
  UI displays "System".
- **No SLA / due-date alerting in the schema** — that belongs in
  n8n. The DB ships indexes that make those queries fast; n8n
  ships the schedule and the notifications.

---

## 12. Glossary

- **Target** — the entity a ticket is about. Polymorphic
  `(target_entity_type, target_entity_id)`.
- **Reporter** — the person who originated the ticket (often a
  tenant). Optional.
- **Assignee** — the person currently responsible for moving the
  ticket forward. Optional.
- **`waiting_on`** — when a ticket is blocked, who or what we're
  waiting for. Required when status is `awaiting`.
- **System-generated** — tickets created by automation, not a
  human user. Flagged via `is_system_generated=true`.
- **Cost approval** — the gate that maintenance tickets pass
  through when their estimate exceeds the management agreement's
  repair-approval threshold.
- **Sibling ticket** — a ticket sharing a `parent_ticket_id` with
  one or more others. Used for grouping related work without
  forcing a strict subtask hierarchy.

---

*Last updated: T1 shipped — schema, triggers, helpers, and this
document. Next: T2 — UI layer (list, detail, tabs on entity pages).*

---

## 11. Workflows (T2c)

A ticket can optionally carry a **workflow** — a structured sequence
of stages and steps that guides the work to completion. Workflows
are pure scaffolding: they don't change ticket status semantics, they
add a checklist on top.

### 11.1 Concept

- `tickets.workflow_key` (nullable) — the workflow attached to this
  ticket, if any.
- `tickets.current_stage_key` (nullable) — denormalised pointer to
  the active stage. Cleared when the workflow finishes.
- Both null → simple ticket, no workflow.
- Both set → workflow active.
- `workflow_key` set with `current_stage_key` null → workflow
  finished; the ticket may still be open and accepting work, but
  every stage is complete.

### 11.2 Data model

- `ticket_workflow_stages` — one row per (ticket, stage). Tracks
  status (`pending` / `in_progress` / `complete` / `skipped`),
  timestamps, completer.
- `ticket_workflow_steps` — one row per (ticket, stage, step). Same
  status triplet plus an optional note.
- A partial unique index ensures **only one stage per ticket can be
  `in_progress`** at a time.
- `stage_label`, `step_label`, and `step_description` are
  **snapshotted** at initialization. If we change the wording in
  `src/lib/workflows.ts` later, in-flight tickets keep their
  original copy. New tickets pick up the new copy. To migrate an
  old ticket onto the new definition, call
  `change_ticket_workflow`.

### 11.3 Config location

All workflow definitions live in `src/lib/workflows.ts`:

- `WORKFLOWS` — the catalogue, keyed by `WorkflowKey`.
- `DEFAULT_WORKFLOW_BY_TYPE` — suggests a workflow per ticket_type
  (e.g. `request_renewal` → `lease_renewal`).
- `getDefaultWorkflow(ticketType)` — returns the suggested workflow
  or null.
- `workflowToStagesPayload(w)` — flattens a workflow into the
  jsonb shape the RPCs expect.
- `preservedStepKeys(from, to)` — intersection of step keys, used
  when switching workflows so progress on shared steps carries over.

This is hardcoded in TS rather than stored in a `workflow_templates`
table. That's a deliberate trade-off: workflows are part of product
behaviour, not user data. They're versioned with the codebase and
reviewed in PRs. A future `workflow_templates` table is possible but
not warranted at this scale.

### 11.4 Engine RPCs

All multi-row mutations go through `SECURITY DEFINER` RPCs so the
event log and transactional guarantees stay consistent. The app
**never writes to `ticket_workflow_stages` or `ticket_workflow_steps`
directly**.

| RPC | Purpose |
|-----|---------|
| `initialize_ticket_workflow(ticket, key, stages)` | Set up stages + steps, mark first stage in_progress. |
| `complete_ticket_step(ticket, stage, step, note?)` | Mark a step complete. Does not auto-advance the stage. |
| `uncomplete_ticket_step(ticket, stage, step)` | Revert a complete step to pending. Allowed only inside the active stage. |
| `skip_ticket_step(ticket, stage, step, reason)` | Skip an optional step. Required steps cannot be skipped. |
| `advance_ticket_stage(ticket)` | Move to the next stage. Errors if any required step in the current stage is still pending. |
| `change_ticket_workflow(ticket, new_key, new_stages, preserved_keys)` | Swap workflow. App computes `preserved_keys` via `preservedStepKeys()`. |
| `remove_ticket_workflow(ticket)` | Strip the workflow entirely. |
| `get_ticket_workflow_summary(ticket)` | Read-only summary for UI. |

### 11.5 Why advance_stage doesn't auto-resolve the ticket

Some workflows (e.g. `move_in`) finish but the ticket may still
have follow-ups. Auto-resolving would force the user to re-open the
ticket to handle the long tail. Resolution stays an explicit user
action.

### 11.6 Adding a new workflow — checklist

1. Add the new value to `WorkflowKey` in `src/lib/workflows.ts`.
2. Define the `Workflow` object and add it to `WORKFLOWS`.
3. (Optional) Add a default in `DEFAULT_WORKFLOW_BY_TYPE`.
4. **No schema changes required.**
5. Existing tickets on other workflows are unaffected.

### 11.7 Step-key convention

Use descriptive, namespace-like keys (`outreach_initial`,
`doc_sign_tenant`). To enable progress preservation across workflow
switches, **reuse the same `step_key`** in different workflows for
conceptually identical steps. For example, `prearrival_ejari`
(move_in) and `activation_ejari` (lease_renewal) are different
because the contexts differ; if you want progress to carry over,
unify the keys.

---

## 12. Automation & Auto-Generated Tickets

System-generated tickets (`is_system_generated = true`) come from
three sources:

| # | Source | Mechanism | Latency |
|---|--------|-----------|---------|
| 1 | Cheque marked bounced | DB trigger on `lease_cheques` | Immediate (in-txn) |
| 2 | Lease expiry detection | `detectExpiringLeases()` sweep | 6h throttle |
| 3 | Data gap sweep | `detectDataGaps()` sweep | 6h throttle |

### 12.1 `system_dedup_key` convention

Every automation tags its tickets with a stable `system_dedup_key`
so dedup logic doesn't depend on subject wording. Pattern:
`<source>:<discriminator>[:<entity_id>]`.

| Source | Key |
|--------|-----|
| Bounced cheque | `cheque_bounce:<cheque_id>` |
| Lease renewal | `lease_renewal:<contract_id>` |
| Missing lease gap | `data_gap:missing_lease:<unit_id>` |
| Missing ownership gap | `data_gap:missing_ownership:<unit_id>` |

New automations should follow the same prefix pattern and rely on
the partial index `idx_tickets_system_dedup`.

### 12.2 Dedup strategies (intentional differences)

- **Cheque bounce** — non-terminal only. If the prior ticket is
  closed and the cheque is later un-bounced and re-bounced, a new
  ticket is created.
- **Lease renewal** — all statuses. Each lease gets exactly one
  renewal ticket for its lifetime. Follow-ups created manually.
- **Data gaps** — non-terminal only. The gap may legitimately
  recur (e.g., owner removed again).

### 12.3 Scheduling

Renewal + data-gap sweeps run client-side from
`processSystemAutomations()` in `src/lib/automations.ts`. Called
fire-and-forget on mount of `/tickets`, `/contracts`, and
`/lifecycle`, throttled to once per 6 hours via `localStorage`.

Trigger manually from devtools:

```js
window.__runAutomations()
```

T3b will move scheduling to n8n cron — automation functions
themselves don't change.

### 12.4 Behaviour for `is_system_generated = true`

- "Auto" badge in list rows and on the ticket detail header.
- **Cannot be deleted.** Admins can still cancel them.
- Appear in `/tickets` and entity Tickets tabs like any other ticket.
- `created_by` is `NULL`; History renders the actor as "System".

---

_Last updated: T3a shipped — auto-ticket creation (cheque bounce
trigger, lease renewal sweep, data gap sweep). Next: T3b — n8n
integration._
