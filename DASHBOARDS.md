# Dashboards

Cross-cutting synthesis of operational and portfolio data, surfaced at `/dashboard`.

## 1. Purpose

The Dashboard is the cross-cutting surface that pulls signals from every other
module (Properties, People, Contracts, Leasing Lifecycle, Tickets, Vendors,
Services) into one role-aware home view. It is read-only — every metric is
a window into another module, and every row drills into a detail page.

Note: the **Leasing Lifecycle** module is a placement funnel (vacant → listed →
offer → signing → leased). Live-tenancy concerns (expiring leases, overdue
cheques) live on the Dashboard's "Attention Needed" cards and the Contracts
module — not on the Lifecycle page.

## 2. Two tabs, one route

Both tabs live at `/dashboard`. The default tab is role-based:

| Role  | Default tab | Why |
|-------|-------------|-----|
| admin | Overview    | Admins are mostly looking at the portfolio, not their own queue. |
| staff | My Work     | Staff need their daily list first; portfolio context is secondary. |

Both tabs are visible to everyone (no hard gating). The user's last choice is
remembered in `localStorage["dashboardTab"]`.

The previous root route (`/`) now redirects to `/dashboard`. The sidebar logo
and Dashboard module entry both go to `/dashboard`.

## 3. auth.users ↔ people link

The Operations ("My Work") tab needs to know "who am I" inside the people
directory. We resolve this by storing `people.auth_user_id`:

```sql
ALTER TABLE people ADD COLUMN auth_user_id uuid
  REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX people_auth_user_id_unique
  ON people(auth_user_id) WHERE auth_user_id IS NOT NULL;
```

And a helper:

```sql
CREATE FUNCTION current_user_person_id() RETURNS uuid
  LANGUAGE sql STABLE SECURITY DEFINER
  AS $$ SELECT id FROM people WHERE auth_user_id = auth.uid() LIMIT 1 $$;
```

If a logged-in user has no linked person, the My Work tab shows a full-page
empty state with a deep link into Settings → Team Members. The Overview tab
keeps working — it is portfolio-wide and doesn't depend on "me".

Admins manage links in **Settings → Team Members → Linked Logins**, backed by
the `list_auth_users_with_person()` RPC.

## 4. RPC architecture

One aggregation RPC per tab. Both are `SECURITY DEFINER`, `STABLE`, and return
a single `jsonb`. The UI calls each one once on mount and renders directly
from the JSON (no client-side joins).

| RPC                          | Tab        | Returns                                          |
|------------------------------|------------|--------------------------------------------------|
| `get_operations_dashboard()` | My Work    | `{ person_id, has_linked_person, kpis, queues }` |
| `get_management_dashboard()` | Overview   | `{ kpis, attention_items }`                      |

Why one RPC per tab (not per metric):

- Single round trip per page view → snappy first paint.
- Aggregation logic is co-located → easy to evolve without UI churn.
- Numbers are inherently consistent (single transaction).

## 5. KPI + Attention catalogue

### My Work — KPIs (6)

1. **My Open Tickets** — total + urgent + overdue (assignee = me, not closed/cancelled).
2. **My Leads** — total + stuck (proposal/negotiating > 14d in stage).
3. **Awaiting My Response** — `status='awaiting' AND waiting_on='internal'` + count waiting > 3 days.
4. **Cheques Due This Week** — pending cheques with `due_date BETWEEN today AND today+7`.
5. **Workflow Steps Blocked** — required pending steps in current stage of my open tickets.
6. **Overdue On My Plate** — combined ticket + lead overdue counts.

### My Work — Queues (≤10 rows each)

- Urgent Tickets · sort `priority desc, due_date asc, created_at asc`.
- My Leads — Follow-up · sort `target_close_date asc, stage_entered_at asc`.
- Cheques Due This Week · sort `due_date asc`.
- Awaiting My Response · sort `days_waiting desc`.

### Overview — KPIs (8)

1. **Units Managed** — total + delta (last 90d created).
2. **Occupancy** — `% occupied` + delta (90d historical lookup; null if no history).
3. **Annualized Rent Roll** — sum of `annual_rent` for active leases + delta.
4. **Annualized PM Fees** — synthesised from each active mgmt agreement's `fee_model`.
5. **Active Leases** — total + expiring in 90d.
6. **Open Tickets** — total + urgent.
7. **Weighted Pipeline** — `Σ estimated_annual_fee × probability/100` over open leads.
8. **Attention Score** — composite signal across all "Attention Needed" cards.

### Overview — Attention cards (6)

- Overdue Cheques · top 5 with amount.
- Leases Expiring · 30/60/90 buckets, top 5 soonest.
- Stuck Leads · count + weighted value, top 5.
- Compliance Expiring (60d) · grouped: mgmt agreements, vendor trade licenses, vendor insurance.
- Data Gaps · grouped: units without owners, occupied-no-lease, unlinked auth users.
- Aging Tickets · open > 30 days, top 5.

## 6. Non-obvious decisions

- **Role-based default, not hard gating** — admins occasionally want to see "my
  work" view, and staff occasionally want a portfolio sanity check. Both tabs
  available everywhere.
- **No trend charts in D1** — the Operations tab is task-oriented (act, don't
  analyse). Trends arrive in D2 when the period selector lands.
- **`attention_score` is composite** — not an intrinsic metric, but a single
  number that answers "how much should I worry today?" without forcing the
  user to read every card.
- **90d delta period is fixed in D1** — period selector is a D2 concern.
  Computing deltas for occupancy and rent roll requires history (event tables);
  if data isn't there, we return `delta=null` and the UI hides the indicator
  rather than showing a fake zero.
- **`tickets.status_changed_at` was added** — needed to compute "awaiting > 3
  days" without scanning `ticket_events`. The existing lifecycle trigger sets
  it on every status transition.
- **No multi-currency math** — PM fees and rent roll skip non-default-currency
  contracts in D1 with a TODO. Multi-currency normalisation lands later.

## 7. Planned extensions

- **D2** — trend charts (occupancy, rent roll, pipeline) + period selector.
- **D3 (maybe)** — financial deep-dive: collected vs. expected cash, vendor spend.
- **Future** — role-specific portals (owner / vendor) reusing the same RPC pattern.

## 8. Glossary

- **My Work tab** — Operations view, scoped to `current_user_person_id()`.
- **Overview tab** — Management view, portfolio-wide, RLS-respecting.
- **Stuck lead** — `status IN ('proposal','negotiating')` with `stage_entered_at`
  more than 14 days ago.
- **Linked person** — a `people` row whose `auth_user_id` matches the
  authenticated user's id.
- **Attention item** — anything surfaced on Overview tab's "Attention Needed"
  grid; each one corresponds to a real query, not a static counter.

---

_Last updated: D1 shipped. Next: D2 — trend charts + period selector._
