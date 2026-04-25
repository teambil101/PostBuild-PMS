## Goal

Only show service catalog entries that are actually **deliverable for the user's context** (city/country of their properties), instead of a global marketplace list.

## Current behavior

- `OwnerServices.tsx` (used by Owners and Brokers) loads every `service_catalog` row where `is_marketplace=true AND is_active=true`, regardless of where the user's properties are.
- `vendor_services` already encodes geographic coverage (`service_area_cities`, `service_area_all_cities`) and there is a working SQL helper `match_vendors_for_catalog(catalog_id, city)`.
- Seeded marketplace items are Dubai/UAE-specific (Notice 25, RDC eviction filing) — showing them globally is wrong.

So we already have the data needed; we just need to use it as a filter.

## Approach

Add a single SQL helper that returns the catalog entries deliverable for a given **workspace** (based on the cities of that workspace's buildings) and the marketplace flag, then call it from the UI instead of the raw `service_catalog` query.

### Database

New migration adding:

1. `public.list_marketplace_catalog_for_workspace(_workspace_id uuid)` — `SECURITY DEFINER`, returns catalog rows where:
   - `is_marketplace=true AND is_active=true`
   - At least one active `vendor_services` row matches the catalog and one of the workspace's building cities (uses the existing coverage logic: `service_area_all_cities` OR city in `service_area_cities`).
   - If the workspace has **no buildings yet**, return all marketplace+active entries (so first-time owners aren't shown an empty page).
2. `GRANT EXECUTE ... TO authenticated`.

No schema changes to `service_catalog`; coverage is derived from `vendor_services` which already has city data. This keeps the model consistent with what brokers see when matching vendors.

### UI

`src/pages/owner/OwnerServices.tsx`:
- Replace the direct `service_catalog` query with `supabase.rpc('list_marketplace_catalog_for_workspace', { _workspace_id: activeWorkspace.id })`.
- Empty-state copy: when buildings exist but the RPC returns 0, show "No services available in your area yet" instead of the generic "marketplace will be live shortly".
- Keep the existing "Add a property first" inline message inside the request dialog (already present).

No other surfaces need changes:
- The internal catalog page (`Services.tsx` non-broker view) is for the operator's own workspace and is correctly scoped already.
- `CatalogPicker` / `CoveredServicesPicker` are operator-only and stay as-is.

## Test plan

Manual checks against seed data (all current buildings are in Dubai):

1. Owner with a Dubai building → sees the Dubai-only marketplace items.
2. Owner with no buildings → sees the full marketplace list (graceful fallback) and the request dialog blocks submission with the existing "Add a property first" message.
3. Add a building in a city with no covering vendor (e.g. Sharjah) and only that building → marketplace list is empty; copy reads "No services available in your area yet".
4. Toggle a `vendor_services` row's `service_area_all_cities` on → that catalog entry appears for every workspace regardless of city.
5. Broker view (`BrokerServicesView`) — same RPC drives it via reused `OwnerServices`, so behavior matches owner.

## Out of scope

- Filtering by property type (residential vs commercial), language, or vendor capacity — can be layered onto the same RPC later.
- Cross-country expansion UI; we only filter by city today since that is what `vendor_services` tracks.
