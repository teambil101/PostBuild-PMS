

# Redesign: Leasing Lifecycle

Rebrand and restructure `/lifecycle` into a focused **placement funnel** — from a unit becoming available to a tenant moving in. Strip away the live-tenancy and post-tenancy stages that today muddy the view, and abandon the kanban metaphor (no drag-drop = no kanban).

## New stage model

| # | Stage | Meaning | Source of truth |
|---|---|---|---|
| 1 | **Not ready for listing** | Unit needs work before it can be marketed | `units.status ∈ {under_maintenance, off_market}` |
| 2 | **Ready but unlisted** | Unit is rentable but no listing has been published | `units.status = vacant` AND `listed_at IS NULL` |
| 3 | **Listed** | Actively marketed, no offer yet | `units.status = vacant` AND `listed_at IS NOT NULL` AND no draft lease |
| 4 | **Offer pending landlord confirmation** | Tenant interested, draft lease exists but not yet sent for signature | exists `contract` of `lease` type with `status = draft` for this unit |
| 5 | **In signing** | Sent for signature, awaiting all parties | exists `contract` of `lease` type with `status = pending_signature` |
| 6 | **Leased** *(terminal)* | Lease activated — unit is occupied | `units.status = occupied` with active lease |

Stages 1-5 are **pre-tenancy**. Once Leased, the unit exits the leasing lifecycle — renewals/move-outs are handled in the **Lease Lifecycle** workflows (Tickets module) and **Contracts** module. This page no longer shows ending-soon, recently-ended, or expiring leases.

### What about "Listed" and "Offer Pending" — these don't exist in the schema today

Two new concepts need a tiny data addition:

- `units.listed_at timestamptz NULL` — when set, the unit is "listed". Cleared when it transitions to occupied or back to not-ready.
- `units.asking_rent numeric NULL` and `units.listing_notes text NULL` — optional, surfaced in the listing card.

"Offer pending landlord confirmation" maps to the existing **draft** lease state. No schema change needed — we just relabel `draft` in the lifecycle context to make the funnel readable. (`draft` already means "PM is preparing the offer, landlord hasn't approved sending it for signature.") A future v2 can split this into a richer offer model if needed.

A `Mark as listed` / `Unlist` action on a unit (in PropertyDetail and inline on the lifecycle page) toggles `listed_at`.

## New UI: not a kanban

Replace the 6-column board with a **single-page funnel dashboard** optimized for read-only scanning at the user's 2660px width:

```text
┌─────────────────────────────────────────────────────────────────────┐
│  LEASING FUNNEL                                                     │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐                          │
│  │ 12 │→│  4 │→│  7 │→│  2 │→│  1 │→│ 38 │  (count + sparkline 30d) │
│  │NotR│ │Rdy │ │List│ │Offr│ │Sign│ │Leasd│                         │
│  └────┘ └────┘ └────┘ └────┘ └────┘ └────┘                          │
│  Conversion rates between stages shown as inline %                  │
├─────────────────────────────────────────────────────────────────────┤
│  Filter: [search] [building ▾] [stage ▾]   View: ▣ Funnel  ☰ Table  │
├─────────────────────────────────────────────────────────────────────┤
│  STAGE SECTIONS (vertical, collapsible)                             │
│                                                                     │
│  ▾ Not ready for listing (12)              [Bulk: Mark ready]       │
│    ┌───────────────────────────────────────────────────────────┐    │
│    │ Unit · Building · Reason · Days here · Owner · Action     │    │
│    │ rows...                                                   │    │
│    └───────────────────────────────────────────────────────────┘    │
│                                                                     │
│  ▾ Ready but unlisted (4)                  [Bulk: Mark listed]      │
│    rows with: days vacant, asking-rent suggestion, [Mark listed]    │
│                                                                     │
│  ▾ Listed (7)                                                       │
│    rows with: days listed, asking rent, leads attached, [Unlist]    │
│                                                                     │
│  ▾ Offer pending landlord confirmation (2)                          │
│    rows with: tenant, proposed rent, days awaiting, [Send to sign]  │
│                                                                     │
│  ▾ In signing (1)                                                   │
│    rows with: tenant, who hasn't signed, days in signing            │
│                                                                     │
│  ▾ Leased — last 30 days (38)              [view all in Contracts]  │
│    rows with: tenant, start date, annual rent (compact, read-only)  │
└─────────────────────────────────────────────────────────────────────┘
```

Why this layout works better than columns:

- **Read-only ergonomics.** Funnel strip on top gives the at-a-glance count + flow. Vertical sections give breathing room for richer per-row info than a kanban card allows.
- **Wide-screen friendly.** Tables fill the 1800px max-width without horizontal squeeze; no per-card truncation.
- **Action-oriented.** Each stage's primary CTA is obvious (Mark listed, Send to sign), unlike kanban cards that hide actions behind clicks.
- **No drag pretense.** Removes the affordance lie of the current board.
- **Funnel intuition.** Counts + arrows make it instantly clear where bottlenecks are; a built-in conversion rate (e.g. "50% Ready→Listed in <14d") surfaces the real story.

A **Table** view toggle remains, showing all units in one sortable list with stage as a column — useful for ops review.

## What gets removed

- KPI cards row (already removed in a previous turn — confirmed staying gone).
- Expiring soon section.
- Overdue cheques section.
- Data gaps section (occupied without active lease).
- The 6-column kanban grid.

These belong elsewhere:
- Expiring leases → Contracts module + Tickets (renewal workflows already exist).
- Overdue cheques → Dashboard "Attention Needed" + per-contract Cheques tab.
- Data gaps → Settings/health check or a hidden admin tool.

## Implementation outline

1. **Schema migration** — add to `units`:
   - `listed_at timestamptz NULL`
   - `asking_rent numeric NULL`, `asking_rent_currency text NULL DEFAULT 'AED'`
   - `listing_notes text NULL`
   - Trigger: when `status` changes to `occupied` or to a not-ready value, auto-clear `listed_at`.
2. **`src/lib/lifecycle.ts`** — rewrite stage logic:
   - New `LifecycleStage` enum: `not_ready | ready_unlisted | listed | offer_pending | in_signing | leased`.
   - `fetchLifecycleData` simplified: no expiring/overdue/data-gap branches. Resolve each unit to one of the six stages. "Leased" capped to the last 30 days of activations to keep the section focused.
   - Add 30-day stage-entry counts for the funnel sparkline (cheap groupby on `unit_status_history` + `contracts.created_at`).
3. **`src/pages/Lifecycle.tsx`** — rebuild:
   - PageHeader: title **"Leasing Lifecycle"**, eyebrow stays "Module", description "From available unit to signed lease."
   - New `<FunnelStrip>` component: 6 stage tiles with count, 30-day delta, and arrow connectors; clicking a tile scrolls/filters to that section.
   - New `<StageSection>` component: collapsible header (stage name, count, primary bulk action), table of rows tailored to that stage's info needs.
   - Existing search + building filter retained.
   - Table view kept; rewritten to use new stage labels.
4. **`src/lib/modules.ts`** — rename label from "Lease Lifecycle" to **"Leasing Lifecycle"**.
5. **`src/components/AppShell.tsx`** — update active-link match (path stays `/lifecycle`).
6. **Listing actions** — add `MarkListedDialog` (asking rent + notes) and `UnlistDialog`. Surface buttons:
   - On the lifecycle page rows in "Ready but unlisted" and "Listed" stages.
   - On `PropertyDetail.tsx` unit cards.
7. **Cleanup** — delete `LifecycleTable`'s expiring/overdue/data-gap helpers and the related dialog wiring (`DepositChequeDialog`, `BounceChequeDialog`) from this page.
8. **Docs** — update `DASHBOARDS.md` to describe the funnel; note that ending-soon/overdue lives elsewhere now.

## Files touched

- **Edit:** `src/pages/Lifecycle.tsx`, `src/lib/lifecycle.ts`, `src/lib/modules.ts`, `src/components/AppShell.tsx`, `src/components/properties/UnitFormDialog.tsx` (surface `asking_rent`/`listed_at` if unit is vacant), `DASHBOARDS.md`.
- **Create:** `src/components/lifecycle/FunnelStrip.tsx`, `src/components/lifecycle/StageSection.tsx`, `src/components/lifecycle/MarkListedDialog.tsx`, `src/components/lifecycle/UnlistDialog.tsx`.
- **Migration:** add `units.listed_at`, `units.asking_rent`, `units.asking_rent_currency`, `units.listing_notes` + auto-clear trigger.
- **Untouched:** all contracts code, all leads/people code, lifecycle workflows in tickets, `lease_cheques`.

## Open questions for you

1. **"Offer pending" semantics.** Does today's `draft` lease state actually mean "tenant has made an offer, awaiting landlord OK"? If you want a dedicated state separate from `draft`, that's a bigger change (new contract status enum value + flow). Default plan: relabel `draft` for lifecycle display only.
2. **Listing model depth.** Are you OK with `listed_at` as a single timestamp, or do you want a proper `listings` table later (multi-portal sync, listing history, asking-rent changes over time)? Default plan: single timestamp now, table later if needed.
3. **"Leased" cap.** Show only units leased in the last 30 days (recent wins), or all currently-leased units? Default plan: last 30 days, with a "view all in Contracts" link.

