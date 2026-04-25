# Multi-Audience Platform Plan

Today the app is a single-portal tool built for **your** PM operators. Every page, the sidebar, the data model, and the dashboards assume one company runs one workspace. To serve owners and brokers, we need to introduce three things:

1. **Audience-aware portals** — different shells, navigation, and home screens per persona, sharing the same backend.
2. **A "workspace" / tenancy concept** — so a broker can run their own PM operation isolated from yours, and an owner only sees their own properties.
3. **A services marketplace surface** — the existing services engine, exposed as a "request a service in 2 clicks" experience for owners and brokers.

This is staged so each phase ships independently and you keep operating throughout.

---

## The three personas and what each one needs

**Solo Owner (1–2 properties) — free tier**

- Sees only their own units, tenants, leases, documents.
- "Request a service" is the hero action (cleaning, maintenance, renewal paperwork, photography, listing, valuation…).
- No staff/vendor management, no financial GL, no contracts module — just *my property*, *my tenants*, *my documents*, *request services*, *messages*.

**Portfolio Owner (5–30 properties) — free or low monthly**

- Same as solo, plus: portfolio-level dashboard (occupancy, rent collected, upcoming renewals), bulk actions, owner statements from your PM company if they delegate, multiple tenants/leases view.
- Can invite a bookkeeper or assistant as a sub-user with limited rights.

**Broker / External PM company — paid tier, full operator suite**

- Gets essentially what your operators have today (Properties, Contracts, Services, Financials, Directory, Dashboard) — but scoped to *their* workspace.
- Can also tap your services marketplace to outsource specific jobs to your network.
- Multi-user with roles inside their own workspace.

**Your internal operators (existing) — unchanged**

- Continue to see everything, with an added "Tenants" lens to switch between workspaces and a marketplace inbox of incoming service requests from owner/broker workspaces.

---

## Architecture: one app, three shells, one database

```text
                ┌─────────────────────────────────────┐
                │            auth.users               │
                └────────────────┬────────────────────┘
                                 │
                 ┌───────────────┴────────────────┐
                 │     workspace_members          │
                 │ (user_id, workspace_id, role)  │
                 └───────────────┬────────────────┘
                                 │
                ┌────────────────┴───────────────────┐
                │           workspaces               │
                │ kind: internal|owner|broker        │
                │ plan: free|pro|enterprise          │
                └────────────────┬───────────────────┘
                                 │
       ┌─────────────────────────┼──────────────────────────┐
       │                         │                          │
  buildings/units          contracts/leases           service_requests
  (workspace_id)           (workspace_id)            (workspace_id +
                                                     fulfilling_workspace_id)
```

- **One Postgres database, one codebase.** No separate apps.
- Every business table gets a `workspace_id`. RLS is rewritten to "you can see rows where workspace_id is in the workspaces you belong to".
- A user can belong to multiple workspaces (e.g. owner of their own + sub-user in a broker's workspace) and switch via a workspace picker in the header.
- The router picks one of three shells at runtime based on the active workspace's `kind`:
  - `internal` → today's full operator AppShell
  - `broker` → same AppShell, but scoped + branded to their workspace
  - `owner` → a brand-new lightweight OwnerShell with 4–5 nav items max

---

## Phased rollout

### Phase 1 — Tenancy foundation (no visible changes for current users)

Pure backend / plumbing work. Ship-and-forget.

- Add `workspaces`, `workspace_members`, `workspace_invitations` tables.
- Add `workspace_id` to every business table (`buildings`, `units`, `people`, `contracts`, `service_requests`, `invoices`, `bills`, `journal_lines`, `documents`, `notes`, `leads`, `vendors`, …).
- Backfill: all existing rows get assigned to one bootstrap "Post Build HQ" workspace of kind `internal`. Your current users become members with role `admin`.
- Rewrite RLS policies on every table from "any authenticated user" → "members of this workspace".
- Add a `useActiveWorkspace()` hook + workspace context provider; every existing query gets a workspace filter applied centrally (via a small wrapper around the supabase client or a query helper).
- Workspace switcher dropdown in the header (only visible if user has >1 workspace).

**Outcome:** the app behaves identically for you, but is now multi-tenant under the hood.

### Phase 2 — Owner Portal (solo + portfolio owners)

Build the new lightweight shell.

- New `OwnerShell` with sidebar: **My Properties**, **Tenants & Leases**, **Documents**, **Service Requests**, **Messages**, **Account**.
- New owner-facing pages (reuse existing components where possible):
  - `OwnerHome` — KPI cards: # properties, occupancy, rent due this month, open service requests, upcoming renewals.
  - `OwnerProperties` — simplified list, "Add a property" wizard (3 fields, not 30).
  - `OwnerLeases` — view tenants, expiring leases, "renew" CTA that creates a service request to your operations team.
  - `OwnerDocuments` — drop-zone on top of existing `documents` table.
  - `OwnerServiceCatalog` — the marketplace (see Phase 3).
- **Self-serve signup** with property onboarding wizard. Free tier auto-provisioned on signup.
- **Plan/billing scaffolding:** `workspace_plans` table with `free`, `portfolio`, `broker_pro`. Gate features by plan (portfolio owners get bulk actions, multi-user invites).
- Owner-specific RLS additions: an owner only sees their own buildings/units (joined through `property_owners`), even within their workspace.

### Phase 3 — Services Marketplace (the revenue engine)

This is what monetises the free tiers.

- Promote `service_catalog` to a marketplace concept. Two flavors of catalog entry:
  - **Internal** — only visible inside one workspace (e.g. broker's own services for their owners).
  - **Marketplace** — published by your `internal` workspace, available to all owner/broker workspaces.
- New `service_requests.fulfilling_workspace_id` column: when an owner clicks "Request Photography", the request is created in *their* workspace but routed to your internal workspace's inbox for fulfillment.
- Owner-side UX: a "Browse services" grid (categories, price ranges, "Request" button → 2-step modal: pick property, add notes → submit).
- Operator-side UX: a new **Marketplace Inbox** tab on the existing Services page — incoming requests from external workspaces, with accept/quote/decline actions. Reuses your existing quote/approval/completion flow.
- Cross-workspace messaging on a service request (already mostly there via `service_request_events` + notes).
- Optional payment collection on accepted quotes (Stripe Checkout link; defer to Phase 5 if you want to ship faster).

### Phase 4 — Broker Portal

Mostly a re-skin + plan gating, since brokers want what your operators already have.

- Broker signup flow → creates a `kind=broker` workspace, user is `admin` of it.
- Broker sees the full operator AppShell, but scoped to their workspace data only (RLS already enforces this from Phase 1).
- Broker-only features:
  - Branded operator workspace (logo, company name on documents).
  - Invite teammates with roles (`admin`, `manager`, `agent`, `viewer`).
  - "Outsource to Post Build" button on any service request → forwards to your marketplace inbox.
- Pricing plan gating (per-seat, per-property, or flat) — defer pricing implementation, scaffold the gates only.

### Phase 5 — Polish & growth

- White-label brokers (custom domain per workspace).
- Owner mobile-first PWA (the OwnerShell is already simple; just tighten responsive).
- Marketplace ratings & reviews (extends `service_feedback`).
- Stripe payments on marketplace requests.
- Public service catalog landing pages for SEO.

---

## Routing & shell selection

```text
User signs in
   ↓
Load workspace_members for user
   ↓
0 memberships → onboarding (pick: I'm an owner / I'm a broker)
1 membership → activate it
N memberships → activate last-used (localStorage), show switcher
   ↓
Active workspace.kind decides shell:
   internal → /dashboard, /properties, ... (today's app)
   broker   → same routes, scoped data, broker branding
   owner    → /home, /my-properties, /my-services, ...
```

URLs stay clean (no `/owner/...` prefix); the shell adapts to the active workspace. Bookmarks survive workspace switches when the route exists in both shells.

---

## Critical decisions to make before we start coding

These shape the whole foundation, so I'd like answers (or your best guess) before Phase 1:

1. **Workspace boundary for shared people.** When a tenant exists in your operator workspace AND their landlord (an owner) signs up — is the `people` row shared or duplicated per workspace? Recommended: **duplicated, with an optional `linked_person_id` for cross-workspace identity.** Keeps RLS simple and lets each workspace edit independently.
2. **Owner self-signup gate.** Open to anyone, or invite-only (you send a magic link)? Recommended: **invite-only at first**, open later.
3. **Broker pricing model.** Per-seat, per-property, or flat monthly? Doesn't block Phase 1 but shapes Phase 4 UI.
4. **Marketplace request flow.** When an owner requests a service — does it auto-quote, or always require a human at your end to accept and price? Recommended: **always human accept** for v1.

I'll ask these as proper questions when we start Phase 1 if you want, but flagging them now so the plan isn't a surprise.

---

## What I'm NOT planning to do

- No separate apps, no microservices, no separate databases per tenant.
- No rewrite of existing operator screens — they keep working as-is, just gain a workspace filter.
- No custom auth — we keep Lovable Cloud auth and layer workspace membership on top.
- Phase 1 ships zero new UI for you. Risk of regression is low because the data is unchanged, only RLS and an injected `workspace_id` filter change.

---

## Suggested starting point

If you approve, the next concrete step is **Phase 1 only** (tenancy foundation). It's invisible to current users but unblocks everything else. Phase 2 (Owner Portal) is the next visible milestone and where the product story really starts.

---

## Status

- ✅ **Phase 1** — Tenancy foundation (workspaces, members, `workspace_id` on every business table, helper RPCs).
- ✅ **Phase 1b** — RLS lockdown across business tables, auth gate re-enabled, auto-provision personal owner workspace on signup.
- ✅ **Phase 2** — Owner Portal shell (`OwnerShell`), Owner pages (Home, Properties, Leases, Documents, Services, Account), invite-only flow:
  - `lookup_invitation(token)` + `accept_workspace_invitation(token)` RPCs
  - `owner_onboard_property` 3-field wizard helper
  - `/invite/:token` public accept page
  - `/invitations` operator-side invite manager (creates link to copy/send)
  - `SmartShell` picks `OwnerShell` vs `AppShell` based on active workspace `kind`
  - Re-added the `address` column to `buildings` that had been dropped in an earlier migration
- ✅ **Phase 3** — Services Marketplace:
  - `service_catalog.is_marketplace` flag (all Post Build HQ items auto-flagged)
  - `service_requests.fulfilling_workspace_id` for cross-workspace routing
  - RLS opens marketplace catalog to all authenticated users; service requests visible to either workspace
  - `create_marketplace_service_request` RPC creates the request in the requester workspace and routes to the catalog publisher
  - **Operator marketplace inbox** at `/services/marketplace` — incoming requests from external workspaces
  - Owner portal "Request Services" now reads marketplace items and submits via the new RPC
- ⏳ **Phase 4** — Broker Portal: branded operator workspace, teammate roles, "Outsource to Post Build".
- ⏳ **Phase 5** — Polish & growth.