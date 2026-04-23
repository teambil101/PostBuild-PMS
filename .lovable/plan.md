

## Pivot to unit-centric operations + inline create in contracts

Two related changes:

1. **Units become the only operational subject.** Buildings remain as containers (city, type, owners) but cannot be the target of a service request or the subject of a contract. Every job and every contract attaches to one or more units.
2. **Contract wizards** (MA, Lease, VSA) get inline "+ Create new" affordances for **Unit**, **Tenant**, and **Vendor**, so the user never has to leave the wizard to fix missing data.

---

### Part A — Unit-centric Properties module

**Properties landing (`/properties`) becomes a unit list.**

- Default view: a flat, searchable, filterable list of **all units** across the portfolio. Columns: ref code, unit (building name · unit number), type, status, beds/baths, size, asking rent.
- Filters: building, status, type, vacancy.
- Two view toggles: **Units** (default) and **Buildings** (the existing grid/list, demoted to a secondary tab).
- Primary CTA: **+ New unit** (opens unit dialog with a building selector inside; "+ New building" link inline for the rare case there's no building yet).
- Secondary CTA in the Buildings tab: **+ New building**.

**Building detail (`/properties/:id`) stays as today** — it's the editor for the building shell and shows the units inside it, but it's no longer where you start day-to-day work.

**Unit detail (`/properties/:buildingId/units/:unitId`)** unchanged structurally, but breadcrumbs updated to lead back to the unit list rather than the building.

**Sidebar / Dashboard wording:** "Properties" stays as the module label, but the dashboard card description changes from "Buildings, units, ownership" to "Units, buildings, ownership."

---

### Part B — Eliminate building-level service work

**Service requests target only units.**

- `TargetPicker.tsx`: drop the "A building" and "Portfolio-level" tiles. Single mode: pick a unit. (We keep `target_type` in the schema for legacy rows but the UI only writes `'unit'`.)
- `NewServiceRequest.tsx` wizard: remove the target-type step's branch logic; the unit picker is shown directly with a search box.
- `ServiceRequestDetail.tsx`: target rendering simplified to just "Building · Unit N".
- Common-area work (lobby, lift) is handled by attaching the request to a designated representative unit (e.g. "Common Areas" unit) — documented as a soft convention; not enforced in code. Existing legacy building-level requests still render but show a small "legacy building target" tag.

**Service catalog** stays as-is — workflow/recurring catalog entries don't change.

---

### Part C — Contracts: units only as subjects

**Management Agreement wizard (`NewManagementAgreement.tsx`)**

- Replace `PropertyPicker` (current building+unit hierarchy) with a new `UnitMultiPicker` that lists units grouped by building, with a "Select all units in this building" shortcut (writes individual unit subjects, not a building subject).
- Every saved subject is `subject_type='unit'`. Building subjects are no longer written.
- Add inline "+ New unit" affordance inside the picker (opens `UnitFormDialog` — requires picking/creating a building first).

**Lease wizard** (`NewLease.tsx`) — already unit-only. Add inline "+ New unit" and "+ New tenant" actions.

**VSA wizard** (`NewVendorServiceAgreement.tsx`) — already vendor-scoped (no property subjects). Add inline "+ New vendor" action in `VendorPicker`.

**Contract detail (`ContractDetail.tsx`)** — subject rendering simplified to unit rows only; legacy building subjects still display with a "(legacy: building-level)" tag.

---

### Part D — Inline create in pickers

Three pickers gain a "+ Create new" item, mirroring how `PersonCombobox` already does it:

| Picker | New affordance | Opens |
|---|---|---|
| `UnitPicker` (lease wizard) | `+ New unit` | `UnitFormDialog` (with a building sub-selector) |
| New `UnitMultiPicker` (MA wizard) | `+ New unit` | same as above |
| `PersonCombobox` (tenant role in lease wizard) | already has `+ Add new person` — keep it | `PersonQuickAddDialog` |
| `VendorPicker` (VSA wizard) | `+ New vendor` | `NewVendorDialog` (existing) |

When a new entity is created inline, it's auto-selected in the picker and the wizard step's validation re-runs.

---

### Files touched

**New**
- `src/components/contracts/UnitMultiPicker.tsx` — replaces `PropertyPicker` for MA wizard. Supports inline "+ New unit".

**Edited**
- `src/pages/Properties.tsx` — flip default to unit list; keep buildings as a secondary tab.
- `src/components/properties/UnitFormDialog.tsx` — accept optional `buildingId` (when called from a global "new unit" flow, expose a building selector with inline "+ New building" → opens `BuildingFormDialog`).
- `src/components/contracts/UnitPicker.tsx` — add "+ New unit" trigger (opens `UnitFormDialog`).
- `src/components/contracts/VendorPicker.tsx` — add "+ New vendor" trigger (opens `NewVendorDialog`).
- `src/components/services/TargetPicker.tsx` — drop building/portfolio tiles; unit-only.
- `src/pages/NewServiceRequest.tsx` — simplify target step.
- `src/pages/NewManagementAgreement.tsx` — swap `PropertyPicker` → `UnitMultiPicker`; write only unit subjects.
- `src/pages/ContractDetail.tsx` — simplify subject rendering, tag legacy building rows.
- `src/pages/ServiceRequestDetail.tsx` — simplify target rendering, tag legacy building rows.
- `src/pages/Dashboard.tsx` — dashboard wording.

**No DB migration** — schema already supports unit subjects/targets; legacy building rows are left in place and rendered with a "(legacy)" tag.

