# Service Request Coordination Flow

This plan extends the existing `service_requests` system (which already has assignment, approvals, steps, completion webhook → n8n, and tenant feedback) with the missing coordination pieces: **vendor shortlisting & quote collection**, **tenant scheduling/access confirmation**, and **status updates broadcast to tenant + landlord**.

---

## 1. The end-to-end flow

```text
[CREATE]
  Staff opens a service request (atomic OR workflow)
  └─ Picks target unit/building
  └─ Picks catalog service
  └─ Optional: per-step or per-request default assignee from catalog

[VENDOR SELECTION]  (only if delivery = vendor / either)
  ├─ A) Direct assign — staff already knows who to use
  └─ B) Shortlist & quote — invite 2-3 vendors to bid
       ├─ n8n notifies each shortlisted vendor (WhatsApp/email)
       ├─ Each vendor submits price + ETA via a tokenized public quote page
       ├─ Staff sees quotes side-by-side, accepts one
       └─ Other vendors auto-rejected & notified

[APPROVAL]  (existing — already implemented)
  ├─ Landlord approval (cost > MA threshold) — already wired to ApprovalCard
  └─ NEW: Tenant approval gate — only when work is chargeable to tenant
       OR requires tenant access to occupied unit

[SCHEDULING]
  ├─ Vendor proposes date/time (via same public link)
  ├─ Tenant confirms / counter-proposes (via tokenized tenant link)
  └─ Final scheduled_date written to service_request

[EXECUTION & UPDATES]
  ├─ Vendor marks "on the way", "started", "blocked", "needs more parts"
  ├─ Each update = service_request_event + n8n notification to tenant + landlord
  └─ Photos/docs attached to the request (already supported)

[COMPLETION]  (existing — already implemented)
  ├─ Staff marks completed → existing trigger fires service-completed-webhook
  └─ n8n calls tenant for feedback → save-feedback edge function → service_feedback table
```

---

## 2. What already exists (no work needed)

- `service_requests` with `assigned_vendor_id` / `assigned_person_id`, status, priority
- `service_request_steps` for workflows + per-step assignment
- `service_request_events` audit trail
- Approval workflow with MA-threshold logic (`approval_status`, `decide_service_request_approval` RPC, `ApprovalCard.tsx`)
- `service-completed-webhook` → n8n → `save-feedback` → `service_feedback` table
- `vendors.specialties` (jsonb) for matching vendors to categories

---

## 3. What's missing — the coordination gaps

### A. Vendor shortlisting + quote collection
Right now you can only **direct-assign one vendor**. There's no way to invite multiple vendors to quote.

**New table: `service_request_quotes`**
- `request_id`, `vendor_id`
- `status`: `invited` / `submitted` / `accepted` / `rejected` / `withdrawn`
- `amount`, `currency`, `eta_days`, `notes`
- `invite_token` (unique, for public submission link)
- `invited_at`, `submitted_at`, `decided_at`

**New UI on ServiceRequestDetail:**
- "Get quotes" button (when no vendor assigned yet)
- Vendor multi-picker filtered by matching `specialties`
- Quote comparison card (price · ETA · vendor rating · accept button)
- Accepting a quote: writes `assigned_vendor_id`, sets others to `rejected`, fires n8n notifications

**New edge function: `submit-vendor-quote`** (public, token-auth)
- Vendor opens link from WhatsApp/email
- Submits amount + ETA + notes — no login required

**New n8n flow: `quote-request`** — fan-out WhatsApp/email to invited vendors with their tokenized link.

### B. Tenant approval/access gate
Approvals today only cover landlord. Some jobs need tenant sign-off (chargeable to tenant, or needs unit access).

**Add to `service_requests`:**
- `tenant_approval_required` boolean
- `tenant_approval_status`: `not_required` / `pending` / `approved` / `rejected`
- `tenant_approval_token`, `tenant_approval_decided_at`, `tenant_approval_notes`

**Auto-trigger conditions (in catalog or per-request):**
- `bill_to = tenant` → require tenant approval of cost
- Target unit has an active lease with status `occupied` AND work needs entry → require tenant access confirmation

**New edge function: `tenant-decision`** (tokenized public page) — same pattern as vendor quotes.

### C. Tenant scheduling confirmation
Today `scheduled_date` is set unilaterally by staff. Tenants need to confirm.

**Add:**
- `proposed_scheduled_date`, `tenant_schedule_status` (`pending` / `confirmed` / `rescheduled`)
- Tenant link → confirm or counter-propose
- On counter-propose → vendor notified, can accept or re-counter

### D. Status update broadcasts
Vendor pushes mid-job updates ("on the way", "starting", "needs part — delayed 2 days"). Each becomes a `service_request_events` row AND triggers an n8n broadcast to tenant + landlord (WhatsApp).

**New edge function: `vendor-status-update`** (tokenized) — vendor's link doubles for status pushes.

**New n8n flow: `service-update-broadcast`** — fans out to tenant + landlord based on event type.

---

## 4. Implementation phases

### Phase 1 — Vendor shortlist & quotes (highest value)
- Migration: `service_request_quotes` table + RLS
- UI: "Get quotes" panel on `ServiceRequestDetail.tsx` (vendor multi-picker → invite)
- UI: quote comparison list with accept/reject
- Edge fn: `submit-vendor-quote` (public, token-auth, validates token, writes row)
- Public quote page: new route `/q/:token` — minimal form, no auth
- n8n webhook: `quote-request-created` → fans out invites

### Phase 2 — Tenant approval & scheduling
- Migration: add tenant approval + scheduling columns to `service_requests`
- UI: tenant gate card on `ServiceRequestDetail.tsx` (mirrors `ApprovalCard`)
- Edge fn: `tenant-decision` (public, tokenized) — handles approve/reject + schedule confirm
- Public tenant page: route `/t/:token` — combined approval + schedule confirm
- n8n flows: `tenant-approval-requested`, `tenant-schedule-proposed`

### Phase 3 — Status update broadcasts
- Edge fn: `vendor-status-update` (public, tokenized) — vendor pushes "on way / started / blocked"
- New event types in `service_request_events`: `vendor_en_route`, `vendor_started`, `vendor_blocked`, `vendor_needs_parts`
- n8n flow: `service-update-broadcast` → WhatsApp tenant + landlord
- UI: timeline view on request detail showing all events chronologically

### Phase 4 — Polish
- Vendor performance score on shortlist (avg rating from `service_feedback`, on-time %, quote win rate)
- Auto-suggest vendors when creating a request (rank by specialty match + score)
- Landlord-facing summary email at job completion (sent via n8n)

---

## 5. Public link security model

All public pages (`/q/:token`, `/t/:token`) use:
- 32-byte random token stored hashed in DB (lookup by hash)
- Token expires when its parent record is decided
- Single-purpose: a quote token can ONLY submit to its own request+vendor pair
- Edge function validates token, never trusts the client for IDs

No login = friction-free for vendors and tenants on WhatsApp.

---

## 6. n8n side (you'll build these flows)

| Webhook from Lovable | n8n action |
|---|---|
| `quote-request-created` | WhatsApp + email each invited vendor with their `/q/:token` link |
| `quote-accepted` / `quote-rejected` | WhatsApp the vendor with the outcome |
| `tenant-approval-requested` | WhatsApp tenant with `/t/:token` link |
| `vendor-status-update` | WhatsApp tenant + landlord with the update text |
| `service-completed` (existing) | Call tenant for feedback (existing) |

---

## 7. Open questions (please answer before Phase 1)

1. **Quote channel** — WhatsApp only, or WhatsApp + email? (Affects what fields the n8n flow needs.)
2. **Quote SLA** — how long do vendors have to respond before they're auto-withdrawn? (24h? 48h?)
3. **Tenant approval scope** — should tenant approve every paid job they're billed for, or only above a threshold (e.g. > 500 AED)?
4. **Counter-propose loop** — how many rounds of date negotiation between vendor and tenant before a human steps in? (Suggest 2.)

Once you answer, I'll start with **Phase 1** (vendor shortlist & quote collection) since that's the biggest gap and unlocks the rest.