

# Merge Leads into People

Goal: collapse the **Leads** sidebar module into **People**. Every lead is anchored to a person with role `prospect`; the pipeline kanban becomes a tab on `/people`. Lead detail pages survive (the pipeline state is too rich to inline). The **Module count drops from 10 → 9** and the mental model becomes: *one directory of humans, with a pipeline view of those humans we're trying to win*.

## What changes for the user

- `/people` gains two top-level tabs: **Directory** (current list) and **Pipeline** (current kanban + filter bar + KPIs).
- Sidebar **Leads** entry is removed. **People** icon stays.
- A person with role `prospect` shows a small "In pipeline" chip in the directory and a "View pipeline" button on their detail page.
- Anywhere a lead is opened today (`/leads/:id`), the URL still works — that detail page stays untouched.
- `/leads` and `/leads/:id` keep redirecting/working so existing bookmarks and emails don't break (`/leads` → `/people?tab=pipeline`).
- The **Leads tab on a person's detail page** is renamed **Pipeline** for consistency, with a "+ New lead for this person" affordance.

## Structure after merge

```text
Sidebar
├─ Dashboard
├─ Properties
├─ People                       ← merged module
│   ├─ tab: Directory           (existing /people content)
│   └─ tab: Pipeline            (existing /leads content)
├─ Contracts
├─ Lease Lifecycle
├─ Tickets & Workflows
├─ Vendors
├─ Services
└─ Settings
```

## Implementation outline

1. **`src/lib/modules.ts`** — remove the `leads` entry. People label stays; description updated to mention prospects.
2. **`src/pages/People.tsx`** — wrap current body in a `Tabs` (Directory | Pipeline). URL state via `?tab=pipeline`. Pipeline tab renders the existing `LeadsKanban` + filter bar + KPIs lifted from `Leads.tsx`. Add a "+ New lead" action when on Pipeline tab; "+ New person" when on Directory.
3. **Lift, don't rewrite** — extract the Leads page body into two reusable pieces:
   - `src/components/people/PipelineView.tsx` — KPIs + filter bar + kanban/table toggle (the entire current `Leads.tsx` minus `PageHeader`).
   - Keeps URL params (`q`, `status`, `assignee`, `source`, `closeFrom`, `closeTo`, `stuck`) — fully backward-compatible.
4. **`src/pages/Leads.tsx`** — replaced with a one-liner `<Navigate to="/people?tab=pipeline" replace />` so old links still land somewhere sensible.
5. **`src/App.tsx`** — keep the `/leads/:leadId` route pointing at `LeadDetail` (no change needed; URL stays as it is — refactoring it to `/people/pipeline/:leadId` is out of scope and would break existing tickets and dashboard drill-downs that link to `/leads/:id`).
6. **`NewLeadDialog`** — when launched from a person's detail page, pre-fill `primary_contact_id` (already supported via the `defaultPersonId` prop pattern used elsewhere; verify and wire).
7. **`src/pages/PersonDetail.tsx`** — rename the existing "Leads" tab to "Pipeline" and add a small "+ New lead" button in that tab's header.
8. **`AppShell`** active-link logic** — `/people` and `/people?tab=pipeline` and any `/leads/*` route all highlight the People sidebar item.
9. **Dashboard / cross-references** — the Overview tab's "Active leads" / "Weighted pipeline" KPIs and any drill-down links currently pointing at `/leads` get updated to `/people?tab=pipeline`. Lead detail links unchanged.
10. **Docs** — update `LEADS.md` header note and `DASHBOARDS.md` to reflect the new home; no schema changes.

## What does NOT change

- Database schema. `leads`, `lead_events`, biconditional on `won_contract_id`, all triggers, RPCs, RLS — untouched.
- Lead detail page (`/leads/:id`) — too much UI specific to pipeline state; embedding inside a person tab would be a regression.
- The conversion ritual (Mark Contract Signed → management agreement wizard) — unchanged.
- Aging-lead T3a sweep, kanban drag-drop, lost-reason dialog — all preserved.

## Risks & mitigations

- **People page becomes a 2-mode page.** Mitigation: tabs are URL-driven, so deep links keep working; default tab is Directory.
- **People without `prospect` role appearing in the kanban.** Not possible — the kanban reads from the `leads` table, not from `people`. Role is a directory concern only.
- **Dashboard drill-downs.** A grep pass on `/leads` string literals catches them; the redirect on `/leads` is a safety net.
- **People page perf with kanban mounted.** Mitigation: lazy-render Pipeline tab content (only fetch leads when the tab is opened).

## Files touched

- Edit: `src/lib/modules.ts`, `src/pages/People.tsx`, `src/pages/Leads.tsx` (becomes redirect), `src/pages/PersonDetail.tsx`, `src/components/AppShell.tsx`, `src/pages/Dashboard.tsx`, `LEADS.md`, `DASHBOARDS.md`
- Create: `src/components/people/PipelineView.tsx` (extracted from `Leads.tsx`)
- Untouched: all `src/components/leads/**`, `src/lib/leads.ts`, `LeadDetail.tsx`, all migrations

