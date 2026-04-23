

## Calendar views for scheduled service work

Two new calendar views, both reading from the same source (`service_request_steps.scheduled_date` + `service_requests.scheduled_date` for atomic requests), so the data stays consistent.

---

### 1. Services module — operator calendar

**Where:** new third tab on `/services`: `Catalog` · `Requests` · **`Calendar`**.

**What it shows:** every step (or atomic request) with a `scheduled_date`, across all units, color-coded by status (open / scheduled / in progress / blocked / completed / cancelled).

**Layout:**
- Month grid (default) with prev/next/Today controls and a "Month / Week / List" toggle in the header.
- Each cell shows up to 3 chips per day; "+N more" opens a day popover listing the rest.
- Each chip = `{request_number} · {step title}` with a status dot. Click → navigates to `/services/requests/:id`.
- Right-side filter rail (collapsible): status (multi), priority (multi), assignee (vendor / staff / unassigned), category (multi), unit (search-picker). Filters persist in the URL (`?status=…&assignee=…`).
- Top-of-calendar summary strip: `Scheduled this week: N · Awaiting approval: N · Overdue (past date, not completed): N`.
- Week view: 7-column day strip with chips stacked vertically.
- List view: chronological table grouped by day, useful for printing/dispatch.

**Interactions (v1, low-risk):**
- Click chip → open request detail.
- Click empty day → opens a small "Schedule…" prompt with two actions: "New service request on this date" (deep link to `/services/new?scheduled_date=…`) or "Pick existing unscheduled" (combobox of open steps with no date → set `scheduled_date` on select).
- Drag-and-drop to reschedule is **out of scope for v1** (flagged; can add later with optimistic update + audit event).

---

### 2. Property profile — per-unit calendar

**Where:** new tab on `/properties/:buildingId/units/:unitId`: existing tabs become `Overview · Photos · Documents · Notes · Status history · ` **`Schedule`**.

**What it shows:** same calendar component, pre-filtered to this unit only. Includes both:
- Service request steps targeting this unit.
- Atomic service requests targeting this unit.
- Optional: a "Lease milestones" overlay toggle (lease start/end, cheque due dates from `recurring_invoice_schedules`) so the operator sees rent + service activity together. Off by default to keep it focused.

**Layout:** identical month/week/list toggle as the services calendar; no unit filter (locked to this unit). Header shows a unit-specific count: `Open jobs on this unit: N · Next scheduled: {date}`.

---

### 3. Shared component

A single `<ServiceCalendar />` powers both views to avoid drift.

**Props:**
```ts
type ServiceCalendarProps = {
  scope: { type: "all" } | { type: "unit"; unitId: string };
  defaultView?: "month" | "week" | "list";
  showFilters?: boolean;        // true on /services, false on unit profile
  showLeaseOverlay?: boolean;   // unit profile only
};
```

Internally it queries `service_requests` + `service_request_steps` joined by `request_id`, filters by `scheduled_date` within the visible window, and renders status-colored chips (reusing the existing `RequestStatusBadge` color tokens for consistency).

---

### 4. Files

**New**
- `src/components/services/ServiceCalendar.tsx` — month/week/list views, filter rail, day popover, fetch + caching by visible date range.
- `src/components/services/CalendarDayPopover.tsx` — overflow list when a day has >3 chips.
- `src/lib/calendar.ts` — small helpers: `monthGrid(date)`, `weekGrid(date)`, `groupByDay(items)`, `statusDotClass(status)`.

**Modified**
- `src/pages/Services.tsx` — add `Calendar` tab.
- `src/pages/UnitDetail.tsx` — add `Schedule` tab rendering `<ServiceCalendar scope={{type:"unit", unitId}} showFilters={false} showLeaseOverlay />`.
- `src/pages/NewServiceRequest.tsx` — accept `?scheduled_date=` query param to pre-fill the schedule field.

**No DB migration** — `scheduled_date` already exists on both `service_requests` and `service_request_steps`.

---

### 5. Performance & correctness

- Query is window-bounded: only fetches rows where `scheduled_date BETWEEN visibleStart AND visibleEnd`. Re-fetches when the user navigates months.
- Step rows and atomic request rows are merged into a single normalized `CalendarItem[]` so the renderer is dumb.
- Past-dated, non-completed items render with a subtle red outline (uses existing `balanceTone` color logic for overdue) so dispatchers can see slippage at a glance.
- Empty states use the existing `EmptyState` component.
- Mobile: month view collapses to a compact agenda list under `md` breakpoint.

