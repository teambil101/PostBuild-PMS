import { supabase } from "@/integrations/supabase/client";

/* =========================================================
 * Leasing Lifecycle — placement funnel
 * From "unit becomes available" to "tenant moves in".
 * ========================================================= */

export type LifecycleStage =
  | "not_ready"
  | "ready_unlisted"
  | "listed"
  | "offer_pending"
  | "in_signing"
  | "leased";

export const LIFECYCLE_STAGE_ORDER: LifecycleStage[] = [
  "not_ready",
  "ready_unlisted",
  "listed",
  "offer_pending",
  "in_signing",
  "leased",
];

export const LIFECYCLE_STAGE_LABELS: Record<LifecycleStage, string> = {
  not_ready: "Not ready for listing",
  ready_unlisted: "Ready but unlisted",
  listed: "Listed",
  offer_pending: "Offer pending landlord confirmation",
  in_signing: "In signing",
  leased: "Leased",
};

export const LIFECYCLE_STAGE_SHORT: Record<LifecycleStage, string> = {
  not_ready: "Not ready",
  ready_unlisted: "Ready",
  listed: "Listed",
  offer_pending: "Offer",
  in_signing: "Signing",
  leased: "Leased",
};

export const LIFECYCLE_STAGE_SUBLABELS: Record<LifecycleStage, string> = {
  not_ready: "Maintenance or off-market — needs work before marketing",
  ready_unlisted: "Rentable, no listing published yet",
  listed: "Actively marketed, no offer yet",
  offer_pending: "Draft lease prepared — awaiting landlord OK",
  in_signing: "Sent for signature — awaiting all parties",
  leased: "Tenant moved in — terminal stage",
};

export const LIFECYCLE_STAGE_STYLES: Record<LifecycleStage, string> = {
  not_ready: "bg-status-maintenance/10 text-status-maintenance border-status-maintenance/30",
  ready_unlisted: "bg-warm-stone/40 text-true-taupe border-warm-stone",
  listed: "bg-status-vacant/10 text-status-vacant border-status-vacant/30",
  offer_pending: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  in_signing: "bg-amber-500/15 text-amber-700 border-amber-500/40",
  leased: "bg-status-occupied/10 text-status-occupied border-status-occupied/30",
};

export interface LifecycleUnit {
  id: string;
  ref_code: string;
  unit_number: string;
  unit_type: string;
  floor: number | null;
  status: string;
  status_locked_by_lease_id: string | null;
  building_id: string;
  building_name: string;
  building_ref: string;
  vacant_since: string | null;
  listed_at: string | null;
  asking_rent: number | null;
  asking_rent_currency: string | null;
  listing_notes: string | null;
  has_mgmt_agreement: boolean;
}

export interface LifecycleLease {
  contract_id: string;
  contract_number: string;
  contract_status: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
  annual_rent: number | null;
  currency: string;
  unit_id: string | null;
  tenant_name: string | null;
  tenant_id: string | null;
  signed_count: number;
  party_count: number;
}

export interface LifecycleCard {
  key: string;
  stage: LifecycleStage;
  unit: LifecycleUnit;
  lease?: LifecycleLease;
}

export interface LifecycleData {
  units: LifecycleUnit[];
  leases: LifecycleLease[];
  buildings: { id: string; name: string }[];
  byStage: Record<LifecycleStage, LifecycleCard[]>;
  /** Last 30 days entries per stage — for the funnel sparkline */
  stageDeltas: Record<LifecycleStage, number>;
}

/* =========================================================
 * Date helpers
 * ========================================================= */
const MS_PER_DAY = 86400000;

export function daysBetween(from: Date | string, to: Date | string): number {
  const a = typeof from === "string" ? new Date(from) : from;
  const b = typeof to === "string" ? new Date(to) : to;
  return Math.ceil((b.getTime() - a.getTime()) / MS_PER_DAY);
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysISO(days: number): string {
  return new Date(Date.now() + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/* =========================================================
 * Fetching
 * ========================================================= */
export async function fetchLifecycleData(): Promise<LifecycleData> {
  const thirtyAgo = addDaysISO(-30);

  const [buildingsRes, unitsRes, contractsRes] = await Promise.all([
    supabase.from("buildings").select("id, name, ref_code").order("name"),
    supabase
      .from("units")
      .select(
        "id, ref_code, unit_number, unit_type, floor, status, status_locked_by_lease_id, building_id, created_at, listed_at, asking_rent, asking_rent_currency, listing_notes",
      ),
    supabase
      .from("contracts")
      .select(
        "id, contract_number, contract_type, status, start_date, end_date, currency, created_at, updated_at",
      )
      .eq("contract_type", "lease")
      .in("status", ["draft", "pending_signature", "active"]),
  ]);

  const buildings = (buildingsRes.data ?? []) as Array<{ id: string; name: string; ref_code: string }>;
  const buildingMap = new Map(buildings.map((b) => [b.id, b]));

  const rawUnits = (unitsRes.data ?? []) as any[];
  const allContracts = (contractsRes.data ?? []) as any[];
  const contractIds = allContracts.map((c) => c.id);

  // Fetch parties + subjects + active mgmt coverage in parallel
  const [partiesRes, subjectsRes, mgmtRes] = await Promise.all([
    contractIds.length
      ? supabase
          .from("contract_parties")
          .select("contract_id, person_id, role, signed_at, people(id, first_name, last_name, company)")
          .in("contract_id", contractIds)
      : Promise.resolve({ data: [] as any[], error: null }),
    contractIds.length
      ? supabase
          .from("contract_subjects")
          .select("contract_id, entity_type, entity_id")
          .in("contract_id", contractIds)
          .eq("entity_type", "unit")
      : Promise.resolve({ data: [] as any[], error: null }),
    supabase
      .from("contracts")
      .select("id, status, contract_type, contract_subjects(entity_type, entity_id)")
      .eq("contract_type", "management_agreement")
      .eq("status", "active"),
  ]);

  const parties = (partiesRes.data ?? []) as any[];
  const subjects = (subjectsRes.data ?? []) as any[];
  const mgmts = (mgmtRes.data ?? []) as any[];

  // Mgmt-coverage set
  const mgmtCoveredUnits = new Set<string>();
  mgmts.forEach((m) => {
    (m.contract_subjects ?? []).forEach((s: any) => {
      if (s.entity_type === "unit") mgmtCoveredUnits.add(s.entity_id);
    });
  });

  // Map subjects by contract → unit
  const contractToUnit = new Map<string, string>();
  subjects.forEach((s) => {
    if (!contractToUnit.has(s.contract_id)) contractToUnit.set(s.contract_id, s.entity_id);
  });

  // Tenant + signature stats
  const contractToTenant = new Map<string, { id: string; name: string }>();
  const sigCounts = new Map<string, { signed: number; total: number }>();
  parties.forEach((p) => {
    const cur = sigCounts.get(p.contract_id) ?? { signed: 0, total: 0 };
    cur.total += 1;
    if (p.signed_at) cur.signed += 1;
    sigCounts.set(p.contract_id, cur);

    if (p.role !== "tenant" || contractToTenant.has(p.contract_id)) return;
    const person = p.people;
    if (!person) return;
    const name =
      person.company ||
      `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim() ||
      "—";
    contractToTenant.set(p.contract_id, { id: person.id, name });
  });

  // Lease child for annual_rent
  const leaseChildRes = contractIds.length
    ? await supabase.from("leases").select("contract_id, annual_rent").in("contract_id", contractIds)
    : { data: [] as any[] };
  const annualRentByContract = new Map<string, number>();
  ((leaseChildRes.data ?? []) as any[]).forEach((l) => {
    annualRentByContract.set(l.contract_id, l.annual_rent);
  });

  // Build LifecycleLease[]
  const lifecycleLeases: LifecycleLease[] = allContracts.map((c) => {
    const tenant = contractToTenant.get(c.id) ?? null;
    const sc = sigCounts.get(c.id) ?? { signed: 0, total: 0 };
    return {
      contract_id: c.id,
      contract_number: c.contract_number,
      contract_status: c.status,
      start_date: c.start_date,
      end_date: c.end_date,
      created_at: c.created_at,
      updated_at: c.updated_at,
      annual_rent: annualRentByContract.get(c.id) ?? null,
      currency: c.currency ?? "AED",
      unit_id: contractToUnit.get(c.id) ?? null,
      tenant_id: tenant?.id ?? null,
      tenant_name: tenant?.name ?? null,
      signed_count: sc.signed,
      party_count: sc.total,
    };
  });

  // vacant_since via unit_status_history (best-effort)
  const vacantUnitIds = rawUnits.filter((u) => u.status === "vacant").map((u) => u.id);
  const vacantSinceMap = new Map<string, string>();
  if (vacantUnitIds.length > 0) {
    const { data: histRows } = await supabase
      .from("unit_status_history")
      .select("unit_id, new_status, changed_at")
      .in("unit_id", vacantUnitIds)
      .eq("new_status", "vacant")
      .order("changed_at", { ascending: false });
    (histRows ?? []).forEach((h: any) => {
      if (!vacantSinceMap.has(h.unit_id)) vacantSinceMap.set(h.unit_id, h.changed_at);
    });
  }

  // Build LifecycleUnit[]
  const lifecycleUnits: LifecycleUnit[] = rawUnits.map((u) => {
    const b = buildingMap.get(u.building_id);
    return {
      id: u.id,
      ref_code: u.ref_code,
      unit_number: u.unit_number,
      unit_type: u.unit_type,
      floor: u.floor,
      status: u.status,
      status_locked_by_lease_id: u.status_locked_by_lease_id,
      building_id: u.building_id,
      building_name: b?.name ?? "—",
      building_ref: b?.ref_code ?? "",
      vacant_since: vacantSinceMap.get(u.id) ?? u.created_at,
      listed_at: u.listed_at ?? null,
      asking_rent: u.asking_rent ?? null,
      asking_rent_currency: u.asking_rent_currency ?? "AED",
      listing_notes: u.listing_notes ?? null,
      has_mgmt_agreement: mgmtCoveredUnits.has(u.id),
    };
  });

  /* ==========================
   * State resolution per unit
   * ========================== */
  const byStage: Record<LifecycleStage, LifecycleCard[]> = {
    not_ready: [],
    ready_unlisted: [],
    listed: [],
    offer_pending: [],
    in_signing: [],
    leased: [],
  };

  // Group leases by unit
  const leasesByUnit = new Map<string, LifecycleLease[]>();
  lifecycleLeases.forEach((l) => {
    if (!l.unit_id) return;
    if (!leasesByUnit.has(l.unit_id)) leasesByUnit.set(l.unit_id, []);
    leasesByUnit.get(l.unit_id)!.push(l);
  });

  lifecycleUnits.forEach((u) => {
    const myLeases = leasesByUnit.get(u.id) ?? [];

    // 1. In signing — pending_signature wins
    const signing = myLeases.find((l) => l.contract_status === "pending_signature");
    if (signing) {
      byStage.in_signing.push({ key: signing.contract_id, stage: "in_signing", unit: u, lease: signing });
      return;
    }

    // 2. Offer pending — draft lease for this unit
    const draft = myLeases
      .filter((l) => l.contract_status === "draft")
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
    if (draft) {
      byStage.offer_pending.push({ key: draft.contract_id, stage: "offer_pending", unit: u, lease: draft });
      return;
    }

    // 3. Leased — occupied with active lease (cap: only show last 30 days of activations)
    if (u.status === "occupied") {
      const active = myLeases.find((l) => l.contract_status === "active");
      if (active) {
        const activatedRecently = (active.start_date ?? active.updated_at) >= thirtyAgo;
        if (activatedRecently) {
          byStage.leased.push({ key: active.contract_id, stage: "leased", unit: u, lease: active });
        }
        return; // occupied units exit the placement funnel either way
      }
      // Occupied without active lease — data gap, exclude from funnel display
      return;
    }

    // 4. Vacant: listed vs ready_unlisted
    if (u.status === "vacant") {
      if (u.listed_at) {
        byStage.listed.push({ key: u.id, stage: "listed", unit: u });
      } else {
        byStage.ready_unlisted.push({ key: u.id, stage: "ready_unlisted", unit: u });
      }
      return;
    }

    // 5. Not ready — under_maintenance, off_market, reserved
    if (u.status === "under_maintenance" || u.status === "off_market" || u.status === "reserved") {
      byStage.not_ready.push({ key: u.id, stage: "not_ready", unit: u });
      return;
    }
  });

  /* ==========================
   * 30-day stage entry deltas
   * ========================== */
  const stageDeltas: Record<LifecycleStage, number> = {
    not_ready: 0,
    ready_unlisted: 0,
    listed: 0,
    offer_pending: 0,
    in_signing: 0,
    leased: 0,
  };
  // listed: count units with listed_at within last 30d
  lifecycleUnits.forEach((u) => {
    if (u.listed_at && u.listed_at >= thirtyAgo) stageDeltas.listed += 1;
  });
  // offer_pending / in_signing / leased: count contracts created within last 30d in that status
  allContracts.forEach((c) => {
    if (c.created_at < thirtyAgo) return;
    if (c.status === "draft") stageDeltas.offer_pending += 1;
    else if (c.status === "pending_signature") stageDeltas.in_signing += 1;
    else if (c.status === "active") stageDeltas.leased += 1;
  });

  return {
    units: lifecycleUnits,
    leases: lifecycleLeases,
    buildings: buildings.map((b) => ({ id: b.id, name: b.name })),
    byStage,
    stageDeltas,
  };
}
