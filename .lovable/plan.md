

# Addendum: Sub-services (Service Workflows)

The previous plan stands. This addendum extends the **Services** module to support multi-step services like Tenant Search & Onboarding, where one engagement contains many sequenced sub-tasks.

---

## The pattern

A "Service Request" can be either:

- **Atomic** — a single job (e.g. pipe repair, AC service). What we already designed.
- **Composite** — a parent service that contains ordered child sub-services (e.g. Tenant Search & Onboarding → Listing → Viewings → Offer & Negotiation → Contracting → Utilities setup → Move-in inspection → Handover).

No new top-level entity. We use **self-referential parenting** on the existing service request table: `parent_request_id` + `sequence_order`. A composite is just a request whose children render as a checklist/timeline.

---

## How it works

### Service Catalog gains "templates"
A catalog entry can declare itself as a **workflow template** with an ordered list of sub-steps. Each sub-step carries its own defaults: title, category, default delivery (vendor/staff), default billing (free/paid), typical duration, and dependency (sequential or parallel-ok).

Example template — "Tenant Search & Onboarding" (free, included in PM agreement):
```text
1. List unit on portals          — staff, free
2. Conduct viewings               — staff, free
3. Negotiate offer                — staff, free
4. Draft & sign tenancy contract  — staff, free
5. Ejari registration             — staff, paid (govt fee, pass-through)
6. Utilities (DEWA/chiller) setup — staff, free
7. Move-in inspection + photos    — staff, free
8. Key handover                   — staff, free
```

### Creating a composite request
When staff pick a workflow-template catalog entry:
1. Parent request is created (e.g. `SVC-2026-0042 — Tenant Search & Onboarding, Unit BLD-01-1203`).
2. All child sub-requests are created in one transaction with `parent_request_id = parent.id` and `sequence_order = 1..N`, each inheriting defaults from the template.
3. The parent's billing is computed: `free` if all children are free, otherwise `mixed` (shown as a breakdown).
4. The parent's status is **derived** from children, not set directly.

### Parent status derivation
```text
all children new/triaged          → parent: new
any child in_progress             → parent: in_progress
all children done                 → parent: done
any child awaiting_approval       → parent badge: "Approval needed"
any child cancelled (not all)     → parent stays in_progress, badge "Has cancellations"
```

### Approval at the right level
Approval lives on **each paid child**, not the parent. Ejari registration needs landlord approval (paid, configurable per contract); the free steps don't. This matches reality: landlords approve specific costs, not the whole engagement.

### Detail page for a composite
`/services/:id` adapts its layout when `children.length > 0`:
- Header: parent ref code, title, derived status, derived billing summary.
- **New "Steps" tab** (default tab for composites): ordered list of child sub-requests with inline status, assignee, due date, and a click-through to the child's own detail page.
- Existing tabs (Documents, Notes, History) aggregate across parent + children with a source label.
- Action: "Add step" (insert ad-hoc sub-request mid-workflow, e.g. "Tenant requested AC service before move-in").

### Detail page for a child
Same `/services/:id` page, but with a breadcrumb "← Part of SVC-2026-0042 Tenant Search & Onboarding" and a "Step 5 of 8" indicator.

### Dependencies between steps
v1 keeps it simple: steps are **advisory-sequential** — staff see the order but can work them in any sequence. A small `blocks_next` boolean per template step lets us later enforce hard gates (e.g. "Can't start Utilities until Contract signed"). Designed in, not enforced in v1.

### List view
Service Requests list shows only **parents + atomic requests** by default (one row per engagement). A "Show sub-steps" toggle expands children inline. This keeps the queue readable.

### Recurrence
Workflow templates can also recur (e.g. annual lease renewal workflow). The scheduler regenerates the parent + all children fresh each cycle.

---

## Schema delta vs the previous plan

Two added columns on `service_requests`:
- `parent_request_id uuid null` — self-FK, null for atomic & top-level composites.
- `sequence_order int null` — position within parent.

One added concept on `service_catalog`:
- `workflow_steps jsonb` — ordered array of step templates (title, category, default_delivery, default_billing, blocks_next, typical_duration_days).

Derived parent status is computed in a view or a small RPC `get_request_rollup(request_id)` — no stored denorm to keep stale.

---

## Examples mapped to this design

| Scenario | Shape |
|---|---|
| Pipe repair | Atomic request, paid, vendor, approval per contract rule. |
| Bi-annual visit | Atomic request, free, staff, scheduled. |
| Tenant document collection | Atomic request, free, staff, auto-generated on lease pending_signature. |
| **Tenant Search & Onboarding** | **Composite request from workflow template**, 8 children, mostly free, Ejari child triggers approval. |
| Lease renewal | Composite request from workflow template, recurring annually per active lease. |
| Vendor-quoted reno project with multiple trades | Composite request, ad-hoc (no template), staff adds children manually as quotes come in. |

---

## Build sequencing update

This slots into the previous step **5 (Service Requests)** and step **6 (Scheduler)**:

- Step 5 ships atomic requests first, then adds parent/child rendering and the "Steps" tab.
- Step 4 (Service Catalog) gains the `workflow_steps` editor — drag-to-reorder list of step templates.
- Step 6 scheduler handles both atomic recurrence and workflow recurrence with the same dedup key.

No reordering of phases; each still ships as a coherent slice.

---

## Out of scope (still)

- Hard dependency enforcement between steps (designed in via `blocks_next`, not enforced in v1).
- Gantt/timeline visualization — the Steps tab is a vertical list in v1.
- Per-step SLAs and escalation rules.
- Cross-workflow templates (one workflow triggering another) — handle via automation rules later.

