# Leads

_Last updated: Leads merged into the People module — pipeline now lives at `/people?tab=pipeline`. Lead detail pages remain at `/leads/:id` for now (legacy URLs redirect to People → Pipeline)._

## 1. Purpose

Track prospective management clients from first contact through signed management agreement. CRM-style pipeline focused narrowly on **acquiring new landlords**.

## 2. Data model

- `leads` — one row per prospect: identity, source, sizing, proposed terms, lifecycle state.
- `lead_events` — append-only audit log of structural changes. Mirrors `ticket_events`.
- `notes` (`entity_type='lead'`) — call notes, meeting summaries, touchpoints.
- `documents` (`entity_type='lead'`) — proposals, NDAs, landlord-supplied files.

## 3. Pipeline stages

`new` → `qualified` → `discovery` → `proposal` → `negotiating` → `contract_signed` (terminal-success) | `lost` (terminal-failure). `on_hold` is a cross-cutting paused state.

## 4. Terminal stages and the biconditional

`(status = 'contract_signed') = (won_contract_id IS NOT NULL)` — a lead reaches the won terminal stage **only** by linking an actual contract. Impossible to fake a win. The L1 generic Change Stage dialog excludes `contract_signed`; the only path is the L2 conversion flow.

## 5. On-hold semantics

- Entering: `hold_since` set, `pre_hold_status` captures prior stage.
- Exiting: `hold_since` cleared. `hold_reason` preserved as historical text + audit event.
- Modeled as a status (not a flag) because it's mutually exclusive with active stages and needs its own enter/exit timestamp.

## 6. Proposed terms vs signed terms

Lead row owns negotiation-stage terms (`proposed_*`). At conversion (L2), they pre-fill the management agreement wizard as **defaults**; the user confirms before signing. Prevents drift between "what we offered" and "what we actually signed."

## 7. Lost reasons

Required when marking lost: `price`, `scope_mismatch`, `chose_competitor`, `timing`, `withdrew`, `unresponsive`, `other`. `lost_reason_notes` required when reason is `other`. Powers future win/loss reporting.

## 8. Non-obvious decisions

- **Biconditional on `contract_signed`** — eliminates an entire class of consistency bugs.
- **Single `leads` table** — stage is a field, history lives in `lead_events`.
- **`on_hold` as a status, not a flag** — mutually exclusive with active stages, needs lifecycle timestamps.
- **`stage_entered_at` stored, not computed** — trigger sets it on every transition; cheap "stuck stage" KPIs.
- **Activities = notes** — reuse the polymorphic notes table; no new infrastructure.
- **`pre_hold_status` stored on the row** — avoids querying `lead_events` to recover prior stage on resume.
- **No photos** — leads aren't a visual content type.
- **Triggers handle lifecycle timestamps** — `manage_lead_lifecycle_timestamps` sets/clears `stage_entered_at`, `won_at`, `lost_at`, `hold_since` server-side.
- **`log_lead_events` trigger detects field changes** — audit log generated server-side, so external SQL edits also produce events.
- **Unique partial index on `won_contract_id`** — at most one lead can claim any given management agreement; double-counted wins are impossible.
- **Conversion is atomic** — the wizard's save transaction creates the contract, links `won_contract_id`, flips status to `contract_signed`, and inserts a `marked_contract_signed` event in one shot. Failure leaves the lead untouched.
- **Aging tickets target leads directly** — the T3a `detectStuckLeads` sweep emits `compliance_reminder` tickets with `target_entity_type='lead'`, so the nudge appears in the lead's own Tickets tab without any extra mapping table.
- **Stage-entry dedup key** — stuck-lead tickets dedup by `(lead_id, stage_entered_at)`, so moving a lead out and back into a stage opens a fresh nudge cycle instead of being swallowed by a stale closed ticket.

## 9. L2 features (shipped)

- **Kanban view** — `/leads` toggles between table and 7-column kanban (`new` … `lost`). Drag-drop transitions; dropping on `lost` opens the lost-reason dialog, dropping on `contract_signed` opens the conversion ritual. `on_hold` is shown as a desaturated overlay, not a column.
- **Mark Contract Signed conversion ritual** — intent picker (Create now vs Link existing), then either the mgmt-agreement wizard pre-filled from `proposed_*` fields or a filtered picker of eligible existing agreements for this landlord. Atomic post-save link.
- **Aging-lead T3a sweep** — `detectStuckLeads` emits a `compliance_reminder` ticket for any lead in `proposal`/`negotiating` stuck >14 days, routed to the lead's assignee. Priority escalates with age (medium → high >21d → urgent >30d).
- **Reciprocal banner on management agreements** — the contract detail page shows a green "Won from LEAD-…" banner linking back to the originating lead.
- **Tickets can target leads** — `tickets.target_entity_type` enum extended; `compliance_reminder` and `data_gap` allow `lead` as a target.

## 10. Glossary

- **Stage aging** — days since `stage_entered_at`. UI flags `proposal`/`negotiating` >14d as "stuck."
- **Weighted pipeline value** — sum of `estimated_annual_fee × probability_percent / 100` across active leads.
- **Active lead** — status not in `contract_signed` or `lost`.
- **Conversion** — moving a lead to `contract_signed` by signing a management agreement (L2 flow).
