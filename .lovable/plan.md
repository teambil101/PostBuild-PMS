## Dashboard refactor + Staff & Vendors performance tab

Convert the Dashboard from a button grid into a tabbed workspace, then build the first tab end-to-end: a performance command center for the people doing the work (staff) and the vendors hired alongside them.

---

### 1. Dashboard shell — tabs replace cards

`src/pages/Dashboard.tsx` becomes a tabbed surface. The three buttons are gone; the modules are still reachable from the sidebar.

```text
/dashboard
├── Staff & Vendors  ← built now
├── Properties       ← placeholder (Coming soon)
├── Directory        ← placeholder (Coming soon)
└── Vendors          ← placeholder (Coming soon, redundant with Staff & Vendors but kept per request)
```

Tab state persists in `localStorage["dashboardTab"]`. Default is "Staff & Vendors".

---

### 2. Staff & Vendors tab — KPI design

Three KPI sections, each one driven by a single source of truth in a new `src/lib/performance.ts` so the same numbers feed cards, leaderboards, and detail pages.

Period selector at the top: **Last 30 days · 90 days · YTD · All time** (defaults to 90 days). Persisted in URL.

#### Section A — Financials (cost & revenue)

Per assignee (staff or vendor) we compute two flows:

- **Cost to PM** = sum of `bills.total` (vendor) + payroll-equivalent placeholder for staff = sum of `service_requests.cost_final` where `delivery=staff` (treated as internal cost only when explicitly recorded).
- **Revenue from service** = sum of invoices generated against tenants/landlords for that service request (`invoices.total` linked via `service_request_id`).
- **Margin** = revenue − cost.
- **Per-service avg cost / avg revenue** when grouped by `service_catalog.name`.

KPI cards:
1. **Total service cost (period)** — total spent on vendors + staff, with delta vs prior period.
2. **Total service revenue (period)** — billed against landlords/tenants, with delta.
3. **Net margin (period)** — revenue − cost, with margin %.
4. **Open vendor liability** — sum of unpaid bill balances (already overdue tinted red).

Tables:
- **Top 5 revenue-generating services** (by invoice total), bottom 5 below.
- **Top 5 cost services** (by bill total), bottom 5 below.
- **Top 5 vendors by spend** with their margin contribution.
- **Top 5 staff by jobs completed** with their cost contribution.

#### Section B — Performance (speed & throughput)

Computed from `service_requests` + `service_request_steps`:

- **Avg time-to-start** = `started_at − created_at` (excludes those still open).
- **Avg time-to-complete** = `completed_at − started_at`.
- **On-time rate** = % completed on or before `scheduled_date`.
- **Cost variance** = `(cost_final − cost_estimate) / cost_estimate` averaged across closed jobs.
- **Throughput** = jobs completed in the period.
- **SLA breaches** = open jobs with `scheduled_date < today` (live count, not period-bound).

KPI cards:
1. **Avg completion time** (with delta).
2. **On-time rate** (with delta).
3. **Active jobs / SLA breaches** (live).
4. **Cost variance vs estimate** (with delta).

Leaderboards (Top 5 / Bottom 5):
- Fastest avg completion (staff) — minimum 3 jobs in period.
- Fastest avg completion (vendors) — minimum 3 jobs.
- Best on-time rate.
- Worst on-time rate (the "needs attention" list).

#### Section C — Service Quality (customer feedback)

Quality requires data we don't have yet. Add a small feedback layer:

**New table `service_feedback`**:
```sql
CREATE TABLE service_feedback (
  id uuid PK,
  service_request_id uuid NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  submitted_by_person_id uuid REFERENCES people(id),
  submitted_at timestamptz DEFAULT now(),
  -- denormalized so leaderboards don't need joins
  assigned_person_id uuid,
  assigned_vendor_id uuid
);
```
- Staff capture this on the request detail page after completion (a "Record customer feedback" action that opens a 1–5 star + comment dialog). Only one feedback row per request enforced via unique index.
- A trigger copies `assigned_*` from the parent request at insert, so the row is self-contained for analytics.

KPIs:
1. **Avg rating (period)** — mean across all feedback.
2. **Feedback coverage** — % of completed jobs that received feedback (also a hint to chase missing ones).
3. **Top-rated staff / vendor** (min 3 ratings to appear).
4. **Lowest-rated staff / vendor** (min 3 ratings).

Empty state: when no feedback exists yet, the section explains the new capture flow and links to the most recent completed jobs that need feedback recorded.

#### Section D — Recent activity feed

Right-rail (or below sections on mobile): the 15 most recent events drawn from `service_request_events` + `payments` (vendor pay-outs) + `service_feedback` inserts. Each row is one line with deep link.

---

### 3. Layout

```text
┌──────────────────────────────────────────────────────────────┐
│ Period: [30d] [90d] [YTD] [All]                              │
├──────────────────────────────────────────────────────────────┤
│ Financials  · 4 KPI cards                                    │
│ ├─ Top/Bottom services by revenue (table)                    │
│ ├─ Top/Bottom services by cost (table)                       │
│ └─ Top vendors by spend  ·  Top staff by jobs                │
├──────────────────────────────────────────────────────────────┤
│ Performance · 4 KPI cards                                    │
│ ├─ Fastest staff   ·  Fastest vendors                        │
│ └─ Best on-time    ·  Needs attention (worst on-time)        │
├──────────────────────────────────────────────────────────────┤
│ Service Quality · 4 KPI cards                                │
│ ├─ Top-rated staff  ·  Top-rated vendors                     │
│ └─ Lowest-rated     ·  Awaiting feedback list                │
├──────────────────────────────────────────────────────────────┤
│ Recent activity feed (last 15 events)                        │
└──────────────────────────────────────────────────────────────┘
```

On mobile (`<md`) sections stack vertically, leaderboards collapse to a single column, KPI cards go 2×2.

Every leaderboard row links into the relevant detail page (`/people/:id` or `/vendors/:id`); every service link goes to the catalog entry.

---

### 4. Files

**New**
- `src/lib/performance.ts` — period helpers, type definitions, all aggregation queries (one function per KPI block, returning typed data), so the page stays presentational.
- `src/components/dashboard/PeriodSelector.tsx` — segmented control.
- `src/components/dashboard/KpiCard.tsx` — title, value, delta chip, sparkline-free for v1.
- `src/components/dashboard/Leaderboard.tsx` — generic Top-N / Bottom-N table with rank, name, value, secondary metric, and a min-sample threshold note.
- `src/components/dashboard/ActivityFeed.tsx` — recent events.
- `src/components/dashboard/StaffVendorsTab.tsx` — composes the four sections.
- `src/components/services/RecordFeedbackDialog.tsx` — 1–5 stars + comment, called from request detail.

**Modified**
- `src/pages/Dashboard.tsx` — convert to `<Tabs>` shell with placeholder content for the three later tabs.
- `src/pages/ServiceRequestDetail.tsx` — surface "Record customer feedback" action when `status='completed'`; show captured rating inline.
- `src/integrations/supabase/types.ts` — auto-regenerated after migration.

**Migration**
- One SQL migration: create `service_feedback` table + RLS (authenticated CRUD, matching existing posture) + the trigger that backfills `assigned_*` from the parent request + a unique index on `service_request_id`.

---

### 5. Performance & correctness

- All KPI queries are **bounded by the selected period** server-side (filtered on `created_at` / `paid_on` / `completed_at` as appropriate).
- One round-trip per section: each section calls a single composed query (no N+1 from leaderboards).
- Min-sample thresholds (e.g. 3 jobs / 3 ratings) prevent statistical noise dominating the leaderboards; the component shows "Need ≥3 jobs to qualify" when filtered out.
- Currency: all money totals assume the `app_settings.default_currency` for v1; rows in other currencies are flagged but excluded from sums (with a small footer note "Excludes N rows in other currencies").
- Deltas computed against the equivalent prior window. If prior window has zero comparable data, delta is hidden (no fake `+∞%`).
- All numbers go through `lib/financialFormulas.ts` rounding helpers to stay consistent with the Financials module.
- The activity feed query is capped at 15 rows and only refetches on tab focus.

---

### 6. Out of scope (called out for later)

- Charts/sparklines — v1 is numeric only; a v2 chart pass adds trends.
- Per-property KPIs and per-portfolio breakdowns — planned for the Properties tab.
- Tenant-side feedback collection (portal) — for now feedback is staff-captured.
- Multi-currency normalization — same v1 limitation as Financials.
- Email/Slack alerting — surfacing only on dashboard for now.

