
# Lock down the Broker portal: requesters, not publishers

## Problem
Today brokers (`workspace.kind = 'broker'`) get the same `AppShell` as internal operators with zero restrictions. That means they can:
- Create/edit `service_catalog` items (they shouldn't — only the platform/providers publish)
- Open the **Marketplace Inbox** at `/services/marketplace` (incoming external requests — only providers should see this)
- Manage vendors and run a fulfillment pipeline as if they were a service provider

A broker is a **buyer**, like an owner with more property volume. They should only be able to **browse the marketplace and request services**, mirroring the owner portal pattern.

## Target behavior

Inside a broker workspace:
- **Services page** → swap the operator's "Manage catalog" view for a **marketplace browse + request** view (same shape as `OwnerServices.tsx` but with the broker's full property list).
- **Marketplace inbox route** → blocked / hidden.
- **Catalog management** (create/edit/archive `service_catalog` rows) → hidden in nav, blocked at the route, and rejected at the RLS layer for safety.
- **Vendors module** → keep (brokers do manage their own subcontractor list for non-marketplace work), but cannot publish those vendors to the marketplace.
- All other operator modules (Properties, Contracts, People, Leads, Financials, Dashboard) → unchanged. Brokers run their PM ops as before.

Internal operators are unaffected.

## Implementation

### 1. Frontend nav + routing gates
- Add a `useIsBroker()` helper from `WorkspaceContext` (returns `activeWorkspace?.kind === 'broker'`).
- In `src/lib/modules.ts` (or wherever the AppShell sidebar is built), filter out:
  - "Marketplace inbox" link
  - "Manage service catalog" / catalog editing entry points
- In `src/App.tsx` route table, wrap broker-restricted routes in a `<RequireNotBroker>` guard that redirects to `/services` with a toast.
- Routes affected: `/services/marketplace`, any `/services/catalog/new`, `/services/catalog/:id/edit`.

### 2. Replace the broker's Services page
- Detect `kind === 'broker'` inside `src/pages/Services.tsx`. If true, render a broker-flavored marketplace view (reuse the component body of `src/pages/owner/OwnerServices.tsx`).
- Difference vs owner: property selector lists *all* the broker's managed buildings/units (not just owner-linked ones).
- Submits via the existing `create_marketplace_service_request` RPC — already routes to the fulfilling provider workspace correctly.

### 3. Database safety net (defense in depth)
A SQL migration so even a manipulated client can't write:
- Add RLS policy on `service_catalog`: `INSERT/UPDATE/DELETE` only allowed when the caller's workspace is `kind IN ('internal','provider')`. Brokers fail at the database.
- Same restriction on `service_request_steps` write paths used by the fulfillment side.
- Brokers retain `SELECT` on marketplace-flagged catalog rows (already in place via the Phase 3 policy).

### 4. Tracker note
Update `.lovable/plan.md` Phase 4 to record: "Broker = buyer-only. No catalog publishing. No marketplace inbox."

## Files touched
- `src/contexts/WorkspaceContext.tsx` — add `isBroker` derived flag
- `src/lib/modules.ts` — filter sidebar items by workspace kind
- `src/App.tsx` — route guard for broker-restricted paths
- `src/pages/Services.tsx` — render marketplace view when broker
- New: `src/components/RequireNotBroker.tsx` (small wrapper)
- New migration: tighten `service_catalog` write RLS by workspace kind
- `.lovable/plan.md` — note the rule

## Out of scope (call out before building)
- Provider portal / `kind='provider'` workspaces — still pending Phase 4 of the bigger plan. This task only restricts what brokers see; it does not yet introduce a separate provider experience.
- Brokers offering their *own* PM services on the marketplace — would require turning their workspace into a hybrid buyer+provider. Deferred until provider infra lands.

Approve and I'll implement in one pass.

---

## Status update

- ✅ **Broker lockdown** — Brokers are buyers only:
  - Frontend: `Services` page renders a Browse + My Requests view for `kind='broker'` workspaces (no catalog tab, no marketplace inbox button).
  - Routing: `/services/marketplace` blocked by `RequireNotBroker` guard.
  - Database: `service_catalog` write policies require `is_publisher_workspace(workspace_id)` — only `internal` (future `provider`) workspaces can publish.
